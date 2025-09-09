const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

class ChromaDBService {
	constructor() {
		this.baseURL = process.env.CHROMA_URL || "http://localhost:8000";
		this.isInitialized = false;
		this.initializationAttempted = false;
	}

	async initialize() {
		if (this.initializationAttempted) {
			return this.isInitialized;
		}

		this.initializationAttempted = true;

		try {
			// Test connection to Python ChromaDB server
			const response = await axios.get(`${this.baseURL}/health`, {
				timeout: 5000,
			});

			if (response.data && response.data.status === "healthy") {
				this.isInitialized = true;
				console.log("✅ ChromaDB server connected successfully");
				console.log(
					`📊 Documents in collection: ${response.data.document_count}`
				);
				return true;
			} else {
				throw new Error("ChromaDB server health check failed");
			}
		} catch (error) {
			console.warn(
				"  ChromaDB server not available, running in degraded mode:",
				error.message
			);
			console.info(" To enable ChromaDB vector storage:");
			console.info(
				"1. Start the Python ChromaDB server: cd chroma-server && ./start.sh"
			);
			console.info(
				"2. Or run: cd chroma-server && python chroma_server.py"
			);
			console.info(
				"3. Server will continue without vector search capabilities"
			);
			this.isInitialized = false;
			return false;
		}
	}

	async ensureInitialized() {
		if (!this.isInitialized) {
			await this.initialize();
		}
		return this.isInitialized;
	}

	// Store conversation message with embedding
	async storeMessage(sessionId, message, role, metadata = {}) {
		try {
			if (!this.isInitialized) {
				console.log("ChromaDB not available, trying to initialize");
				this.ensureInitialized();
			}

			// Validate inputs before sending
			if (!sessionId || typeof sessionId !== "string") {
				throw new Error(`Invalid sessionId: ${sessionId}`);
			}
			if (!message || typeof message !== "string") {
				throw new Error(
					`Invalid message: ${typeof message} - ${message}`
				);
			}
			if (!role || typeof role !== "string") {
				throw new Error(`Invalid role: ${role}`);
			}

			const requestData = {
				session_id: sessionId,
				message: message,
				role: role,
				metadata: metadata || {},
			};

			console.log("Storing message in ChromaDB:", {
				sessionId,
				messageLength: message.length,
				role,
				metadata,
			});

			const response = await axios.post(
				`${this.baseURL}/store-message`,
				requestData,
				{
					timeout: 10000,
				}
			);

			if (response.data && response.data.success) {
				console.log(
					"Message stored in ChromaDB:",
					response.data.message_id
				);
				return response.data.message_id;
			} else {
				throw new Error("Failed to store message");
			}
		} catch (error) {
			console.error("Error storing message in ChromaDB:", error.message);
			return null;
		}
	}

	// Retrieve similar messages for RAG
	async searchSimilarMessages(query, sessionId, limit = 5) {
		try {
			if (!this.isInitialized) {
				console.log(
					"ChromaDB not available, returning empty search results"
				);
				return [];
			}

			const response = await axios.post(
				`${this.baseURL}/search-messages`,
				{
					query: query,
					session_id: sessionId,
					limit: limit,
				},
				{
					timeout: 10000,
				}
			);

			if (response.data && response.data.success) {
				return response.data.results || [];
			} else {
				throw new Error("Failed to search messages");
			}
		} catch (error) {
			console.error("Error searching similar messages:", error.message);
			return [];
		}
	}

	// Get collection statistics	// Store tool usage for learning patterns
	async storeToolUsage(sessionId, toolName, args, result, success = true) {
		try {
			if (!this.isInitialized) {
				console.log(
					"ChromaDB not available, skipping tool usage storage"
				);
				return null;
			}

			const response = await axios.post(
				`${this.baseURL}/store-tool-usage`,
				{
					session_id: sessionId,
					tool_name: toolName,
					args: args,
					result: result,
					success: success,
				},
				{
					timeout: 10000,
				}
			);

			if (response.data && response.data.success) {
				console.log(
					"Tool usage stored in ChromaDB:",
					response.data.tool_id
				);
				return response.data.tool_id;
			} else {
				throw new Error("Failed to store tool usage");
			}
		} catch (error) {
			console.error("Error storing tool usage:", error.message);
			return null;
		}
	}

	// Search for similar tool usage patterns
	async searchSimilarToolUsage(query, toolName, limit = 3) {
		try {
			if (!this.isInitialized) {
				console.log(
					"ChromaDB not available, returning empty tool usage results"
				);
				return [];
			}

			const response = await axios.post(
				`${this.baseURL}/search-tool-usage`,
				{
					query: query,
					tool_name: toolName,
					limit: limit,
				},
				{
					timeout: 10000,
				}
			);

			if (response.data && response.data.success) {
				return response.data.results || [];
			} else {
				throw new Error("Failed to search tool usage");
			}
		} catch (error) {
			console.error("Error searching similar tool usage:", error.message);
			return [];
		}
	}

	// Get collection statistics
	async getStats() {
		try {
			if (!this.isInitialized) {
				return {
					error: "ChromaDB not available",
					isInitialized: false,
					timestamp: new Date().toISOString(),
				};
			}

			const response = await axios.get(`${this.baseURL}/stats`, {
				timeout: 5000,
			});

			if (response.data && response.data.success) {
				return {
					totalDocuments: response.data.total_documents,
					collectionName: response.data.collection_name,
					isInitialized: this.isInitialized,
					timestamp: response.data.timestamp,
				};
			} else {
				throw new Error("Failed to get stats");
			}
		} catch (error) {
			console.error("Error getting ChromaDB stats:", error.message);
			return {
				error: error.message,
				isInitialized: this.isInitialized,
				timestamp: new Date().toISOString(),
			};
		}
	}

	// Health check
	async healthCheck() {
		try {
			if (!this.isInitialized) {
				return {
					status: "degraded",
					error: "ChromaDB server not available - running in degraded mode",
					timestamp: new Date().toISOString(),
				};
			}

			const response = await axios.get(`${this.baseURL}/health`, {
				timeout: 5000,
			});

			if (response.data && response.data.status === "healthy") {
				return {
					status: "healthy",
					documentCount: response.data.document_count,
					collectionName: response.data.collection_name,
					timestamp: response.data.timestamp,
				};
			} else {
				throw new Error("Health check failed");
			}
		} catch (error) {
			return {
				status: "unhealthy",
				error: error.message,
				timestamp: new Date().toISOString(),
			};
		}
	}

	// Reset collection (use with caution)
	async resetCollection() {
		try {
			if (!this.isInitialized) {
				console.log("ChromaDB not available, cannot reset collection");
				return false;
			}

			const response = await axios.post(
				`${this.baseURL}/reset`,
				{},
				{
					timeout: 10000,
				}
			);

			if (response.data && response.data.success) {
				console.log("ChromaDB collection reset successfully");
				return true;
			} else {
				throw new Error("Failed to reset collection");
			}
		} catch (error) {
			console.error(
				"Error resetting ChromaDB collection:",
				error.message
			);
			return false;
		}
	}
}

module.exports = new ChromaDBService();
