const { Server } = require("socket.io");
const redisCacheService = require("./redisCacheService");
const { v4: uuidv4 } = require("uuid");

class WebSocketService {
	constructor() {
		this.io = null;
		this.connectedClients = new Map();
		this.isInitialized = false;
	}

	initialize(httpServer) {
		try {
			this.io = new Server(httpServer, {
				cors: {
					origin: process.env.FRONTEND_URL || "http://localhost:3000",
					methods: ["GET", "POST"],
					allowedHeaders: ["Content-Type", "Authorization"],
					credentials: true,
				},
				transports: ["websocket", "polling"],
				pingTimeout: 60000,
				pingInterval: 25000,
			});

			this.setupEventHandlers();
			this.setupRedisSubscription();
			this.isInitialized = true;

			console.log("WebSocket service initialized");
		} catch (error) {
			console.error("Failed to initialize WebSocket service:", error);
		}
	}

        // Send chat completion via WebSocket
	async sendChatComplete(sessionId, response, toolsUsed = [], metadata = {}) {
		try {
			const message = {
				sessionId,
				type: "complete",
				response,
				toolsUsed,
				metadata,
				timestamp: new Date().toISOString(),
			};

			// Publish to Redis
			await redisCacheService.publishMessage("chat_complete", message);

			// Also broadcast directly
			this.broadcastToSession(sessionId, "chat_complete", message);
		} catch (error) {
			console.error("Error sending chat complete:", error);
		}
	}

	setupEventHandlers() {
		this.io.on("connection", (socket) => {
			console.log("Client connected:", socket.id);

			// Handle client joining a session
			socket.on("join_session", async (data) => {
				try {
					const { sessionId, userId } = data;
					const clientInfo = {
						socketId: socket.id,
						sessionId,
						userId,
						connectedAt: new Date().toISOString(),
						lastActivity: new Date().toISOString(),
					};

					// Store client info
					this.connectedClients.set(socket.id, clientInfo);

					// Map socket to session in Redis
					await redisCacheService.mapSocketToSession(
						socket.id,
						sessionId
					);

					// Join socket room for the session
					socket.join(`session_${sessionId}`);

					// Notify client of successful join
					socket.emit("session_joined", {
						sessionId,
						socketId: socket.id,
						timestamp: new Date().toISOString(),
					});

					console.log(
						`Client ${socket.id} joined session ${sessionId}`
					);
				} catch (error) {
					console.error("Error handling join_session:", error);
					socket.emit("error", { message: "Failed to join session" });
				}
			});

			// Handle chat message initiation
			socket.on("start_chat", async (data) => {
				try {
					const { message, sessionId } = data;
					const clientInfo = this.connectedClients.get(socket.id);

					if (!clientInfo || clientInfo.sessionId !== sessionId) {
						socket.emit("error", { message: "Invalid session" });
						return;
					}

					// Update last activity
					clientInfo.lastActivity = new Date().toISOString();

					// Emit acknowledgment that chat has started
					socket.emit("chat_started", {
						sessionId,
						messageId: uuidv4(),
						timestamp: new Date().toISOString(),
					});

					console.log(`Chat started for session ${sessionId}`);
				} catch (error) {
					console.error("Error handling start_chat:", error);
					socket.emit("error", { message: "Failed to start chat" });
				}
			});

			// Handle typing indicators
			socket.on("typing_start", (data) => {
				const { sessionId } = data;
				socket.to(`session_${sessionId}`).emit("user_typing", {
					socketId: socket.id,
					sessionId,
					timestamp: new Date().toISOString(),
				});
			});

			socket.on("typing_stop", (data) => {
				const { sessionId } = data;
				socket.to(`session_${sessionId}`).emit("user_stopped_typing", {
					socketId: socket.id,
					sessionId,
					timestamp: new Date().toISOString(),
				});
			});

			// Handle disconnection
			socket.on("disconnect", async (reason) => {
				console.log(
					`Client disconnected: ${socket.id}, reason: ${reason}`
				);
				await this.handleDisconnection(socket.id);
			});

			// Handle manual leave session
			socket.on("leave_session", async (data) => {
				const { sessionId } = data;
				await this.handleLeaveSession(socket.id, sessionId);
			});

			// Handle ping for keepalive
			socket.on("ping", () => {
				socket.emit("pong", { timestamp: new Date().toISOString() });
			});
		});
	}

	async setupRedisSubscription() {
		try {
			// Subscribe to streaming tokens
			await redisCacheService.subscribe("chat_tokens", (message) => {
				this.broadcastToSession(
					message.sessionId,
					"token_stream",
					message
				);
			});

			// Subscribe to chat completion
			await redisCacheService.subscribe("chat_complete", (message) => {
				this.broadcastToSession(
					message.sessionId,
					"chat_complete",
					message
				);
			});

			// Subscribe to tool execution updates
			await redisCacheService.subscribe("tool_execution", (message) => {
				this.broadcastToSession(
					message.sessionId,
					"tool_execution",
					message
				);
			});

			// Subscribe to system notifications
			await redisCacheService.subscribe(
				"system_notification",
				(message) => {
					if (message.sessionId) {
						this.broadcastToSession(
							message.sessionId,
							"system_notification",
							message
						);
					} else {
						this.broadcastToAll("system_notification", message);
					}
				}
			);

			console.log("Redis pub/sub subscriptions established");
		} catch (error) {
			console.error("Error setting up Redis subscriptions:", error);
		}
	}

	// Broadcast message to all clients in a session
	broadcastToSession(sessionId, event, data) {
		if (!this.io) return;

		this.io.to(`session_${sessionId}`).emit(event, {
			...data,
			timestamp: new Date().toISOString(),
		});
	}

	// Broadcast to all connected clients
	broadcastToAll(event, data) {
		if (!this.io) return;

		this.io.emit(event, {
			...data,
			timestamp: new Date().toISOString(),
		});
	}

	// Send message to specific socket
	sendToSocket(socketId, event, data) {
		if (!this.io) return;

		this.io.to(socketId).emit(event, {
			...data,
			timestamp: new Date().toISOString(),
		});
	}

	// Handle client disconnection
	async handleDisconnection(socketId) {
		try {
			const clientInfo = this.connectedClients.get(socketId);
			if (clientInfo) {
				// Remove from Redis mapping
				await redisCacheService.removeSocketMapping(socketId);

				// Notify session about disconnection
				if (clientInfo.sessionId) {
					this.broadcastToSession(
						clientInfo.sessionId,
						"client_disconnected",
						{
							socketId,
							sessionId: clientInfo.sessionId,
							disconnectedAt: new Date().toISOString(),
						}
					);
				}
			}

			// Remove from local tracking
			this.connectedClients.delete(socketId);
		} catch (error) {
			console.error("Error handling disconnection:", error);
		}
	}

	// Handle leave session
	async handleLeaveSession(socketId, sessionId) {
		try {
			const clientInfo = this.connectedClients.get(socketId);
			if (clientInfo && clientInfo.sessionId === sessionId) {
				// Remove from session room
				const socket = this.io.sockets.sockets.get(socketId);
				if (socket) {
					socket.leave(`session_${sessionId}`);
				}

				// Update client info
				clientInfo.sessionId = null;
				clientInfo.leftAt = new Date().toISOString();

				// Remove Redis mapping
				await redisCacheService.removeSocketMapping(socketId);

				// Notify session
				this.broadcastToSession(sessionId, "client_left_session", {
					socketId,
					sessionId,
					leftAt: new Date().toISOString(),
				});

				console.log(`Client ${socketId} left session ${sessionId}`);
			}
		} catch (error) {
			console.error("Error handling leave session:", error);
		}
	}

	// Get connected clients for a session
	getSessionClients(sessionId) {
		const sessionClients = Array.from(
			this.connectedClients.values()
		).filter((client) => client.sessionId === sessionId);
		return sessionClients;
	}

	// Get all connected clients
	getAllClients() {
		return Array.from(this.connectedClients.values());
	}

	// Send streaming token via WebSocket
	async streamToken(sessionId, token, metadata = {}) {
		try {
			const message = {
				sessionId,
				type: "token",
				content: token,
				metadata,
				timestamp: new Date().toISOString(),
			};

			// Publish to Redis for scaling across multiple server instances
			await redisCacheService.publishMessage("chat_tokens", message);

			// Also broadcast directly if this instance has the connection
			this.broadcastToSession(sessionId, "token_stream", message);
		} catch (error) {
			console.error("Error streaming token:", error);
		}
	}

	// Send tool execution update
	async sendToolExecutionUpdate(sessionId, toolName, status, result = null) {
		try {
			const message = {
				sessionId,
				toolName,
				status, // 'started', 'completed', 'failed'
				result,
				timestamp: new Date().toISOString(),
			};

			await redisCacheService.publishMessage("tool_execution", message);
			this.broadcastToSession(sessionId, "tool_execution", message);
		} catch (error) {
			console.error("Error sending tool execution update:", error);
		}
	}

	// Get service statistics
	getStats() {
		return {
			isInitialized: this.isInitialized,
			connectedClients: this.connectedClients.size,
			clients: Array.from(this.connectedClients.values()).map(
				(client) => ({
					socketId: client.socketId,
					sessionId: client.sessionId,
					connectedAt: client.connectedAt,
					lastActivity: client.lastActivity,
				})
			),
			timestamp: new Date().toISOString(),
		};
	}

	// Health check
	healthCheck() {
		return {
			status: this.isInitialized ? "healthy" : "unhealthy",
			connectedClients: this.connectedClients.size,
			timestamp: new Date().toISOString(),
		};
	}

	// Graceful shutdown
	async shutdown() {
		try {
			if (this.io) {
				// Notify all clients about shutdown
				this.broadcastToAll("server_shutdown", {
					message: "Server is shutting down",
					timestamp: new Date().toISOString(),
				});

				// Close all connections
				this.io.close();
			}

			// Clear client tracking
			this.connectedClients.clear();
			this.isInitialized = false;

			console.log("WebSocket service shut down gracefully");
		} catch (error) {
			console.error("Error during WebSocket shutdown:", error);
		}
	}
}

module.exports = new WebSocketService();
