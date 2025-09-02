const aiService = require("../services/aiServices");
const dataService = require("../services/dataService");
const LangChainAIService = require("../services/LangChainAIService");
const OllamaService = require("../services/OllamaService");
const MemoryOllamaService = require("../services/memoryOllamaService");
const memoryLangChainService = require("../services/memoryLangChainService");
class ChatController {
	async chat(req, res) {
		try {
			const { message, sessionId } = req.body;
			// if message not found
			if (!message || message.trim().length === 0) {
				return res.status(400).json({
					success: false,
					error: "Message is required",
				});
			}
			console.log(
				"Processing chat message:",
				message.substring(0, 100) + (message.length > 100 ? "..." : "")
			);

			// Using  demo sessionId
			const sessionIdentifier = sessionId || `session-1`;

			res.writeHead(200, {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive", // don't close tcp
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Headers": "Content-Type",
				"Access-Control-Allow-Methods": "POST",
			});

			// const result = await MemoryOllamaService.streamQuery(message, sessionIdentifier, (token) => {
			//         res.write(
			//                 `data: ${JSON.stringify({
			//                         type: "token",
			//                         content: token,
			//                 })}\n\n`
			//         );
			// });
			const result = await memoryLangChainService.streamQuery(
				message,
				sessionIdentifier,
				(token) => {
					res.write(
						`data: ${JSON.stringify({
							type: "token",
							content: token,
						})}\n\n`
					);
				}
			);
                        console.log("Chat result:", result);
			res.write(
				`data: ${JSON.stringify({
					type: "complete",
					response: result.response,
					toolsUsed: result.toolsUsed || [],
					sessionId: sessionIdentifier,
					metadata: {
						timestamp: new Date().toISOString(),
						success: result.success,
					},
				})}\n\n`
			);
			res.end();
		} catch (error) {
			console.error("Chat controller error:", error.message);
			res.write(
				`data: ${JSON.stringify({
					type: "error",
					content: "An error occurred while processing your request.",
					error:
						process.env.NODE_ENV === "development"
							? error.message
							: undefined,
				})}\n\n`
			);
			res.end();
		}
	}


	async getStatus(req, res) {
		try {
			const cacheStats = dataService.getCacheStats();
			const currentData = await dataService
				.getCurrentData()
				.catch(() => null);

			res.json({
				success: true,
				status: {
					dataService: {
						hasData: cacheStats.hasData,
						isFresh: cacheStats.isFresh,
						dataAge: cacheStats.dataAge,
						lastFetch: currentData
							? new Date(currentData.timestamp).toISOString()
							: null,
					},
					cache: {
						keys: cacheStats.keys,
						hits: cacheStats.hits,
						misses: cacheStats.misses,
					},
					server: {
						uptime: process.uptime(),
						memory: process.memoryUsage(),
						timestamp: new Date().toISOString(),
					},
				},
			});
		} catch (error) {
			console.error("Status controller error:", error.message);
			res.status(500).json({
				success: false,
				error: "Failed to get status",
			});
		}
	}

	async refreshData(req, res) {
		try {
			console.log("Manual data refresh requested");
			const freshData = await dataService.getCurrentData(true);

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
			console.error("Refresh data controller error:", error.message);
			res.status(500).json({
				success: false,
				error: "Failed to refresh data",
				message: error.message,
			});
		}
	}
}

module.exports = new ChatController();
