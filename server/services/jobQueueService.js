const Bull = require("bull");
const redisConfig = require("../config/redis");

class JobQueueService {
	constructor() {
		this.queues = new Map();
		this.isInitialized = false;
	}

	async initialize() {
		try {
			const redisClient = redisConfig.getClient();
			const redisOpts = {
				redis: {
					port: process.env.REDIS_PORT || 6379,
					host: process.env.REDIS_HOST || "localhost",
					password: process.env.REDIS_PASSWORD || undefined,
				},
			};

			// Initialize different queues for different job types
			this.queues.set(
				"chat-processing",
				new Bull("chat processing", redisOpts)
			);
			this.queues.set(
				"embedding-generation",
				new Bull("embedding generation", redisOpts)
			);
			this.queues.set(
				"data-refresh",
				new Bull("data refresh", redisOpts)
			);
			this.queues.set(
				"memory-cleanup",
				new Bull("memory cleanup", redisOpts)
			);
			this.queues.set("analytics", new Bull("analytics", redisOpts));

			// Set up job processors
			this.setupJobProcessors();

			this.isInitialized = true;
			console.log(
				"Job Queue Service initialized with",
				this.queues.size,
				"queues"
			);
		} catch (error) {
			console.error("Failed to initialize Job Queue Service:", error);
			this.isInitialized = false;
		}
	}

	setupJobProcessors() {
		// Chat processing queue - for heavy LLM operations
		const chatQueue = this.queues.get("chat-processing");
		chatQueue.process("heavy-reasoning", 3, async (job) => {
			const { sessionId, message, context } = job.data;
			console.log(
				"Processing heavy reasoning job for session:",
				sessionId
			);

			// This would be used for complex multi-step reasoning
			// that doesn't need real-time streaming
			return {
				sessionId,
				processed: true,
				timestamp: new Date().toISOString(),
			};
		});

		// Embedding generation queue - for vector store operations
		const embeddingQueue = this.queues.get("embedding-generation");
		embeddingQueue.process("generate-embeddings", 2, async (job) => {
			const { texts, sessionId } = job.data;
			console.log("Generating embeddings for", texts.length, "texts");

			// Generate embeddings for batch processing
			return {
				sessionId,
				embeddingCount: texts.length,
				completed: true,
			};
		});

		// Data refresh queue - for periodic data updates
		const dataRefreshQueue = this.queues.get("data-refresh");
		dataRefreshQueue.process("refresh-grid-data", 1, async (job) => {
			console.log("Refreshing grid data...");

			// Refresh external data sources
			return {
				refreshed: true,
				timestamp: new Date().toISOString(),
			};
		});

		// Memory cleanup queue - for maintenance tasks
		const memoryCleanupQueue = this.queues.get("memory-cleanup");
		memoryCleanupQueue.process(
			"cleanup-old-conversations",
			1,
			async (job) => {
				const { daysOld = 30 } = job.data;
				console.log(
					"Cleaning up conversations older than",
					daysOld,
					"days"
				);

				// Cleanup old conversation data
				return {
					cleanedUp: true,
					daysOld,
					timestamp: new Date().toISOString(),
				};
			}
		);

		// Analytics queue - for usage analytics and insights
		const analyticsQueue = this.queues.get("analytics");
		analyticsQueue.process("generate-usage-report", 1, async (job) => {
			const { startDate, endDate } = job.data;
			console.log(
				"Generating usage report from",
				startDate,
				"to",
				endDate
			);

			// Generate analytics report
			return {
				reportGenerated: true,
				period: { startDate, endDate },
				timestamp: new Date().toISOString(),
			};
		});

		// Set up event listeners for all queues
		this.queues.forEach((queue, name) => {
			queue.on("completed", (job, result) => {
				console.log(`Job completed in queue ${name}:`, job.id);
			});

			queue.on("failed", (job, error) => {
				console.error(
					`Job failed in queue ${name}:`,
					job.id,
					error.message
				);
			});

			queue.on("stalled", (job) => {
				console.warn(`Job stalled in queue ${name}:`, job.id);
			});
		});
	}

	// Add a job to a specific queue
	async addJob(queueName, jobType, data, options = {}) {
		try {
			if (!this.isInitialized) {
				await this.initialize();
			}

			const queue = this.queues.get(queueName);
			if (!queue) {
				throw new Error(`Queue ${queueName} not found`);
			}

			const defaultOptions = {
				removeOnComplete: 100, // Keep last 100 completed jobs
				removeOnFail: 50, // Keep last 50 failed jobs
				attempts: 3, // Retry failed jobs 3 times
				backoff: {
					type: "exponential",
					delay: 2000,
				},
			};

			const job = await queue.add(jobType, data, {
				...defaultOptions,
				...options,
			});
			console.log(`Job added to ${queueName}:`, job.id);

			return job;
		} catch (error) {
			console.error("Error adding job to queue:", error);
			throw error;
		}
	}

	// Schedule periodic jobs
	async schedulePeriodioJobs() {
		try {
			// Schedule daily memory cleanup
			await this.addJob(
				"memory-cleanup",
				"cleanup-old-conversations",
				{ daysOld: 30 },
				{
					repeat: { cron: "0 2 * * *" }, // Daily at 2 AM
					removeOnComplete: 5,
					removeOnFail: 3,
				}
			);

			// Schedule hourly data refresh
			await this.addJob(
				"data-refresh",
				"refresh-grid-data",
				{},
				{
					repeat: { cron: "0 * * * *" }, // Every hour
					removeOnComplete: 24,
					removeOnFail: 5,
				}
			);

			// Schedule weekly analytics report
			await this.addJob(
				"analytics",
				"generate-usage-report",
				{
					startDate: new Date(
						Date.now() - 7 * 24 * 60 * 60 * 1000
					).toISOString(),
					endDate: new Date().toISOString(),
				},
				{
					repeat: { cron: "0 9 * * 1" }, // Every Monday at 9 AM
					removeOnComplete: 10,
					removeOnFail: 3,
				}
			);

			console.log("Periodic jobs scheduled successfully");
		} catch (error) {
			console.error("Error scheduling periodic jobs:", error);
		}
	}

	// Get queue statistics
	async getQueueStats(queueName) {
		try {
			const queue = this.queues.get(queueName);
			if (!queue) {
				throw new Error(`Queue ${queueName} not found`);
			}

			const [waiting, active, completed, failed, delayed] =
				await Promise.all([
					queue.getWaiting(),
					queue.getActive(),
					queue.getCompleted(),
					queue.getFailed(),
					queue.getDelayed(),
				]);

			return {
				queueName,
				counts: {
					waiting: waiting.length,
					active: active.length,
					completed: completed.length,
					failed: failed.length,
					delayed: delayed.length,
				},
				timestamp: new Date().toISOString(),
			};
		} catch (error) {
			console.error("Error getting queue stats:", error);
			return { error: error.message };
		}
	}

	// Get all queue statistics
	async getAllQueueStats() {
		const stats = {};

		for (const queueName of this.queues.keys()) {
			stats[queueName] = await this.getQueueStats(queueName);
		}

		return {
			queues: stats,
			totalQueues: this.queues.size,
			isInitialized: this.isInitialized,
			timestamp: new Date().toISOString(),
		};
	}

	// Clean up jobs in a queue
	async cleanQueue(queueName, grace = 5000) {
		try {
			const queue = this.queues.get(queueName);
			if (!queue) {
				throw new Error(`Queue ${queueName} not found`);
			}

			await queue.clean(grace, "completed");
			await queue.clean(grace, "failed");

			console.log(`Queue ${queueName} cleaned`);
			return true;
		} catch (error) {
			console.error("Error cleaning queue:", error);
			return false;
		}
	}

	// Pause a queue
	async pauseQueue(queueName) {
		try {
			const queue = this.queues.get(queueName);
			if (!queue) {
				throw new Error(`Queue ${queueName} not found`);
			}

			await queue.pause();
			console.log(`Queue ${queueName} paused`);
			return true;
		} catch (error) {
			console.error("Error pausing queue:", error);
			return false;
		}
	}

	// Resume a queue
	async resumeQueue(queueName) {
		try {
			const queue = this.queues.get(queueName);
			if (!queue) {
				throw new Error(`Queue ${queueName} not found`);
			}

			await queue.resume();
			console.log(`Queue ${queueName} resumed`);
			return true;
		} catch (error) {
			console.error("Error resuming queue:", error);
			return false;
		}
	}

	// Health check
	async healthCheck() {
		try {
			const stats = await this.getAllQueueStats();

			return {
				status: this.isInitialized ? "healthy" : "unhealthy",
				queues: Object.keys(stats.queues).length,
				stats,
				timestamp: new Date().toISOString(),
			};
		} catch (error) {
			return {
				status: "unhealthy",
				error: error.message,
				timestamp: new Date().toISOString(),
			};
		}
	}

	// Graceful shutdown
	async shutdown() {
		try {
			console.log("Shutting down job queues...");

			const shutdownPromises = Array.from(this.queues.values()).map(
				(queue) => queue.close()
			);

			await Promise.all(shutdownPromises);
			this.queues.clear();
			this.isInitialized = false;

			console.log("Job queues shut down successfully");
		} catch (error) {
			console.error("Error shutting down job queues:", error);
		}
	}
}

module.exports = new JobQueueService();
