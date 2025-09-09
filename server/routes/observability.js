const express = require("express");
const redisCacheService = require("../services/redisCacheService");
const hybridMemoryManager = require("../services/hybridMemoryManager");
const webSocketService = require("../services/webSocketService");
const jobQueueService = require("../services/jobQueueService");
const reactAgentService = require("../services/ReactAgentService");

const router = express.Router();

// System status with enhanced service monitoring
router.get("/status", async (req, res) => {
	try {
		const systemHealth = {
			success: true,
			system: {
				status: "healthy",
				uptime: process.uptime(),
				memory: process.memoryUsage(),
				nodeVersion: process.version,
				environment: process.env.NODE_ENV || "development",
			},
			services: {
				ollama: {
					baseUrl:
						process.env.OLLAMA_BASE_URL || "http://localhost:11434",
					model: process.env.OLLAMA_MODEL || "llama3.1",
				},
				dataSource:
					process.env.DATA_SOURCE_URL ||
					"http://localhost:3001/api/data/",
				redis: await redisCacheService.healthCheck(),
				memory: await hybridMemoryManager.healthCheck(),
				webSocket: webSocketService.healthCheck(),
				jobQueue: await jobQueueService.healthCheck(),
				reactAgent: await reactAgentService.healthCheck(),
			},
			timestamp: new Date().toISOString(),
		};

		// Determine overall health
		const serviceStatuses = Object.values(systemHealth.services);
		const allHealthy = serviceStatuses.every(
			(service) => !service.status || service.status === "healthy"
		);

		systemHealth.system.status = allHealthy ? "healthy" : "degraded";

		res.status(allHealthy ? 200 : 503).json(systemHealth);
		console.log("Enhanced system status requested");
	} catch (error) {
		console.error("Failed to get system status:", error.message);
		res.status(500).json({
			success: false,
			error: "Failed to get system status",
			timestamp: new Date().toISOString(),
		});
	}
});

// Memory analytics endpoint
router.get("/memory/:sessionId", async (req, res) => {
	try {
		const { sessionId } = req.params;
		const memoryStats = await hybridMemoryManager.getMemoryStats(sessionId);

		res.json({
			success: true,
			sessionId,
			memoryStats,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Failed to get memory analytics:", error.message);
		res.status(500).json({
			success: false,
			error: "Failed to get memory analytics",
		});
	}
});

// WebSocket connections monitoring
router.get("/websocket/connections", (req, res) => {
	try {
		const stats = webSocketService.getStats();
		res.json({
			success: true,
			webSocket: stats,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Failed to get WebSocket stats:", error.message);
		res.status(500).json({
			success: false,
			error: "Failed to get WebSocket statistics",
		});
	}
});

// Job queue monitoring
router.get("/jobs/stats", async (req, res) => {
	try {
		const stats = await jobQueueService.getAllQueueStats();
		res.json({
			success: true,
			jobQueues: stats,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Failed to get job queue stats:", error.message);
		res.status(500).json({
			success: false,
			error: "Failed to get job queue statistics",
		});
	}
});

// Cache statistics
router.get("/cache/stats", async (req, res) => {
	try {
		const stats = await redisCacheService.getCacheStats();
		res.json({
			success: true,
			cache: stats,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Failed to get cache stats:", error.message);
		res.status(500).json({
			success: false,
			error: "Failed to get cache statistics",
		});
	}
});

// System metrics for monitoring dashboards
router.get("/metrics", async (req, res) => {
	try {
		const metrics = {
			system: {
				uptime: process.uptime(),
				memory: process.memoryUsage(),
				cpu: process.cpuUsage(),
				nodeVersion: process.version,
				pid: process.pid,
			},
			services: {
				redis: await redisCacheService.getCacheStats(),
				webSocket: webSocketService.getStats(),
				jobQueue: await jobQueueService.getAllQueueStats(),
				memory: await hybridMemoryManager.healthCheck(),
			},
			timestamp: new Date().toISOString(),
		};

		res.json({
			success: true,
			metrics,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Failed to get system metrics:", error.message);
		res.status(500).json({
			success: false,
			error: "Failed to get system metrics",
		});
	}
});

// Clear cache endpoint
router.post("/cache/clear", async (req, res) => {
	try {
		const result = await redisCacheService.flushAll();
		res.json({
			success: result,
			message: result
				? "Cache cleared successfully"
				: "Failed to clear cache",
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Failed to clear cache:", error.message);
		res.status(500).json({
			success: false,
			error: "Failed to clear cache",
		});
	}
});

// Job queue management
router.post("/jobs/:queueName/pause", async (req, res) => {
	try {
		const { queueName } = req.params;
		const result = await jobQueueService.pauseQueue(queueName);
		res.json({
			success: result,
			message: result
				? `Queue ${queueName} paused`
				: `Failed to pause queue ${queueName}`,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Failed to pause queue:", error.message);
		res.status(500).json({
			success: false,
			error: "Failed to pause queue",
		});
	}
});

router.post("/jobs/:queueName/resume", async (req, res) => {
	try {
		const { queueName } = req.params;
		const result = await jobQueueService.resumeQueue(queueName);
		res.json({
			success: result,
			message: result
				? `Queue ${queueName} resumed`
				: `Failed to resume queue ${queueName}`,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Failed to resume queue:", error.message);
		res.status(500).json({
			success: false,
			error: "Failed to resume queue",
		});
	}
});

module.exports = router;
