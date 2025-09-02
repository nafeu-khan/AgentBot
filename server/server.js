require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");

const { errorHandler, requestLogger } = require("./middleware");
const chatRoutes = require("./routes/chat");
const observabilityRoutes = require("./routes/observability");

class Server {
	constructor() {
		this.app = express();
		this.port = process.env.PORT || 5000;

		this.setupMiddleware();
		this.setupRoutes();
		this.setupErrorHandling();
	}
	setupMiddleware() {
		this.app.use(
			helmet({
				contentSecurityPolicy: false, // disable for development
				crossOriginEmbedderPolicy: false,
			})
		);

		this.app.use(
			cors({
				origin: '*',
				// credentials: true,
				methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
				allowedHeaders: ["Content-Type", "Authorization"],
			})
		);
		this.app.use(express.json({ limit: "10mb" }));                                   		// Body parsing middleware
		this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));

		// Request logging
		this.app.use(requestLogger);

		// Morgan  HTTP request logging
		this.app.use(
			morgan("combined", {
				stream: {
					write: (message) => console.log(message.trim()),
				},
			})
		);

		console.log("Middleware configured successfully");
	}

	/* routes */
	setupRoutes() {
		this.app.get("/health", (req, res) => {
			res.json({
				status: "healthy",
				timestamp: new Date().toISOString(),
				uptime: process.uptime(),
				environment: process.env.NODE_ENV || "development",
			});
		});

		this.app.use("/api/chat", chatRoutes);
		this.app.use("/api/observability", observabilityRoutes);

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
			process.exit(1);
		});

		process.on("unhandledRejection", (err) => {
			console.error("Unhandled Promise Rejection:", err);
			process.exit(1);
		});

		console.log("Error handling configured successfully");
	}

	ensureLogsDirectory() {
		const logsDir = path.join(__dirname, "logs");
		if (!fs.existsSync(logsDir)) {
			fs.mkdirSync(logsDir, { recursive: true });
			console.log("Logs directory created");
		}
	}

	/* Start the server */
	start() {
		this.ensureLogsDirectory();

		this.app.listen(this.port, '0.0.0.0', () => {
			console.log(`Server started successfully on port ${this.port}`, {
				port: this.port,
				host: '0.0.0.0',
				localIP: '150.150.50.193',
				environment: process.env.NODE_ENV || "development",
				pid: process.pid,
				nodeVersion: process.version,
			});

			// console.log("Server configuration:", {
			// 	frontendUrl:
			// 		process.env.FRONTEND_URL || "http://0.0.0.0:3000",
			// 	externalAccess: `http://0.0.0.0:${this.port}`,
			// 	dataSource:
			// 		process.env.DATA_SOURCE_URL,
			// 	ollamaModel: process.env.OLLAMA_MODEL || "llama3.1",
			// 	cacheTTL: process.env.CACHE_TTL || "5000ms",
			// });
		});
	}
}



const server = new Server();
server.start();

module.exports = server;
