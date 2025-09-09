const reactAgentService = require("../services/ReactAgentService");
const webSocketService = require("../services/webSocketService");
const redisCacheService = require("../services/redisCacheService");
const hybridMemoryManager = require("../services/hybridMemoryManager");
const dataService = require("../services/dataService");
const User = require("../models/User");

class ChatController {
	constructor() {
		this.RATE_LIMIT_WINDOW = 60; // seconds
		this.RATE_LIMIT_MAX = 30; // requests per window
		this.MAX_MESSAGE_LENGTH = 5000;
		this.CONVERSATION_TITLE_MAX_LENGTH = 50;

		this.bindMethods();
	}

	bindMethods() {
		const methods = [
			"chat",
			"chatWebSocket",
			"getStatus",
			"getMemoryStats",
			"clearMemory",
			"getConversationHistory",
			"refreshData",
			"healthCheck",
		];
		methods.forEach((method) => {
			this[method] = this[method].bind(this);
		});
	}

	// Validation helpers
	validateMessage(message) {
		if (!message || typeof message !== "string") {
			throw new Error(
				"Message is required and must be a string"
			);
		}

		const trimmed = message.trim();
		if (trimmed.length === 0) {
			throw new Error("Message cannot be empty");
		}

		if (trimmed.length > this.MAX_MESSAGE_LENGTH) {
			throw new Error(
				`Message too long. Maximum ${this.MAX_MESSAGE_LENGTH} characters`
			);
		}

		return trimmed;
	}

	// Rate limiting helper
	async checkRateLimit(userId, clientIP) {
		const rateKey = userId || clientIP;
		const requestCount = await redisCacheService.incrementRateLimit(
			rateKey,
			this.RATE_LIMIT_WINDOW
		);

		if (requestCount > this.RATE_LIMIT_MAX) {
			const error = new Error(
				"Rate limit exceeded. Please slow down."
			);
			error.statusCode = 429;
			error.retryAfter = this.RATE_LIMIT_WINDOW;
			throw error;
		}

		return requestCount;
	}

	// Conversation management helper
	async getOrCreateConversation(sessionId, userId, message) {
		if (!userId) {
			return sessionId || `session-${Date.now()}`;
		}

		const existingConversation = sessionId
			? await User.getConversationByIdDirect(sessionId)
			: null;

		if (!existingConversation) {
			return await User.createConversation(
				userId,
				this.generateConversationTitle(message)
			);
		}

		return sessionId;
	}

	// SSE response setup
	setupSSEResponse(res, conversationId) {
		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Headers": "Content-Type",
			"Access-Control-Allow-Methods": "POST",
		});

		// Send initial acknowledgment
		const startData = {
			type: "start",
			sessionId: conversationId,
			timestamp: new Date().toISOString(),
		};
		res.write(`data: ${JSON.stringify(startData)}\n\n`);
	}

	// Stream handler factory
	createStreamHandler(res, conversationId) {
		return async (token) => {
			const tokenData = {
				type: "token",
				content: token,
			};

			res.write(`data: ${JSON.stringify(tokenData)}\n\n`);

			// Send via WebSocket
			await webSocketService.streamToken(
				conversationId,
				token
			);
		};
	}

	// Database save operations
	async saveMessagesToDatabase(
		conversationId,
		userId,
		userMessage,
		assistantResponse,
		toolsUsed = []
	) {
		if (!userId) return;

		const saveOperations = [];

		// Save user message
		if (userMessage) {
			saveOperations.push(
				User.saveMessage(
					conversationId,
					"user",
					userMessage,
					{},
					userId
				).catch((err) =>
					console.error(
						"Error saving user message:",
						err
					)
				)
			);
		}

		// Save assistant response
		if (assistantResponse) {
			saveOperations.push(
				User.saveMessage(
					conversationId,
					"assistant",
					assistantResponse,
					{ toolsUsed, success: true },
					userId
				).catch((err) =>
					console.error(
						"Error saving assistant response:",
						err
					)
				)
			);
		}

		// Save tool messages
		if (toolsUsed.length > 0) {
			saveOperations.push(
				this.saveToolMessages(
					conversationId,
					userId
				).catch((err) =>
					console.error(
						"Error saving tool messages:",
						err
					)
				)
			);
		}

		await Promise.allSettled(saveOperations);
	}

	async saveToolMessages(conversationId, userId) {
		try {
			const history = await hybridMemoryManager.getHistory(
				conversationId
			);
			const toolMessages = history.filter(
				(msg) => msg.role === "tool"
			);

			const savePromises = toolMessages.map((toolMsg) =>
				User.saveMessage(
					conversationId,
					"tool",
					toolMsg.content,
					{
						tool_call_id:
							toolMsg.tool_call_id,
						tool_name: toolMsg.tool_call_id,
					},
					userId
				)
			);

			await Promise.all(savePromises);
		} catch (error) {
			console.error("Failed to save tool messages:", error);
		}
	}

	async chat(req, res) {
		try {
			const { message, sessionId } = req.body;
			const authenticatedUserId = req.user?.id;
			const clientIP = req.ip || req.connection.remoteAddress;

			const validatedMessage = this.validateMessage(message);

			await this.checkRateLimit(
				authenticatedUserId,
				clientIP
			);

			const conversationId = await this.getOrCreateConversation(
				sessionId,
				authenticatedUserId,
				validatedMessage
			);

			// Setup SSE response
			this.setupSSEResponse(res, conversationId);

			// Create stream handler
			const streamHandler = this.createStreamHandler(
				res,
				conversationId
			);

			// Process with ReAct agent
			const result = await reactAgentService.streamQuery(
				validatedMessage,
				conversationId,
				streamHandler,
				authenticatedUserId
			);

			// Save messages to database
			await this.saveMessagesToDatabase(
				conversationId,
				authenticatedUserId,
				validatedMessage,
				result.response,
				result.toolsUsed || []
			);

			// Send completion data
			const completionData = {
				type: "complete",
				response: result.response,
				toolsUsed: result.toolsUsed || [],
				sessionId: conversationId,
				metadata: {
					timestamp: new Date().toISOString(),
					success: result.success,
					iterations: result.metadata?.iterations,
					reasoning: result.metadata?.reasoning,
					userId: authenticatedUserId,
				},
			};

			res.write(
				`data: ${JSON.stringify(completionData)}\n\n`
			);
			res.end();

			// Send via WebSocket
			await webSocketService.sendChatComplete(
				conversationId,
				result.response,
				result.toolsUsed || [],
				completionData.metadata
			);
		} catch (error) {
			console.error("Chat controller error:", error.message);

			const errorData = {
				type: "error",
				content:
					error.statusCode === 429
						? error.message
						: "An error occurred while processing your request.",
				error:
					process.env.NODE_ENV === "development"
						? error.message
						: undefined,
				timestamp: new Date().toISOString(),
			};

			if (error.statusCode === 429) {
				res.writeHead(429, {
					"Content-Type": "application/json",
					"Retry-After": error.retryAfter,
				});
				res.end(
					JSON.stringify({
						success: false,
						error: error.message,
						retryAfter: error.retryAfter,
					})
				);
			} else {
				res.write(
					`data: ${JSON.stringify(errorData)}\n\n`
				);
				res.end();
			}
		}
	}

	async chatWebSocket(data) {
		try {
			const { message, sessionId, userId, socketId } = data;

			// Validate message
			const validatedMessage = this.validateMessage(message);

			// Check rate limit
			await this.checkRateLimit(userId, socketId);

			const conversationId =
				sessionId || `session-${Date.now()}`;

			// Create stream handler for WebSocket
			const streamHandler = async (token) => {
				await webSocketService.streamToken(
					conversationId,
					token
				);
			};

			// Process with ReAct agent
			const result = await reactAgentService.streamQuery(
				validatedMessage,
				conversationId,
				streamHandler,
				userId
			);

			// Send completion via WebSocket
			await webSocketService.sendChatComplete(
				conversationId,
				result.response,
				result.toolsUsed || [],
				{
					success: result.success,
					iterations: result.metadata?.iterations,
					reasoning: result.metadata?.reasoning,
					timestamp: new Date().toISOString(),
				}
			);

			return result;
		} catch (error) {
			console.error("WebSocket chat error:", error.message);
			throw error;
		}
	}

	async getStatus(req, res) {
		try {
			const [
				cacheStats,
				currentData,
				redisStats,
				memoryHealth,
				wsStats,
			] = await Promise.allSettled([
				dataService.getCacheStats(),
				dataService.getCurrentData().catch(() => null),
				redisCacheService.getCacheStats(),
				hybridMemoryManager.healthCheck(),
				Promise.resolve(webSocketService.getStats()),
			]);

			const status = {
				dataService: {
					hasData:
						cacheStats.value?.hasData ||
						false,
					isFresh:
						cacheStats.value?.isFresh ||
						false,
					dataAge:
						cacheStats.value?.dataAge ||
						null,
					lastFetch: currentData.value
						? new Date(
								currentData.value.timestamp
						  ).toISOString()
						: null,
				},
				cache: {
					keys: cacheStats.value?.keys || 0,
					hits: cacheStats.value?.hits || 0,
					misses: cacheStats.value?.misses || 0,
				},
				redis: redisStats.value || {
					status: "unknown",
				},
				memory: memoryHealth.value || {
					status: "unknown",
				},
				webSocket: wsStats.value || {
					status: "unknown",
				},
				server: {
					uptime: process.uptime(),
					memory: process.memoryUsage(),
					timestamp: new Date().toISOString(),
				},
			};

			res.json({ success: true, status });
		} catch (error) {
			console.error(
				"Status controller error:",
				error.message
			);
			res.status(500).json({
				success: false,
				error: "Failed to get status",
			});
		}
	}

	async getMemoryStats(req, res) {
		try {
			const { sessionId } = req.params;

			if (!sessionId) {
				return res.status(400).json({
					success: false,
					error: "Session ID is required",
				});
			}

			const memoryStats =
				await hybridMemoryManager.getMemoryStats(
					sessionId
				);

			res.json({
				success: true,
				sessionId,
				memoryStats,
				timestamp: new Date().toISOString(),
			});
		} catch (error) {
			console.error(
				"Memory stats controller error:",
				error.message
			);
			res.status(500).json({
				success: false,
				error: "Failed to get memory statistics",
			});
		}
	}

	async clearMemory(req, res) {
		try {
			const { sessionId } = req.params;

			if (!sessionId) {
				return res.status(400).json({
					success: false,
					error: "Session ID is required",
				});
			}

			await hybridMemoryManager.clearSession(sessionId);

			res.json({
				success: true,
				message: `Memory cleared for session ${sessionId}`,
				timestamp: new Date().toISOString(),
			});
		} catch (error) {
			console.error(
				"Clear memory controller error:",
				error.message
			);
			res.status(500).json({
				success: false,
				error: "Failed to clear memory",
			});
		}
	}

	async getConversationHistory(req, res) {
		try {
			const { sessionId } = req.params;
			const { includeRAG = false, query = "" } = req.query;

			if (!sessionId) {
				return res.status(400).json({
					success: false,
					error: "Session ID is required",
				});
			}

			const history = await hybridMemoryManager.getHistory(
				sessionId,
				includeRAG === "true",
				query
			);

			res.json({
				success: true,
				sessionId,
				messageCount: history.length,
				history,
				timestamp: new Date().toISOString(),
			});
		} catch (error) {
			console.error(
				"Get history controller error:",
				error.message
			);
			res.status(500).json({
				success: false,
				error: "Failed to get conversation history",
			});
		}
	}

	async refreshData(req, res) {
		try {
			const freshData = await dataService.getCurrentData(
				true
			);

			res.json({
				success: true,
				message: "Data refreshed successfully",
				metadata: {
					timestamp: freshData.timestamp,
					recordCount: freshData.count,
					isFresh: freshData.isFresh,
					source: freshData.source,
				},
			});
		} catch (error) {
			console.error(
				"Refresh data controller error:",
				error.message
			);
			res.status(500).json({
				success: false,
				error: "Failed to refresh data",
				message: error.message,
			});
		}
	}

	async healthCheck(req, res) {
		try {
			const [
				reactAgentHealth,
				wsHealth,
				redisHealth,
				memoryHealth,
			] = await Promise.allSettled([
				reactAgentService.healthCheck(),
				Promise.resolve(webSocketService.healthCheck()),
				redisCacheService.healthCheck(),
				hybridMemoryManager.healthCheck(),
			]);

			const services = {
				reactAgent: reactAgentHealth.value || {
					status: "unknown",
				},
				webSocket: wsHealth.value || {
					status: "unknown",
				},
				redis: redisHealth.value || {
					status: "unknown",
				},
				memory: memoryHealth.value || {
					status: "unknown",
				},
			};

			const overallHealthy = Object.values(services).every(
				(service) =>
					service.status === "healthy" ||
					service.status === "degraded"
			);

			res.status(overallHealthy ? 200 : 503).json({
				success: overallHealthy,
				health: {
					status: overallHealthy
						? "healthy"
						: "degraded",
					services,
					timestamp: new Date().toISOString(),
				},
			});
		} catch (error) {
			console.error("Health check error:", error.message);
			res.status(500).json({
				success: false,
				error: "Health check failed",
				message: error.message,
			});
		}
	}

	generateConversationTitle(message) {
		const cleanMessage = message.trim();
		if (cleanMessage.length <= this.CONVERSATION_TITLE_MAX_LENGTH) {
			return cleanMessage;
		}

		// Find natural break point
		const words = cleanMessage.split(" ");
		let title = "";
		const maxLength = this.CONVERSATION_TITLE_MAX_LENGTH - 3; // Reserve space for "..."

		for (const word of words) {
			if ((title + " " + word).length > maxLength) break;
			title += (title ? " " : "") + word;
		}

		return (
			title +
			(title.length < cleanMessage.length ? "..." : "")
		);
	}
}

module.exports = new ChatController();
