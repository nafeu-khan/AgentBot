const redisCacheService = require("./redisCacheService");
const chromaDBService = require("./chromaDBService");
const { InMemoryStore } = require("./memoryStore");

class HybridMemoryManager {
	constructor() {
		// Short-term memory (in-memory for current session)
		this.stm = new InMemoryStore();

		// Medium-term memory (Redis for session persistence)
		this.mtm = redisCacheService;

		// Long-term memory (ChromaDB for semantic search and learning)
		this.ltm = chromaDBService;

		this.maxSTMMessages = 20; // Keep last 20 messages in STM
		this.maxMTMMessages = 100; // Keep last 100 messages in Redis
		this.ragContextLimit = 5; // Number of similar messages for RAG

		console.log("HybridMemoryManager initialized");
	}

	async initialize() {
		try {
			await this.mtm.initialize();
			await this.ltm.initialize();
			console.log("HybridMemoryManager services initialized");
		} catch (error) {
			console.warn(
				"Error initializing HybridMemoryManager (some services may be degraded):",
				error.message
			);
		}
	}

	// Add a message to all memory layers
	async addMessage(sessionId, message) {
		try {
			const timestamp = new Date().toISOString();
			const messageWithTimestamp = {
				...message,
				timestamp,
				id: this.generateMessageId(),
			};

			// 1. Add to Short-term Memory (immediate access)
			await this.stm.addMessage(sessionId, messageWithTimestamp);

			// 2. Add to Medium-term Memory (Redis for persistence)
			const mtmHistory = (await this.mtm.getChatContext(sessionId)) || [];
			mtmHistory.push(messageWithTimestamp);

			// Keep only last maxMTMMessages in Redis
			if (mtmHistory.length > this.maxMTMMessages) {
				mtmHistory.splice(0, mtmHistory.length - this.maxMTMMessages);
			}
			await this.mtm.setChatContext(sessionId, mtmHistory);

			// 3. Add to Long-term Memory (ChromaDB for semantic search)
			if (message.content && message.content.trim()) {
				await this.ltm.storeMessage(
					sessionId,
					message.content,
					message.role,
					{
						messageId: messageWithTimestamp.id,
						hasToolCalls: !!message.tool_calls,
						toolCallsCount: message.tool_calls
							? message.tool_calls.length
							: 0,
					}
				);
			}

			// Trim STM if it exceeds limit
			await this.trimSTM(sessionId);

			return messageWithTimestamp;
		} catch (error) {
			console.error("Error adding message to hybrid memory:", error);
			throw error;
		}
	}

	// Get conversation history with hybrid approach
	async getHistory(sessionId, includeRAG = false, query = "") {
		try {
			// 1. Get recent history from STM (fastest)
			let stmHistory = await this.stm.getHistory(sessionId);

			// 2. If STM is empty or insufficient, get from MTM (Redis)
			if (!stmHistory || stmHistory.length === 0) {
				const mtmHistory = await this.mtm.getChatContext(sessionId);
				if (mtmHistory && mtmHistory.length > 0) {
					// Restore STM from MTM
					for (const msg of mtmHistory.slice(-this.maxSTMMessages)) {
						await this.stm.addMessage(sessionId, msg);
					}
					stmHistory = await this.stm.getHistory(sessionId);
				}
			}

			let history = stmHistory || [];

			// 3. Optionally include RAG context from LTM
			if (includeRAG && query) {
				const ragContext = await this.getRagContext(sessionId, query);
				if (ragContext.length > 0) {
					// Insert RAG context as system messages at the beginning
					const ragMessages = ragContext.map((ctx) => ({
						role: "system",
						content: `[CONTEXT] ${ctx.content}`,
						timestamp: ctx.metadata.timestamp,
						id: `rag_${ctx.id}`,
						isRAG: true,
					}));

					history = [...ragMessages, ...history];
				}
			}

			return history;
		} catch (error) {
			console.error("Error getting hybrid history:", error);
			return [];
		}
	}

	// Get RAG context for enhanced responses
	async getRagContext(sessionId, query) {
		try {
			const similarMessages = await this.ltm.searchSimilarMessages(
				query,
				sessionId,
				this.ragContextLimit
			);

			// Filter out very recent messages (already in STM) and low-relevance ones
			const filteredContext = similarMessages.filter((msg) => {
				const messageAge =
					Date.now() - new Date(msg.metadata.timestamp).getTime();
				const isOldEnough = messageAge > 5 * 60 * 1000; // 5 minutes old
				const isRelevant = msg.distance < 0.8; // Similarity threshold
				return isOldEnough && isRelevant;
			});

			return filteredContext;
		} catch (error) {
			console.error("Error getting RAG context:", error);
			return [];
		}
	}

	// Store tool usage for learning
	async addToolMessage(sessionId, toolMessage) {
		try {
			// Add to regular memory layers
			await this.addMessage(sessionId, toolMessage);

			// Also store in LTM for tool usage pattern learning
			if (toolMessage.tool_call_id && toolMessage.content) {
				const toolData = JSON.parse(toolMessage.content);
				await this.ltm.storeToolUsage(
					sessionId,
					toolMessage.tool_call_id,
					{},
					toolData,
					true
				);
			}
		} catch (error) {
			console.error("Error adding tool message:", error);
			throw error;
		}
	}

	// Get tool usage patterns for better tool selection
	async getToolUsagePatterns(query, toolName) {
		try {
			return await this.ltm.searchSimilarToolUsage(query, toolName);
		} catch (error) {
			console.error("Error getting tool usage patterns:", error);
			return [];
		}
	}

	// Trim short-term memory
	async trimSTM(sessionId) {
		try {
			const history = await this.stm.getHistory(sessionId);
			if (history && history.length > this.maxSTMMessages) {
				const trimmed = history.slice(-this.maxSTMMessages);
				await this.stm.clear(sessionId);
				for (const msg of trimmed) {
					await this.stm.addMessage(sessionId, msg);
				}
			}
		} catch (error) {
			console.error("Error trimming STM:", error);
		}
	}

	// Clear session memory
	async clearSession(sessionId) {
		try {
			await this.stm.clear(sessionId);
			await this.mtm.deleteSession(sessionId);
			// Note: We don't clear LTM as it's for long-term learning
			console.log(`Session ${sessionId} cleared from STM and MTM`);
		} catch (error) {
			console.error("Error clearing session:", error);
		}
	}

	// Get memory statistics
	async getMemoryStats(sessionId) {
		try {
			const stmHistory = await this.stm.getHistory(sessionId);
			const mtmHistory = await this.mtm.getChatContext(sessionId);
			const ltmStats = await this.ltm.getStats();
			const cacheStats = await this.mtm.getCacheStats();

			return {
				shortTermMemory: {
					messageCount: stmHistory ? stmHistory.length : 0,
					maxCapacity: this.maxSTMMessages,
				},
				mediumTermMemory: {
					messageCount: mtmHistory ? mtmHistory.length : 0,
					maxCapacity: this.maxMTMMessages,
					cacheStats,
				},
				longTermMemory: ltmStats,
				sessionId,
				timestamp: new Date().toISOString(),
			};
		} catch (error) {
			console.error("Error getting memory stats:", error);
			return { error: error.message };
		}
	}

	// Health check for all memory layers
	async healthCheck() {
		try {
			const mtmHealth = await this.mtm.healthCheck();
			const ltmHealth = await this.ltm.healthCheck();

			return {
				shortTermMemory: { status: "healthy" }, // In-memory is always healthy
				mediumTermMemory: mtmHealth,
				longTermMemory: ltmHealth,
				overall:
					mtmHealth.status === "healthy" &&
					ltmHealth.status === "healthy"
						? "healthy"
						: "degraded",
				timestamp: new Date().toISOString(),
			};
		} catch (error) {
			return {
				overall: "unhealthy",
				error: error.message,
				timestamp: new Date().toISOString(),
			};
		}
	}

	// Utility method to generate message IDs
	generateMessageId() {
		return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	// Migration method to populate LTM from existing MTM data
	async migrateMTMToLTM(sessionId) {
		try {
			const mtmHistory = await this.mtm.getChatContext(sessionId);
			if (!mtmHistory || mtmHistory.length === 0) return 0;

			let migratedCount = 0;
			for (const message of mtmHistory) {
				if (message.content && message.content.trim()) {
					await this.ltm.storeMessage(
						sessionId,
						message.content,
						message.role,
						{
							messageId: message.id,
							migratedFrom: "MTM",
							originalTimestamp: message.timestamp,
						}
					);
					migratedCount++;
				}
			}

			console.log(
				`Migrated ${migratedCount} messages from MTM to LTM for session ${sessionId}`
			);
			return migratedCount;
		} catch (error) {
			console.error("Error migrating MTM to LTM:", error);
			return 0;
		}
	}
}

module.exports = new HybridMemoryManager();
