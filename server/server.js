require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");

const { errorHandler, requestLogger } = require("./middleware");
const chatRoutes = require("./routes/chat");
const authRoutes = require("./routes/auth");
const observabilityRoutes = require("./routes/observability");

// Enhanced services
const redisConfig = require("./config/redis");
const webSocketService = require("./services/webSocketService");
const redisCacheService = require("./services/redisCacheService");
const hybridMemoryManager = require("./services/hybridMemoryManager");
const jobQueueService = require("./services/jobQueueService");
const reactAgentService = require("./services/ReactAgentService");

// Database and Authentication
const db = require("./database/connection");

class Server {
	constructor() {
		this.app = express();
		this.port = process.env.PORT || 5000;
		this.isShuttingDown = false;

		this.setupMiddleware();
		this.setupRoutes();
		this.setupErrorHandling();
		this.setupGracefulShutdown();
	}

	setupMiddleware() {
		// Trust proxy for rate limiting and IP detection
		this.app.set("trust proxy", true);

		this.app.use(
			helmet({
				contentSecurityPolicy: false, // disable for development
				crossOriginEmbedderPolicy: false,
			})
		);

		this.app.use(
			cors({
				origin: process.env.CORS_ORIGIN || "*",
				credentials: true,
				methods: [
					"GET",
					"POST",
					"PUT",
					"DELETE",
					"OPTIONS",
				],
				allowedHeaders: [
					"Content-Type",
					"Authorization",
					"Cache-Control",
					"X-Requested-With",
					"Accept",
					"Origin",
				],
			})
		);
		this.app.use(express.json({ limit: "10mb" })); // Body parsing middleware
		this.app.use(
			express.urlencoded({ extended: true, limit: "10mb" })
		);

		// Request logging
		this.app.use(requestLogger);

		// Morgan  HTTP request logging
		this.app.use(
			morgan("combined", {
				stream: {
					write: (message) =>
						console.log(message.trim()),
				},
			})
		);

		console.log("Middleware configured successfully");
	}

	/* routes */
	setupRoutes() {
		this.app.get("/health", async (req, res) => {
			try {
				const health = {
					status: "healthy",
					timestamp: new Date().toISOString(),
					uptime: process.uptime(),
					environment:
						process.env.NODE_ENV ||
						"development",
					services: {
						database: await db.healthCheck(),
						redis: await redisCacheService.healthCheck(),
						memory: await hybridMemoryManager.healthCheck(),
						webSocket: webSocketService.healthCheck(),
						jobQueue: await jobQueueService.healthCheck(),
						reactAgent: await reactAgentService.healthCheck(),
					},
				};

				const overallHealthy = Object.values(
					health.services
				).every(
					(service) =>
						service.status === "healthy" ||
						service.status === "degraded"
				);

				res.status(overallHealthy ? 200 : 503).json(
					health
				);
			} catch (error) {
				res.status(503).json({
					status: "unhealthy",
					error: error.message,
					timestamp: new Date().toISOString(),
				});
			}
		});

		// API Routes
		this.app.use("/api/auth", authRoutes);
		this.app.use("/api/chat", chatRoutes);
		this.app.use("/api/observability", observabilityRoutes);

		// Root endpoint
		this.app.get("/", (req, res) => {
			res.json({
				message: "TaskJS API Server",
				version: "2.0.0",
				features: [
					"Authentication",
					"Chat",
					"Vector Memory",
					"Real-time AI",
				],
				endpoints: {
					auth: "/api/auth",
					chat: "/api/chat",
					observability: "/api/observability",
					health: "/health",
				},
				timestamp: new Date().toISOString(),
			});
		});

		this.app.use("*", (req, res) => {
			res.status(404).json({
				success: false,
				error: "Route not found",
				path: req.originalUrl,
				method: req.method,
			});
		});

		console.log("Routes configured successfully");
	}

	/*error handling*/
	setupErrorHandling() {
		// Global error handler (must be last)
		this.app.use(errorHandler);

		process.on("uncaughtException", (err) => {
			console.error("Uncaught Exception:", err);
			this.gracefulShutdown();
		});

		process.on("unhandledRejection", (err) => {
			console.error("Unhandled Promise Rejection:", err);
			this.gracefulShutdown();
		});

		console.log("Error handling configured successfully");
	}

	setupGracefulShutdown() {
		process.on("SIGTERM", () => {
			console.log(
				"SIGTERM received, starting graceful shutdown..."
			);
			this.gracefulShutdown();
		});

		process.on("SIGINT", () => {
			console.log(
				"SIGINT received, starting graceful shutdown..."
			);
			this.gracefulShutdown();
		});
	}

	async gracefulShutdown() {
		if (this.isShuttingDown) return;
		this.isShuttingDown = true;

		console.log("Starting graceful shutdown...");

		try {
			// Shutdown services in order
			await webSocketService.shutdown();
			await jobQueueService.shutdown();
			await redisConfig.disconnect();
			await db.close();

			console.log("Graceful shutdown completed");
			process.exit(0);
		} catch (error) {
			console.error("Error during graceful shutdown:", error);
			process.exit(1);
		}
	}

	ensureLogsDirectory() {
		const logsDir = path.join(__dirname, "logs");
		if (!fs.existsSync(logsDir)) {
			fs.mkdirSync(logsDir, { recursive: true });
			console.log("Logs directory created");
		}
	}

	async initializeServices() {
		console.log("Initializing enhanced services...");

		try {
			// Initialize Database first (critical service)
			await db.initialize();
		} catch (error) {
			console.error(
				"Failed to initialize Database:",
				error.message
			);
			throw error; // Database is critical, fail if it can't connect
		}

		try {
			// Initialize Redis (required by other services)
			await redisConfig.connect();
		} catch (error) {
			console.error(
				"Failed to initialize Redis:",
				error.message
			);
			throw error; // Redis is critical, fail if it can't connect
		}

		try {
			// Initialize core services with graceful degradation
			await redisCacheService.initialize();
		} catch (error) {
			console.warn(
				"Redis cache service initialization failed:",
				error.message
			);
		}

		try {
			await hybridMemoryManager.initialize();
		} catch (error) {
			console.warn(
				"Hybrid memory manager initialization failed:",
				error.message
			);
		}

		try {
			await reactAgentService.initialize();
		} catch (error) {
			console.warn(
				"React agent service initialization failed:",
				error.message
			);
		}

		try {
			// Initialize WebSocket service (if needed, pass the server instance)
			// webSocketService.initialize(this.app);
		} catch (error) {
			console.warn(
				"WebSocket service initialization failed:",
				error.message
			);
		}

		try {
			// Initialize job queue service
			await jobQueueService.initialize();
			await jobQueueService.schedulePeriodioJobs();
		} catch (error) {
			console.warn(
				"Job queue service initialization failed:",
				error.message
			);
		}

		console.log(
			"Enhanced services initialization completed (some services may be degraded)"
		);
	}

	/* Start the server */
	async start() {
		try {
			this.ensureLogsDirectory();

			// Initialize all enhanced services
			await this.initializeServices();

			this.app.listen(this.port, "0.0.0.0", () => {
				console.log(
					`Server started successfully on port ${this.port}`,
					{
						port: this.port,
						host: "0.0.0.0",
						environment:
							process.env.NODE_ENV ||
							"development",
						pid: process.pid,
						nodeVersion: process.version,
					}
				);
			});
		} catch (error) {
			console.error(" Failed to start server:", error);
			process.exit(1);
		}
	}
}

const server = new Server();
server.start();

module.exports = server;
