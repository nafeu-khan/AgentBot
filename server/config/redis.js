const redis = require("redis");

class RedisConfig {
	constructor() {
		this.client = null;
		this.pubClient = null;
		this.subClient = null;
		this.isConnected = false;
	}

	async connect() {
		try {
			const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

			this.client = redis.createClient({
				url: redisUrl,
				socket: {
					reconnectStrategy: (retries) => {
						if (retries > 10) {
							console.error(
								"Redis: Maximum retry attempts exceeded"
							);
							return false;
						}
						const delay = Math.min(retries * 100, 3000);
						console.log(
							`Redis: Retrying connection in ${delay}ms (attempt ${retries})`
						);
						return delay;
					},
				},
			});

			// Pub/Sub clients
			this.pubClient = this.client.duplicate();
			this.subClient = this.client.duplicate();

			await this.client.connect();
			await this.pubClient.connect();
			await this.subClient.connect();

			this.isConnected = true;
			console.log("Redis connected successfully");

			this.client.on("error", (err) => {
				console.error("Redis Client Error:", err);
				this.isConnected = false;
			});

			this.client.on("reconnecting", () => {
				console.log("Redis Client Reconnecting...");
			});

			this.client.on("ready", () => {
				console.log("Redis Client Ready");
				this.isConnected = true;
			});
		} catch (error) {
			console.error("Failed to connect to Redis:", error);
			this.isConnected = false;
		}
	}

	async disconnect() {
		try {
			if (this.client) await this.client.disconnect();
			if (this.pubClient) await this.pubClient.disconnect();
			if (this.subClient) await this.subClient.disconnect();
			this.isConnected = false;
			console.log("Redis disconnected");
		} catch (error) {
			console.error("Error disconnecting Redis:", error);
		}
	}

	getClient() {
		return this.client;
	}

	getPubClient() {
		return this.pubClient;
	}

	getSubClient() {
		return this.subClient;
	}

	isHealthy() {
		return this.isConnected && this.client && this.client.isOpen;
	}
}

module.exports = new RedisConfig();
