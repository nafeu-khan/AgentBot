"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
	Send,
	RefreshCw,
	AlertTriangle,
	Clock,
	Database,
	Lock,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message } from "../types/types";
import { useAuth } from "../contexts/AuthContext";
import { chatService } from "../services";

interface ChatBoxProps {
	conversationId?: string;
}

const WELCOME_MESSAGE_CONTENT = `Hello! I'm your Energy Demand AI Assistant. I analyze real-time energy demand data to provide you with insights and answer your questions.

Here's what I can help you with:
- **Latest demand data**: "What's the current energy demand?"
- **Trend analysis**: "How has demand changed in the last 30 seconds?"
- **Data insights**: "What patterns do you see in the data?"
- **Fresh data checks**: I always use the most recent data available

I fetch live data every few seconds and will warn you if the data isn't fresh. Ask me anything about energy demand!`;

const QUICK_SUGGESTIONS = [
	"What's the latest energy demand in our power grid?",
	"How has demand changed recently?",
	"What is the current weather in Dhaka",
	"Tell about Sincos Automation Technologies Ltd.?",
];

export default function ChatBox({
	conversationId: routeConversationId,
}: ChatBoxProps = {}) {
	const { isAuthenticated, user } = useAuth();
	const router = useRouter();

	// Create welcome message with client-side timestamp to avoid hydration mismatch
	const createWelcomeMessage = useCallback(
		(): Message => ({
			id: "1",
			role: "assistant",
			content: `${WELCOME_MESSAGE_CONTENT}\n\n${
				isAuthenticated
					? `Welcome back, ${user?.username}! Your conversation history is saved and secure.`
					: "Please sign in to save your conversation history and access personalized features."
			}`,
			timestamp: new Date(),
		}),
		[isAuthenticated, user?.username]
	);

	// State management
	const [messages, setMessages] = useState<Message[]>(() => [
		createWelcomeMessage(),
	]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [dataStatus, setDataStatus] = useState<any>(null);
	const [currentConversationId, setCurrentConversationId] = useState<
		string | null
	>(null);
	const [conversations, setConversations] = useState<any[]>([]);
	const [currentConversation, setCurrentConversation] =
		useState<any>(null);
	const [isLoadingConversation, setIsLoadingConversation] =
		useState(false);
	const [showNewConversationDialog, setShowNewConversationDialog] =
		useState(false);
	const [newConversationName, setNewConversationName] = useState("");
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	useEffect(() => {
		if (isAuthenticated) {
			loadUserConversations();
		} else {
			setCurrentConversationId(null);
			setCurrentConversation(null);
			setConversations([]);
		}
		// Update welcome message based on auth state
		setMessages((prev) => [
			createWelcomeMessage(),
			...prev.slice(1),
		]);
	}, [isAuthenticated]);

	useEffect(() => {
		if (
			routeConversationId &&
			routeConversationId !== currentConversationId
		) {
			setCurrentConversationId(routeConversationId);
			setCurrentConversation(null);
			// Clear messages except welcome message when switching conversations
			setMessages([createWelcomeMessage()]);
			if (isAuthenticated) {
				loadConversationHistory(routeConversationId);
			}
		}
	}, [routeConversationId, isAuthenticated, currentConversationId]);

	useEffect(() => {
		fetchStatus();
		const interval = setInterval(
			fetchStatus,
			parseInt(
				process.env.NEXT_PUBLIC_STATUS_CHECK_INTERVAL ||
					"600"
			) * 1000
		);
		return () => clearInterval(interval);
	}, []);

	const loadUserConversations = async () => {
		if (!isAuthenticated) return;

		try {
			const response = await chatService.getConversations();
			if (response.success) {
				setConversations(response.conversations || []);

				// If we have a route conversation ID, ensure it's set as current
				if (routeConversationId) {
					const foundConversation =
						response.conversations.find(
							(conv) =>
								conv.id ===
								routeConversationId
						);
					if (foundConversation) {
						setCurrentConversationId(
							routeConversationId
						);
						setCurrentConversation(
							foundConversation
						);
					}
				}
				// Otherwise, set the most recent conversation if no current conversation
				else if (
					response.conversations.length > 0 &&
					!currentConversationId
				) {
					const mostRecent =
						response.conversations[0];
					setCurrentConversationId(mostRecent.id);
					setCurrentConversation(mostRecent);
					loadConversationHistory(mostRecent.id);
				}
			}
		} catch (error) {
			console.log("Conversations load error", error);
		}
	};

	const loadConversationHistory = async (conversationId: string) => {
		if (!isAuthenticated) return;

		setIsLoadingConversation(true);
		try {
			const response =
				await chatService.getConversationById(
					conversationId
				);
			if (response.success) {
				// Update current conversation details
				setCurrentConversation(response.conversation);

				// Update the conversation in the conversations list if it exists
				setConversations((prev) =>
					prev.map((conv) =>
						conv.id === conversationId
							? response.conversation
							: conv
					)
				);

				const historyMessages =
					response.messages?.map((msg: any) => ({
						id: msg.id,
						role: msg.role,
						content: msg.content,
						timestamp: new Date(
							msg.timestamp
						),
						metadata: msg.metadata,
					})) || [];

				// Replace all messages except the welcome message with conversation history
				setMessages([
					createWelcomeMessage(),
					...historyMessages,
				]);
			}
		} catch (error) {
			// Error loading conversation history handled silently
		} finally {
			setIsLoadingConversation(false);
		}
	};

	const fetchStatus = async () => {
		try {
			const response = await chatService.getStatus();
			if (response.success) {
				setDataStatus(response.status);
			}
		} catch (error) {
			// Error fetching status handled silently
		}
	};

	const startNewConversation = async (conversationName?: string) => {
		if (isAuthenticated) {
			try {
				const name =
					conversationName ||
					newConversationName ||
					"New Conversation";
				const response =
					await chatService.createConversation(
						name
					);

				if (response.success) {
					setCurrentConversationId(
						response.conversationId
					);
					setCurrentConversation(null); // Clear current conversation until loaded
					router.push(
						`/conversation/${response.conversationId}`
					);
					await loadUserConversations();
					setShowNewConversationDialog(false);
					setNewConversationName("");
				}
			} catch (error) {
				// Error creating conversation handled silently
			}
		} else {
			setCurrentConversationId(null);
			setCurrentConversation(null);
		}

		setMessages([createWelcomeMessage()]);
	};

	const handleRefresh = async () => {
		try {
			const response = await chatService.refreshData();
			if (response.success) {
				fetchStatus();
				const refreshMessage: Message = {
					id: Date.now().toString(),
					role: "assistant",
					content: "🔄 Data refreshed successfully! I now have the latest energy demand information.",
					timestamp: new Date(),
				};
				setMessages((prev) => [
					...prev,
					refreshMessage,
				]);
			}
		} catch (error) {
			// Error refreshing data handled silently
		}
	};

	const sendMessage = async (
		message: string,
		onToken: (t: string) => void,
		onComplete?: (meta: any) => void
	) => {
		await chatService.sendMessage(
			message,
			currentConversationId || undefined,
			onToken,
			(response) => {
				if (
					response.sessionId &&
					!currentConversationId
				) {
					setCurrentConversationId(
						response.sessionId
					);
					if (
						isAuthenticated &&
						!routeConversationId
					) {
						router.push(
							`/conversation/${response.sessionId}`
						);
					}
					if (isAuthenticated) {
						loadUserConversations();
					}
				}

				onComplete?.({
					sessionId: response.sessionId,
					toolsUsed: response.toolsUsed,
					...response.metadata,
				});
			}
		);
	};

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
			timestamp: new Date(Date.now() + 1),
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
							msg.id ===
							assistantMessageId
								? {
										...msg,
										content: accumulatedContent,
									}
								: msg
						)
					);
				},
				(meta) => {
					if (
						meta.sessionId &&
						!currentConversationId
					) {
						setCurrentConversationId(
							meta.sessionId
						);
					}

					setMessages((prev) =>
						prev.map((msg) =>
							msg.id ===
							assistantMessageId
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
			// Streaming error handled silently
			setMessages((prev) =>
				prev.map((msg) =>
					msg.id === assistantMessageId
						? {
								...msg,
								content: "Sorry, I encountered an error while processing your request. Please try again.",
							}
						: msg
				)
			);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="flex flex-col h-full bg-white">
			{/* Authentication status bar */}
			{!isAuthenticated && (
				<div className="px-4 py-2 text-sm bg-yellow-50 text-yellow-800 border-b border-yellow-200">
					<div className="flex items-center space-x-2">
						<Lock className="w-4 h-4" />
						<span>
							You're using the app as
							a guest. Sign in to save
							your conversations and
							access personalized
							features.
						</span>
					</div>
				</div>
			)}

			{/* Conversation Management Header */}
			{isAuthenticated && (
				<div className="bg-gray-50 border-b border-gray-200 p-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center space-x-3">
							<div className="relative">
								<select
									value={
										currentConversationId ||
										""
									}
									onChange={(
										e
									) => {
										const conversationId =
											e
												.target
												.value;
										if (
											conversationId &&
											conversationId !==
												currentConversationId
										) {
											setCurrentConversationId(
												conversationId
											);
											setCurrentConversation(
												null
											);
											router.push(
												`/conversation/${conversationId}`
											);
										}
									}}
									disabled={
										isLoadingConversation
									}
									className={`text-sm border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px] ${
										isLoadingConversation
											? "opacity-50 cursor-not-allowed"
											: ""
									}`}>
									<option value="">
										{isLoadingConversation
											? "Loading..."
											: "Select conversation..."}
									</option>
									{conversations.map(
										(
											conv
										) => (
											<option
												key={
													conv.id
												}
												value={
													conv.id
												}>
												{conv.title ||
													`Conversation ${conv.id.slice(0, 8)}`}
											</option>
										)
									)}
								</select>
								{isLoadingConversation && (
									<div className="absolute right-2 top-1/2 transform -translate-y-1/2">
										<div className="animate-spin rounded-full h-3 w-3 border border-gray-400 border-t-transparent"></div>
									</div>
								)}
							</div>
							<div className="flex flex-col">
								<span className="text-xs text-gray-600">
									{currentConversation ? (
										<span className="font-medium">
											{
												currentConversation.title
											}
										</span>
									) : currentConversationId ? (
										isLoadingConversation ? (
											<span className="text-blue-600">
												Loading
												conversation...
											</span>
										) : (
											"Conversation loaded"
										)
									) : (
										"New conversation"
									)}
								</span>
								<span className="text-xs text-blue-600">
									{
										conversations.length
									}{" "}
									conversation
									{conversations.length !==
									1
										? "s"
										: ""}{" "}
									total
								</span>
							</div>
						</div>
						<div className="flex items-center space-x-2">
							<button
								onClick={
									loadUserConversations
								}
								disabled={
									isLoadingConversation
								}
								className="text-xs px-2 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
								Refresh
							</button>
							<button
								onClick={() =>
									setShowNewConversationDialog(
										true
									)
								}
								disabled={
									isLoadingConversation
								}
								className="text-sm px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
								New Chat
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Data status bar */}
			{dataStatus && (
				<div
					className={`px-4 py-2 text-sm border-b ${
						dataStatus.dataService?.isFresh
							? "bg-green-50 text-green-800 border-green-200"
							: "bg-yellow-50 text-yellow-800 border-yellow-200"
					}`}>
					<div className="flex items-center justify-between">
						<div className="flex items-center space-x-2">
							<Database className="w-4 h-4" />
							<span>
								{dataStatus
									.dataService
									?.isFresh
									? "Data is fresh"
									: "Data may be stale"}
							</span>
							{dataStatus.dataService
								?.lastFetch && (
								<span className="text-xs opacity-75">
									Last
									updated:{" "}
									{new Date(
										dataStatus.dataService.lastFetch
									).toLocaleTimeString()}
								</span>
							)}
						</div>
						<button
							onClick={handleRefresh}
							className="flex items-center space-x-1 px-2 py-1 text-xs bg-white bg-opacity-50 hover:bg-opacity-75 rounded transition-colors">
							<RefreshCw className="w-3 h-3" />
							<span>Refresh</span>
						</button>
					</div>
				</div>
			)}

			{/* Messages */}
			<div className="flex-1 overflow-y-auto p-4 space-y-4">
				{/* Conversation loading indicator */}
				{isLoadingConversation && (
					<div className="flex justify-center items-center py-8">
						<div className="flex items-center space-x-2 text-gray-500">
							<div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-blue-600"></div>
							<span className="text-sm">
								Loading
								conversation
								history...
							</span>
						</div>
					</div>
				)}

				{!isLoadingConversation &&
					messages.map((message) => (
						<div
							key={message.id}
							className={`flex ${
								message.role ===
								"user"
									? "justify-end"
									: "justify-start"
							}`}>
							<div
								className={`max-w-3xl rounded-lg px-4 py-3 ${
									message.role ===
									"user"
										? "bg-blue-600 text-white"
										: "bg-gray-100 text-gray-900"
								}`}>
								{message.role ===
								"assistant" ? (
									<div className="chat-message">
										<ReactMarkdown
											remarkPlugins={[
												remarkGfm,
											]}>
											{
												message.content
											}
										</ReactMarkdown>
									</div>
								) : (
									<p className="whitespace-pre-wrap">
										{
											message.content
										}
									</p>
								)}

								{/* Message metadata */}
								<div
									className={`flex items-center justify-between mt-2 pt-2 border-t ${
										message.role ===
										"user"
											? "border-blue-500"
											: "border-gray-200"
									}`}>
									<span
										className={`text-xs ${
											message.role ===
											"user"
												? "text-blue-100"
												: "text-gray-500"
										}`}>
										{message.timestamp.toLocaleTimeString()}
									</span>

									{message.metadata &&
										message.role ===
											"assistant" && (
											<div className="flex items-center space-x-2 text-xs text-gray-500">
												{message
													.metadata
													.ageInSeconds !==
													undefined && (
													<span className="flex items-center space-x-1">
														<Clock className="w-3 h-3" />
														<span>
															Data:{" "}
															{
																message
																	.metadata
																	.ageInSeconds
															}
															seconds
															old
														</span>
													</span>
												)}
												{!message
													.metadata
													.isFresh && (
													<span className="flex items-center space-x-1 text-yellow-600">
														<AlertTriangle className="w-3 h-3" />
														<span>
															Stale
														</span>
													</span>
												)}
												{message
													.metadata
													.processingTime && (
													<span>
														{
															message
																.metadata
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

				{/* Loading indicator for new messages */}
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
									}></div>
								<div
									className="typing-dot"
									style={
										{
											"--delay": "150ms",
										} as React.CSSProperties
									}></div>
								<div
									className="typing-dot"
									style={
										{
											"--delay": "300ms",
										} as React.CSSProperties
									}></div>
							</div>
						</div>
					</div>
				)}

				<div ref={messagesEndRef} />
			</div>

			{/* Input form */}
			<form
				onSubmit={handleSubmit}
				className="p-4 border-t border-gray-200">
				<div className="flex space-x-2">
					<input
						type="text"
						value={input}
						onChange={(e) =>
							setInput(e.target.value)
						}
						placeholder={
							isLoadingConversation
								? "Loading conversation..."
								: "Ask about energy demand data..."
						}
						className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						disabled={
							isLoading ||
							isLoadingConversation
						}
					/>
					<button
						type="submit"
						disabled={
							isLoading ||
							!input.trim() ||
							isLoadingConversation
						}
						className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2">
						<Send className="w-4 h-4" />
						<span className="hidden sm:inline">
							Send
						</span>
					</button>
				</div>

				{/* Quick suggestions */}
				<div className="mt-2 flex flex-wrap gap-2">
					{QUICK_SUGGESTIONS.map((suggestion) => (
						<button
							key={suggestion}
							onClick={() =>
								setInput(
									suggestion
								)
							}
							className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-600 transition-colors"
							disabled={
								isLoading ||
								isLoadingConversation
							}>
							{suggestion}
						</button>
					))}
				</div>
			</form>

			{/* New Conversation Dialog */}
			{showNewConversationDialog && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
					<div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
						<h3 className="text-lg font-semibold mb-4">
							Create New Conversation
						</h3>
						<div className="mb-4">
							<label className="block text-sm font-medium text-gray-700 mb-2">
								Conversation
								Name
							</label>
							<input
								type="text"
								value={
									newConversationName
								}
								onChange={(e) =>
									setNewConversationName(
										e
											.target
											.value
									)
								}
								placeholder="Enter conversation name..."
								className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								autoFocus
								onKeyPress={(
									e
								) => {
									if (
										e.key ===
										"Enter"
									) {
										startNewConversation();
									}
								}}
							/>
						</div>
						<div className="flex space-x-3">
							<button
								onClick={() =>
									startNewConversation()
								}
								className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
								Create
							</button>
							<button
								onClick={() => {
									setShowNewConversationDialog(
										false
									);
									setNewConversationName(
										""
									);
								}}
								className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors">
								Cancel
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
