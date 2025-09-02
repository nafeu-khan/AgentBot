const { ChatOllama } = require("@langchain/ollama");
const {
	HumanMessage,
	AIMessage,
	SystemMessage,
	ToolMessage,
} = require("@langchain/core/messages");
const { tools, availableFunctions } = require("../tools/toolsIndex");
const { MemoryManager } = require("./memoryManager");
const { InMemoryStore } = require("./memoryStore");

const memory = new MemoryManager(new InMemoryStore(), { maxMessages: 40 });

class MemoryLangChainService {
	constructor() {
		this.llm = new ChatOllama({
			baseUrl: "http://localhost:11434",
			model: process.env.OLLAMA_MODEL || "llama3.1:latest",
			temperature: 0.1,
		});

		this.langchainTools = this.convertToLangChainTools(tools);
		this.llmWithTools = this.llm.bindTools(this.langchainTools);

		console.log(
			"MemoryLangChainService initialized with model:",
			this.llm.model
		);
	}

	convertToLangChainTools(ollamaTools) {
		return ollamaTools.map((tool) => ({
			name: tool.function.name,
			description: tool.function.description,
			schema: tool.function.parameters,
		}));
	}

	convertToLangChainMessages(history) {
		return history.map((msg) => {
			switch (msg.role) {
				case "system":
					return new SystemMessage(msg.content);
				case "user":
					return new HumanMessage(msg.content);
				case "assistant":
					if (msg.tool_calls) {
						return new AIMessage({
							content: msg.content || "",
							additional_kwargs: {
								tool_calls: msg.tool_calls,
							},
						});
					}
					return new AIMessage(msg.content);
				case "tool":
					return new ToolMessage({
						content: msg.content,
						tool_call_id: msg.tool_call_id,
					});
				default:
					return new HumanMessage(msg.content);
			}
		});
	}

	async streamQuery(
		userMessage,
		sessionId = "default-session",
		onToken = () => {}
	) {
		console.log(
			"Streaming query with LangChain:",
			userMessage,
			this.llm.model
		);
		try {
			const history = await memory.getHistory(sessionId);
			const systemMessage =
				new SystemMessage(`You are an assistant that can provide expert energy grid analysis for SinCos Automation Technologies Ltd. Also you can provide weather info based on user's provided location in the prompt. And can provide company information. You have access to tool calling that provide real-time data. Firstly, analyze the user prompt and determine which tools to use. Provide response by tool calling.

                                                                                                WEATHER QUERIES:
                                                                                                - If user asks about weather WITHOUT specifying a location, DO NOT call getWeather tool
                                                                                                - Instead respond: "I need to know which city or location you'd like the weather for. Please specify a location."
                                                                                                - ONLY call getWeather when user provides a specific location in their message
                                                                                                - NEVER assume locations like "New York", "current location", or any default city
                                                                                                - Examples that need clarification: "what's the weather?", "how's the weather today?"
                                                                                                - Examples that are clear: "what's the weather in London?", "weather for Tokyo"
                                                                                                - If user asks about weather WITHOUT specifying a location, respond: "I need to know which city or location you'd like the weather for. Please specify a location."
                                                                                                - If user provides a specific location, IMMEDIATELY call getWeather tool with that location
                                                                                                - NEVER assume or default to any location
                                                                                                - Examples needing clarification: "what's the weather?", "how's the weather today?"
                                                                                                - Examples to act on: "what's the weather in London?", "weather for Tokyo", "weather in Dhaka"

                                                                                                GRID DATA QUERIES:
                                                                                                - ALWAYS use getGridData tool for grid status, power, voltage, demand, or energy metrics
                                                                                                - NEVER call getWeather tool or asked for location for grid-related queries
                                                                                                - Examples: "What's the current power demand?", "Get me the latest voltage readings."

                                                                                                COMPANY INFO QUERIES:
                                                                                                - ALWAYS use getCompanyInfo tool for company, services, products, or contact details


                                                                                RESPONSE STYLE:
                                                                                - Be conversational and helpful
                                                                                - Present information clearly and naturally
                                                                                - Never mention technical implementation details
                                                                                - Focus on providing the requested information to the user

                                                                                Examples of context awareness:
                                                                                - You ask: "Which city for weather?" → User says: "London" → You immediately call getWeather with "London"
                                                                                - You ask: "What location?" → User says: "Tokyo" → You immediately call getWeather with "Tokyo"
                                                                                - NEVER call getWeather tool or asked for location for energy/grid-related queries
                                                                                - Examples: "What's the current power demand?", "Get me the latest voltage readings." then just call getGridData
                                                                                Remember: Users should only see natural responses, never tool calling mechanics.`);

			// Convert history to LangChain messages and build message array
			const langchainHistory = this.convertToLangChainMessages(history);
			const messages = [
				systemMessage,
				...langchainHistory,
				new HumanMessage(userMessage),
			];
			await memory.appendMessage(sessionId, {
				role: "user",
				content: userMessage,
			});

			// Initial call to determine if tools are required
			const initialResponse = await this.llmWithTools.invoke(messages);

			// Helper to stream text in chunks (emulates token streaming)
			const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
			const streamText = async (text) => {
				if (!text) return;
				const chunkSize = 32;
				for (let i = 0; i < text.length; i += chunkSize) {
					const chunk = text.slice(i, i + chunkSize);
					try {
						onToken(chunk);
					} catch (e) {}
					await sleep(8);
				}
			};

			console.log("Initial response:", {
				content: initialResponse.content,
				tool_calls: initialResponse.tool_calls,
				additional_kwargs: initialResponse.additional_kwargs,
			});

			// If tools were called, execute them, update memory, and get final response
			if (
				initialResponse.tool_calls &&
				initialResponse.tool_calls.length > 0
			) {
				console.log("Tool calls detected:", initialResponse.tool_calls);

				// Convert LangChain tool call format to memory format
				const toolCallsMessage = {
					role: "assistant",
					content: initialResponse.content || "",
					tool_calls: initialResponse.tool_calls.map((tool) => ({
						function: {
							name: tool.name,
							arguments: tool.args || tool.arguments,
						},
					})),
				};

				await memory.appendMessage(sessionId, toolCallsMessage);

				// Execute each tool call sequentially
				for (const tool of initialResponse.tool_calls) {
					const functionToCall = availableFunctions[tool.name];
					if (functionToCall) {
						console.log(
							"Calling function:",
							tool.name,
							"Arguments:",
							tool.args || tool.arguments
						);
						const output = await functionToCall(
							tool.args || tool.arguments
						);
						console.log("Function output received for", tool.name);
						await memory.addToolMessage(sessionId, {
							tool_call_id: tool.name,
							content: JSON.stringify(output),
						});
					} else {
						console.log("Function", tool.name, "not found");
					}
				}

				const updatedHistory = await memory.getHistory(sessionId);
				const updatedLangchainHistory =
					this.convertToLangChainMessages(updatedHistory);
				const finalResponseStream = await this.llm.stream([
					systemMessage,
					...updatedLangchainHistory,
				]);

				let finalContent = "";
				for await (const chunk of finalResponseStream) {
					const chunkContent = chunk.content || "";
					if (chunkContent) {
						finalContent += chunkContent;
						try {
							onToken(chunkContent);
						} catch (e) {}
					}
				}

				await memory.appendMessage(sessionId, {
					role: "assistant",
					content: finalContent,
				});

				return {
					success: true,
					response: finalContent,
					toolsUsed: initialResponse.tool_calls.map((t) => t.name),
				};
			} else {
				// No tools used
				const responseStream = await this.llm.stream(messages);
				let content = "";

				for await (const chunk of responseStream) {
					const chunkContent = chunk.content || "";
					if (chunkContent) {
						content += chunkContent;
						try {
							onToken(chunkContent);
						} catch (e) {
						}
					}
				}

				await memory.appendMessage(sessionId, {
					role: "assistant",
					content,
				});

				return {
					success: true,
					response: content,
					toolsUsed: [],
				};
			}
		} catch (error) {
			console.error(
				"Error in MemoryLangChainService.streamQuery:",
				error
			);
			return {
				success: false,
				response: `Error: ${error.message}`,
				toolsUsed: [],
			};
		}
	}
}

module.exports = new MemoryLangChainService();
