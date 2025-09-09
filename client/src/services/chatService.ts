import apiService from "./apiService";

export interface ChatMessage {
	id: string;
	role: "user" | "assistant" | "system" | "tool";
	content: string;
	timestamp: Date;
	metadata?: any;
}

export interface Conversation {
	id: string;
	title: string;
	createdAt: string;
	updatedAt: string;
	messageCount: number;
}

export interface ChatResponse {
	success: boolean;
	response: string;
	toolsUsed: string[];
	sessionId: string;
	metadata: {
		timestamp: string;
		success: boolean;
		iterations?: number;
		reasoning?: string;
		userId?: number;
	};
}

export interface StreamToken {
	type: "start" | "token" | "complete" | "error";
	content?: string;
	sessionId?: string;
	timestamp?: string;
	response?: string;
	toolsUsed?: string[];
	metadata?: any;
}

class ChatService {

	async sendMessage(
		message: string,
		conversationId?: string,
		onToken?: (token: string) => void,
		onComplete?: (response: ChatResponse) => void,
		onError?: (error: string) => void
	): Promise<void> {
		const payload: any = { message };

		if (conversationId) {
			payload.sessionId = conversationId;
		}

		try {
			const response = await apiService.stream("/api/chat/", {
				method: "POST",
				body: JSON.stringify(payload),
			});

			const reader = response.body!.getReader();
			const decoder = new TextDecoder("utf-8");
			let buffer = "";

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, {
					stream: true,
				});
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";

				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed) continue;

					// Handle SSE format (data: {...})
					const payload = trimmed.startsWith(
						"data: "
					)
						? trimmed.slice(6).trim()
						: trimmed;

					if (!payload) continue;

					try {
						const data: StreamToken =
							JSON.parse(payload);

						if (
							data.type === "token" &&
							data.content
						) {
							onToken?.(data.content);
						} else if (
							data.type === "complete"
						) {
							const completeResponse: ChatResponse =
								{
									success: true,
									response:
										data.response ||
										"",
									toolsUsed:
										data.toolsUsed ||
										[],
									sessionId:
										data.sessionId ||
										"",
									metadata:
										data.metadata ||
										{},
								};
							onComplete?.(
								completeResponse
							);
						} else if (
							data.type === "error"
						) {
							onError?.(
								data.content ||
									"An error occurred"
							);
						}
					} catch (parseError) {
						onToken?.(payload);
					}
				}
			}

			// Handle any remaining buffer content
			const remaining = buffer.trim();
			if (remaining) {
				try {
					const data: StreamToken =
						JSON.parse(remaining);
					if (
						data.type === "token" &&
						data.content
					) {
						onToken?.(data.content);
					} else if (data.type === "complete") {
						const completeResponse: ChatResponse =
							{
								success: true,
								response:
									data.response ||
									"",
								toolsUsed:
									data.toolsUsed ||
									[],
								sessionId:
									data.sessionId ||
									"",
								metadata:
									data.metadata ||
									{},
							};
						onComplete?.(completeResponse);
					}
				} catch {
					onToken?.(remaining);
				}
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error
					? error.message
					: "Network error occurred";
			onError?.(errorMessage);
		}
	}

	/**
	 * Get user's conversations
	 */
	async getConversations(
		limit = 20,
		offset = 0
	): Promise<{
		success: boolean;
		conversations: Conversation[];
		pagination: {
			limit: number;
			offset: number;
			hasMore: boolean;
		};
	}> {
		return apiService.get(
			`/api/chat/conversations?limit=${limit}&offset=${offset}`
		);
	}

	async createConversation(title?: string): Promise<{
		success: boolean;
		conversationId: string;
		message: string;
	}> {
		return apiService.post("/api/chat/conversations", { title });
	}


	async getConversationById(
		conversationId: string,
		limit = 50,
		offset = 0
	): Promise<{
		success: boolean;
		conversation: Conversation;
		messages: ChatMessage[];
		pagination: {
			limit: number;
			offset: number;
			total: number;
			hasMore: boolean;
		};
	}> {
		return apiService.get(
			`/api/chat/conversations/${conversationId}?limit=${limit}&offset=${offset}`
		);
	}

	async deleteConversation(conversationId: string): Promise<{
		success: boolean;
		message: string;
	}> {
		return apiService.delete(
			`/api/chat/conversations/${conversationId}`
		);
	}

	async getConversationHistory(
		conversationId: string,
		includeRAG = false,
		query = ""
	): Promise<{
		success: boolean;
		sessionId: string;
		messageCount: number;
		history: ChatMessage[];
	}> {
		const params = new URLSearchParams({
			includeRAG: includeRAG.toString(),
			query,
		});

		return apiService.get(
			`/api/chat/memory/${conversationId}/history?${params}`
		);
	}

	async clearConversationMemory(conversationId: string): Promise<{
		success: boolean;
		message: string;
	}> {
		return apiService.delete(`/api/chat/memory/${conversationId}`);
	}


	async getMemoryStats(conversationId: string): Promise<{
		success: boolean;
		sessionId: string;
		memoryStats: any;
	}> {
		return apiService.get(
			`/api/chat/memory/${conversationId}/stats`
		);
	}


	async getStatus(): Promise<{
		success: boolean;
		status: {
			dataService: any;
			cache: any;
			redis: any;
			memory: any;
			webSocket: any;
			server: any;
		};
	}> {
		return apiService.public("/api/chat/status");
	}


	async refreshData(): Promise<{
		success: boolean;
		message: string;
		metadata: any;
	}> {
		return apiService.post("/api/chat/refresh");
	}


	async healthCheck(): Promise<{
		success: boolean;
		health: {
			status: string;
			services: any;
		};
	}> {
		return apiService.public("/api/chat/health");
	}
}

export default new ChatService();
