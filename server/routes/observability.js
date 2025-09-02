const express = require("express");
const router = express.Router();

router.get("/status", async (req, res) => {
	try {
		res.json({
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
			},
			timestamp: new Date().toISOString(),
		});

		console.log("System status requested");
	} catch (error) {
		console.error("Failed to get system status:", error.message);
		res.status(500).json({
			success: false,
			error: "Failed to get system status",
		});
	}
});

module.exports = router;
