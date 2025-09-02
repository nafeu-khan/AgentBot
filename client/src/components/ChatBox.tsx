"use client";

import { useState, useRef, useEffect } from "react";
import { Send, RefreshCw, AlertTriangle, Clock, Database } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message } from "../types/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function ChatBox() {
	const [messages, setMessages] = useState<Message[]>([
		{
			id: "1",
			role: "assistant",
			content: ` Hello! I'm your Energy Demand AI Assistant. I analyze real-time energy demand data to provide you with insights and answer your questions.

Here's what I can help you with:
- **Latest demand data**: "What's the current energy demand?"
- **Trend analysis**: "How has demand changed in the last 30 seconds?"
- **Data insights**: "What patterns do you see in the data?"
- **Fresh data checks**: I always use the most recent data available

I fetch live data every few seconds and will warn you if the data isn't fresh. Ask me anything about energy demand!`,
			timestamp: new Date(),
		},
	]);

	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [dataStatus, setDataStatus] = useState<any>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	const fetchStatus = async () => {
		try {
			const response = await fetch(`${API_URL}/api/chat/status`);
			if (response.ok) {
				const status = await response.json();
				setDataStatus(status.status);
			}
		} catch (error) {
			console.error("Failed to fetch status:", error);
		}
	};

	useEffect(() => {
		fetchStatus();
		const interval = setInterval(
			fetchStatus,
			parseInt(process.env.NEXT_PUBLIC_STATUS_CHECK_INTERVAL || "600") *
				1000
		);
		return () => clearInterval(interval);
	}, []);

	async function sendMessage(
		message: string,
		onToken: (t: string) => void,
		onComplete?: (meta: any) => void
	) {
		const response = await fetch(`${API_URL}/api/chat/`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ message }),
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		console.log("Response received, starting to read stream...", response);
		const reader = response.body!.getReader();
		const decoder = new TextDecoder("utf-8");
		let buffer = "";

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });

			const lines = buffer.split("\n");
			buffer = lines.pop() || "";

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed) continue;

				// support "data: " SSE-like chunks or raw token chunks
				const payload = trimmed.startsWith("data: ")
					? trimmed.slice(6).trim()
					: trimmed;

				if (!payload) continue;

				try {
					const obj = JSON.parse(payload);
					if (obj.type === "token" && obj.content) {
						onToken(obj.content);
					} else if (obj.type === "complete") {
						onComplete?.(obj.metadata ?? obj);
					} else if (obj.type === "error") {
						onToken(obj.content ?? "An error occurred");
					}
				} catch {
					onToken(payload);
				}
			}
		}

		const remaining = buffer.trim();
		if (remaining) {
			try {
				const obj = JSON.parse(remaining);
				if (obj.type === "token" && obj.content) onToken(obj.content);
				else if (obj.type === "complete")
					onComplete?.(obj.metadata ?? obj);
			} catch {
				onToken(remaining);
			}
		}
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim() || isLoading) return;

		const userMessage: Message = {
			id: Date.now().toString(),
			role: "user",
			content: input.trim(),
			timestamp: new Date(),
		};

		const userInput = input.trim();
		setMessages((prev) => [...prev, userMessage]);
		setInput("");
		setIsLoading(true);

		const assistantMessageId = (Date.now() + 1).toString();
		const assistantMessage: Message = {
			id: assistantMessageId,
			role: "assistant",
			content: "",
			timestamp: new Date(),
		};

		setMessages((prev) => [...prev, assistantMessage]);

		try {
			let accumulatedContent = "";

			await sendMessage(
				userInput,
				(token) => {
					accumulatedContent += token;
					setMessages((prev) =>
						prev.map((msg) =>
							msg.id === assistantMessageId
								? { ...msg, content: accumulatedContent }
								: msg
						)
					);
				},
				(meta) => {
					setMessages((prev) =>
						prev.map((msg) =>
							msg.id === assistantMessageId
								? {
										...msg,
										metadata: {
											...meta,
											toolsUsed: meta.toolsUsed,
											sessionId: meta.sessionId,
										},
								  }
								: msg
						)
					);
				}
			);
		} catch (error) {
			console.error("Streaming error:", error);
			setMessages((prev) =>
				prev.map((msg) =>
					msg.id === assistantMessageId
						? {
								...msg,
								content:
									"Sorry, I encountered an error while processing your request. Please try again.",
						  }
						: msg
				)
			);
		} finally {
			setIsLoading(false);
		}
	};

	// Refresh data manually
	const handleRefresh = async () => {
		try {
			const response = await fetch(`${API_URL}/api/chat/refresh`, {
				method: "POST",
			});
			if (response.ok) {
				fetchStatus();
				const refreshMessage: Message = {
					id: Date.now().toString(),
					role: "assistant",
					content:
						"🔄 Data refreshed successfully! I now have the latest energy demand information.",
					timestamp: new Date(),
				};
				setMessages((prev) => [...prev, refreshMessage]);
			}
		} catch (error) {
			console.error("Failed to refresh data:", error);
		}
	};

	return (
		<div className="flex flex-col h-full bg-white">
			{/* Data status bar */}
			{dataStatus && (
				<div
					className={`px-4 py-2 text-sm border-b ${
						dataStatus.dataService?.isFresh
							? "bg-green-50 text-green-800 border-green-200"
							: "bg-yellow-50 text-yellow-800 border-yellow-200"
					}`}
				>
					<div className="flex items-center justify-between">
						<div className="flex items-center space-x-2">
							<Database className="w-4 h-4" />
							<span>
								{dataStatus.dataService?.isFresh
									? " Data is fresh"
									: " Data may be stale"}
							</span>
							{dataStatus.dataService?.lastFetch && (
								<span className="text-xs opacity-75">
									Last updated:{" "}
									{new Date(
										dataStatus.dataService.lastFetch
									).toLocaleTimeString()}
								</span>
							)}
						</div>
						<button
							onClick={handleRefresh}
							className="flex items-center space-x-1 px-2 py-1 text-xs bg-white bg-opacity-50 hover:bg-opacity-75 rounded transition-colors"
						>
							<RefreshCw className="w-3 h-3" />
							<span>Refresh</span>
						</button>
					</div>
				</div>
			)}

			<div className="flex-1 overflow-y-auto p-4 space-y-4">
				{messages.map((message) => (
					<div
						key={message.id}
						className={`flex ${
							message.role === "user"
								? "justify-end"
								: "justify-start"
						}`}
					>
						<div
							className={`max-w-3xl rounded-lg px-4 py-3 ${
								message.role === "user"
									? "bg-blue-600 text-white"
									: "bg-gray-100 text-gray-900"
							}`}
						>
							{message.role === "assistant" ? (
								<div className="chat-message">
									<ReactMarkdown remarkPlugins={[remarkGfm]}>
										{message.content}
									</ReactMarkdown>
								</div>
							) : (
								<p className="whitespace-pre-wrap">
									{message.content}
								</p>
							)}

							{/* Message metadata */}
							<div
								className={`flex items-center justify-between mt-2 pt-2 border-t ${
									message.role === "user"
										? "border-blue-500"
										: "border-gray-200"
								}`}
							>
								<span
									className={`text-xs ${
										message.role === "user"
											? "text-blue-100"
											: "text-gray-500"
									}`}
								>
									{message.timestamp.toLocaleTimeString()}
								</span>

								{message.metadata &&
									message.role === "assistant" && (
										<div className="flex items-center space-x-2 text-xs text-gray-500">
											{message.metadata.ageInSeconds !==
												undefined && (
												<span className="flex items-center space-x-1">
													<Clock className="w-3 h-3" />
													<span>
														Data:{" "}
														{
															message.metadata
																.ageInSeconds
														}
														s old
													</span>
												</span>
											)}
											{!message.metadata.isFresh && (
												<span className="flex items-center space-x-1 text-yellow-600">
													<AlertTriangle className="w-3 h-3" />
													<span>Stale</span>
												</span>
											)}
											{message.metadata
												.processingTime && (
												<span>
													{" "}
													{
														message.metadata
															.processingTime
													}
													ms
												</span>
											)}
										</div>
									)}
							</div>
						</div>
					</div>
				))}

				{/* Loading indicator */}
				{isLoading && (
					<div className="flex justify-start">
						<div className="bg-gray-100 rounded-lg px-4 py-3">
							<div className="typing-indicator">
								<div
									className="typing-dot"
									style={
										{
											"--delay": "0ms",
										} as React.CSSProperties
									}
								></div>
								<div
									className="typing-dot"
									style={
										{
											"--delay": "150ms",
										} as React.CSSProperties
									}
								></div>
								<div
									className="typing-dot"
									style={
										{
											"--delay": "300ms",
										} as React.CSSProperties
									}
								></div>
							</div>
						</div>
					</div>
				)}

				<div ref={messagesEndRef} />
			</div>

			<form
				onSubmit={handleSubmit}
				className="p-4 border-t border-gray-200"
			>
				<div className="flex space-x-2">
					<input
						type="text"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder="Ask about energy demand data..."
						className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						disabled={isLoading}
					/>
					<button
						type="submit"
						disabled={isLoading || !input.trim()}
						className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
					>
						<Send className="w-4 h-4" />
						<span className="hidden sm:inline">Send</span>
					</button>
				</div>

				{/* Quick suggestions */}
				<div className="mt-2 flex flex-wrap gap-2">
					{[
						"What's the latest energy demand in our power grid?",
						"How has demand changed recently?",
						"What is the current weather in Dhaka",
						"Tell about Sincos Automation Technologies Ltd.?",
					].map((suggestion) => (
						<button
							key={suggestion}
							onClick={() => setInput(suggestion)}
							className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-600 transition-colors"
							disabled={isLoading}
						>
							{suggestion}
						</button>
					))}
				</div>
			</form>
		</div>
	);
}
