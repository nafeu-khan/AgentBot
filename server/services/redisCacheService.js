const redisConfig = require("../config/redis");

class RedisCacheService {
	constructor() {
		this.client = null;
		this.defaultTTL = process.env.CACHE_TTL || 300;
	}

	async initialize() {
		this.client = redisConfig.getClient();
	}

	async get(key) {
		try {
			if (!this.client) await this.initialize();
			const value = await this.client.get(key);
			if (!value) return null;

			// Try to parse as JSON, return as string if parsing fails
			try {
				return JSON.parse(value);
			} catch (parseError) {
				console.warn(
					"Failed to parse Redis value as JSON:",
					parseError.message
				);
				return value; // Return as string if not valid JSON
			}
		} catch (error) {
			console.error("Redis get error:", error);
			return null;
		}
	}

	async set(key, value, ttl = this.defaultTTL) {
		try {
			if (!this.client) await this.initialize();
			// Handle both string and object values
			const stringValue =
				typeof value === "string" ? value : JSON.stringify(value);
			await this.client.setEx(key, ttl, stringValue);
			return true;
		} catch (error) {
			console.error("Redis set error:", error);
			return false;
		}
	}

	async del(key) {
		try {
			if (!this.client) await this.initialize();
			await this.client.del(key);
			return true;
		} catch (error) {
			console.error("Redis delete error:", error);
			return false;
		}
	}

	async delete(key) {
		return await this.del(key);
	}

	async getKeysByPattern(pattern) {
		try {
			if (!this.client) await this.initialize();
			return await this.client.keys(pattern);
		} catch (error) {
			console.error("Redis getKeysByPattern error:", error);
			return [];
		}
	}

	async deleteMultiple(keys) {
		try {
			if (!this.client) await this.initialize();
			if (keys.length === 0) return true;
			await this.client.del(keys);
			return true;
		} catch (error) {
			console.error("Redis deleteMultiple error:", error);
			return false;
		}
	}

	async delete(key) {
		return await this.del(key);
	}

	async getKeysByPattern(pattern) {
		try {
			if (!this.client) await this.initialize();
			return await this.client.keys(pattern);
		} catch (error) {
			console.error("Redis keys pattern error:", error);
			return [];
		}
	}

	async deleteMultiple(keys) {
		try {
			if (!this.client) await this.initialize();
			if (keys.length === 0) return true;
			await this.client.del(...keys);
			return true;
		} catch (error) {
			console.error("Redis delete multiple error:", error);
			return false;
		}
	}

	async exists(key) {
		try {
			if (!this.client) await this.initialize();
			return await this.client.exists(key);
		} catch (error) {
			console.error("Redis exists error:", error);
			return false;
		}
	}

	async setSession(sessionId, sessionData, ttl = 3600) {
		const key = `session:${sessionId}`;
		return await this.set(key, sessionData, ttl);
	}

	async getSession(sessionId) {
		const key = `session:${sessionId}`;
		return await this.get(key);
	}

	async deleteSession(sessionId) {
		const key = `session:${sessionId}`;
		return await this.del(key);
	}

	async setChatContext(sessionId, context, ttl = 1800) {
		const key = `chat:context:${sessionId}`;
		return await this.set(key, context, ttl);
	}

	async getChatContext(sessionId) {
		const key = `chat:context:${sessionId}`;
		return await this.get(key);
	}

	async incrementRateLimit(userId, window = 60) {
		try {
			if (!this.client) await this.initialize();
			const key = `rate_limit:${userId}:${Math.floor(
				Date.now() / (window * 1000)
			)}`;
			const count = await this.client.incr(key);
			await this.client.expire(key, window);
			return count;
		} catch (error) {
			console.error("Redis rate limit error:", error);
			return 0;
		}
	}

	async cacheToolResult(toolName, args, result, ttl = 300) {
		const key = `tool:${toolName}:${JSON.stringify(args)}`;
		return await this.set(key, result, ttl);
	}

	async getCachedToolResult(toolName, args) {
		const key = `tool:${toolName}:${JSON.stringify(args)}`;
		return await this.get(key);
	}

	async mapSocketToSession(socketId, sessionId) {
		const key = `socket:${socketId}`;
		return await this.set(
			key,
			{ sessionId, connectedAt: Date.now() },
			3600
		);
	}

	async getSessionFromSocket(socketId) {
		const key = `socket:${socketId}`;
		const data = await this.get(key);
		return data ? data.sessionId : null;
	}

	async removeSocketMapping(socketId) {
		const key = `socket:${socketId}`;
		return await this.del(key);
	}

	// Pub/Sub for real-time messaging
	async publishMessage(channel, message) {
		try {
			const pubClient = redisConfig.getPubClient();
			await pubClient.publish(channel, JSON.stringify(message));
			return true;
		} catch (error) {
			console.error("Redis publish error:", error);
			return false;
		}
	}

	async subscribe(channel, callback) {
		try {
			const subClient = redisConfig.getSubClient();
			await subClient.subscribe(channel, (message) => {
				try {
					const parsedMessage = JSON.parse(message);
					callback(parsedMessage);
				} catch (error) {
					console.error("Error parsing subscribed message:", error);
				}
			});
			return true;
		} catch (error) {
			console.error("Redis subscribe error:", error);
			return false;
		}
	}

	// Cache statistics
	async getCacheStats() {
		try {
			if (!this.client) await this.initialize();
			const info = await this.client.info("memory");
			const keyspace = await this.client.info("keyspace");

			return {
				memoryUsed: this.parseRedisInfo(info, "used_memory_human"),
				totalKeys: this.parseRedisInfo(keyspace, "keys"),
				isConnected: redisConfig.isHealthy(),
			};
		} catch (error) {
			console.error("Redis stats error:", error);
			return { error: error.message };
		}
	}

	parseRedisInfo(info, key) {
		const match = info.match(new RegExp(`${key}:(.+)`));
		return match ? match[1] : "unknown";
	}

	// Clear all cache
	async flushAll() {
		try {
			if (!this.client) await this.initialize();
			await this.client.flushAll();
			return true;
		} catch (error) {
			console.error("Redis flush error:", error);
			return false;
		}
	}

	// Health check
	async healthCheck() {
		try {
			if (!this.client) await this.initialize();
			await this.client.ping();
			return { status: "healthy", timestamp: new Date().toISOString() };
		} catch (error) {
			return {
				status: "unhealthy",
				error: error.message,
				timestamp: new Date().toISOString(),
			};
		}
	}
}

module.exports = new RedisCacheService();
