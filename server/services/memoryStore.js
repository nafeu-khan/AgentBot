// memoryStore.js
class InMemoryStore {
	constructor() {
		this.map = new Map();
	}

	async get(sessionId) {
		return this.map.get(sessionId) || null;
	}

	async set(sessionId, value) {
		this.map.set(sessionId, value);
	}

	async clear(sessionId) {
		this.map.delete(sessionId);
	}

	// Add message to session history
	async addMessage(sessionId, message) {
		let history = this.map.get(sessionId) || [];
		history.push(message);
		this.map.set(sessionId, history);
		return message;
	}

	// Get conversation history for a session
	async getHistory(sessionId) {
		return this.map.get(sessionId) || [];
	}

	// Remove a specific message by ID
	async removeMessage(sessionId, messageId) {
		let history = this.map.get(sessionId) || [];
		history = history.filter(msg => msg.id !== messageId);
		this.map.set(sessionId, history);
	}

	// Get the last N messages for a session
	async getLastMessages(sessionId, count = 10) {
		const history = this.map.get(sessionId) || [];
		return history.slice(-count);
	}

	// Clear all sessions
	async clearAll() {
		this.map.clear();
	}

	// Get all session IDs
	async getSessionIds() {
		return Array.from(this.map.keys());
	}

	// Get memory usage stats
	async getStats() {
		const sessions = this.map.size;
		let totalMessages = 0;
		
		for (const history of this.map.values()) {
			if (Array.isArray(history)) {
				totalMessages += history.length;
			}
		}

		return {
			totalSessions: sessions,
			totalMessages: totalMessages,
			averageMessagesPerSession: sessions > 0 ? Math.round(totalMessages / sessions) : 0,
			memoryUsage: process.memoryUsage()
		};
	}
}

module.exports = { InMemoryStore };
