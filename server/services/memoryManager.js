const DEFAULT_STATE = () => ({
	messages: [], // chat history [{role, content, ...}]
	updatedAt: Date.now(),
});

class MemoryManager {
	constructor(store, { maxMessages = 30 } = {}) {
		this.store = store;
		this.maxMessages = maxMessages; 
	}

	async _ensure(sessionId) {
		let session = await this.store.get(sessionId);
		if (!session) {
			session = DEFAULT_STATE();
			await this.store.set(sessionId, session);
		}
		return session;
	}

	async getHistory(sessionId) {
		const s = await this._ensure(sessionId);
		return s.messages;
	}

	async appendMessage(sessionId, msg) {
		const s = await this._ensure(sessionId);
		s.messages.push(msg);
		if (s.messages.length > this.maxMessages) {
			s.messages = s.messages.slice(-this.maxMessages);
		}
		s.updatedAt = Date.now();
		await this.store.set(sessionId, s);
	}

	async addToolMessage(sessionId, { tool_call_id, content }) {
		await this.appendMessage(sessionId, { 
			role: "tool",
			tool_call_id,
			content,
		});
	}

	async clearSession(sessionId) {
		await this.store.clear(sessionId);
	}
}

module.exports = { MemoryManager };
