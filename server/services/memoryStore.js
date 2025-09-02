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
}

module.exports = { InMemoryStore };
