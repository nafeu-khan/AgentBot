// const { ChatOllama } = require("@langchain/community/chat_models/ollama");
// const { HumanMessage, AIMessage, SystemMessage } = require("@langchain/core/messages");
// const { ChatMessageHistory } = require("langchain/stores/message/in_memory");

// // Import tools
// const { getGridData } = require("../tools/gridDataTool");
// const { getWeather } = require("../tools/weatherTool");
// const { getCompanyInfo } = require("../tools/companyTool");

// class LangChainAIService {
// 	constructor() {
// 		this.llm = new ChatOllama({
// 			baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
// 			model: process.env.OLLAMA_MODEL || "llama3.1",
// 			temperature: 0.1,
// 		});
// 		this.tools = [
// 			getGridData,
// 			getWeather,
// 			getCompanyInfo
// 		];
                
// 		// Create conversation memory storage (in-memory for now)
// 		// In production, you'd want to use Redis or database-backed storage
// 		this.conversations = new Map();

// 		// System prompt that guides the LLM's behavior
// 		this.systemPrompt = `You are an expert energy grid analyst assistant for SinCos Energy Solutions. You have access to these tools:

// 1. get_grid_data: Get current real-time energy grid data (voltage, demand, frequency, power quality, environmental metrics, alerts)
// 2. get_weather: Get weather information for a specific location (requires location parameter)
// 3. get_company_info: Get information about SinCos Energy Solutions (services, products, contact, achievements)

// IMPORTANT GUIDELINES:
// - You are conversational and maintain context across multiple exchanges
// - For weather requests: ONLY call get_weather if the user explicitly provides a location
// - If user asks for weather without specifying location, ask them: "Which city would you like the weather for?"
// - Remember previous context - if user previously asked about weather and now provides a city, understand they want weather for that city
// - Use tools intelligently based on user intent, not keywords
// - Provide comprehensive, professional responses with specific data and recommendations
// - If user asks follow-up questions, consider the conversation history

// CONVERSATION FLOW EXAMPLES:
// User: "What's the weather?"
// You: "Which city would you like the weather for?"
// User: "London"
// You: [call get_weather with London] + provide weather info

// User: "Tell me about grid status"
// You: [call get_grid_data] + analyze the data

// User: "What services does the company offer?"
// You: [call get_company_info] + provide services information`;

// 		console.log("LangChainAIService initialized", {
// 			model: process.env.OLLAMA_MODEL || "llama3.1",
// 			baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
// 			toolsCount: this.tools.length,
// 		});
// 	}

// 	// Get or create conversation history for a session
// 	getConversationHistory(sessionId = 'default') {
// 		if (!this.conversations.has(sessionId)) {
// 			this.conversations.set(sessionId, new ChatMessageHistory());
// 		}
// 		return this.conversations.get(sessionId);
// 	}

// 	// Analyze user intent and determine if they're providing missing information
// 	analyzeUserIntent(currentMessage, conversationHistory) {
// 		const messages = conversationHistory.messages || [];
// 		const lastAIMessage = messages.filter(m => m._getType() === 'ai').pop();
		
// 		// Check if AI previously asked for location and user is now providing it
// 		if (lastAIMessage && lastAIMessage.content.toLowerCase().includes('which city')) {
// 			// User likely providing location for previous weather request
// 			return {
// 				type: 'location_response',
// 				originalIntent: 'weather',
// 				location: currentMessage.trim()
// 			};
// 		}

// 		// Check if user is asking follow-up questions
// 		const recentMessages = messages.slice(-4); // Last 2 exchanges
// 		const hasRecentGridData = recentMessages.some(m => 
// 			m.content && (m.content.includes('voltage') || m.content.includes('grid') || m.content.includes('demand'))
// 		);
		
// 		if (hasRecentGridData && (currentMessage.toLowerCase().includes('more') || 
// 			currentMessage.toLowerCase().includes('explain') || 
// 			currentMessage.toLowerCase().includes('what about'))) {
// 			return {
// 				type: 'follow_up',
// 				context: 'grid'
// 			};
// 		}

// 		return {
// 			type: 'new_request'
// 		};
// 	}

// 	// Determine which tools to use based on LLM decision (not keywords)
// 	async determineToolsToUse(userMessage, conversationHistory, userIntent) {
// 		const messages = [
// 			new SystemMessage(`You are a tool router. Based on the user's message and conversation context, determine which tools to call.

// Available tools:
// - get_grid_data: For energy grid, voltage, power, demand, frequency questions
// - get_weather: For weather questions (ONLY if location is provided)
// - get_company_info: For company information, services, products, contact

// IMPORTANT: 
// - If user asks for weather without location, do NOT call get_weather
// - If this is a location response to previous weather request, call get_weather
// - Consider conversation context for follow-up questions

// Return a JSON array of tool calls in this format:
// [{"tool": "get_weather", "params": {"location": "London"}}]

// If no tools needed, return: []`),
// 			...conversationHistory.messages,
// 			new HumanMessage(userMessage)
// 		];

// 		try {
// 			const response = await this.llm.invoke(messages);
// 			const content = response.content.trim();
			
// 			// Parse JSON response
// 			let toolCalls = [];
// 			try {
// 				// Extract JSON from response
// 				const jsonMatch = content.match(/\[.*\]/s);
// 				if (jsonMatch) {
// 					toolCalls = JSON.parse(jsonMatch[0]);
// 				}
// 			} catch (error) {
// 				console.log("Could not parse tool calls JSON, determining manually");
				
// 				// Fallback: manual intent analysis
// 				if (userIntent.type === 'location_response' && userIntent.originalIntent === 'weather') {
// 					toolCalls = [{"tool": "get_weather", "params": {"location": userIntent.location}}];
// 				} else if (content.toLowerCase().includes('grid') || content.toLowerCase().includes('energy')) {
// 					toolCalls = [{"tool": "get_grid_data", "params": {}}];
// 				} else if (content.toLowerCase().includes('company') || content.toLowerCase().includes('service')) {
// 					toolCalls = [{"tool": "get_company_info", "params": {}}];
// 				}
// 			}

// 			return toolCalls;
// 		} catch (error) {
// 			console.error("Error determining tools:", error);
			
// 			// Fallback logic
// 			const message = userMessage.toLowerCase();
// 			if (userIntent.type === 'location_response') {
// 				return [{"tool": "get_weather", "params": {"location": userIntent.location}}];
// 			} else if (message.includes('grid') || message.includes('voltage') || message.includes('power')) {
// 				return [{"tool": "get_grid_data", "params": {}}];
// 			} else if (message.includes('company') || message.includes('service')) {
// 				return [{"tool": "get_company_info", "params": {}}];
// 			}
			
// 			return [];
// 		}
// 	}

// 	// Execute tools
// 	async executeTools(toolCalls) {
// 		const results = [];
// 		console.log("Executing tool calls:", toolCalls);
// 		for (const toolCall of toolCalls) {
// 			try {
// 				console.log(`Executing tool: ${toolCall.tool} with params:`, toolCall.params);
				
// 				let result;
// 				switch (toolCall.tool) {
// 					case 'get_grid_data':
// 						result = await getGridData.invoke({});
// 						break;
// 					case 'get_weather':
// 						result = await getWeather.invoke(toolCall.params);
// 						break;
// 					case 'get_company_info':
// 						result = await getCompanyInfo.invoke(toolCall.params);
// 						break;
// 					default:
// 						result = { error: `Unknown tool: ${toolCall.tool}` };
// 				}
				
// 				results.push({
// 					tool: toolCall.tool,
// 					params: toolCall.params,
// 					result: result
// 				});
// 			} catch (error) {
// 				console.error(`Error executing tool ${toolCall.tool}:`, error);
// 				results.push({
// 					tool: toolCall.tool,
// 					params: toolCall.params,
// 					result: { error: error.message }
// 				});
// 			}
// 		}
		
// 		return results;
// 	}

// 	// Main processing method
// 	async processQuery(userMessage, sessionId = 'default') {
// 		console.log("Processing user query with LangChain:", userMessage, sessionId);

// 		try {
// 			const startTime = Date.now();

// 			const conversationHistory = this.getConversationHistory(sessionId);
			
// 			const userIntent = this.analyzeUserIntent(userMessage, conversationHistory);
// 			console.log("User intent analysis:", userIntent);

// 			await conversationHistory.addMessage(new HumanMessage(userMessage));
			
// 			// Check if this is a simple weather request without location
// 			if (userMessage.toLowerCase().includes('weather') && 
// 				userIntent.type === 'new_request' && 
// 				!this.extractLocationFromText(userMessage)) {
				
// 				const response = "Which city would you like the weather for?";
// 				await conversationHistory.addMessage(new AIMessage(response));
				
// 				return {
// 					success: true,
// 					response: response,
// 					toolsUsed: [],
// 					sessionId: sessionId,
// 					metadata: {
// 						processingTime: Date.now() - startTime,
// 						userIntent: userIntent,
// 						awaiting: 'location'
// 					}
// 				};
// 			}
			
// 			// Determine which tools to use
// 			const toolCalls = await this.determineToolsToUse(userMessage, conversationHistory, userIntent);
// 			console.log("Determined tool calls:", toolCalls);
			
// 			// Execute tools if any
// 			let toolResults = [];
// 			if (toolCalls.length > 0) {
// 				toolResults = await this.executeTools(toolCalls);
// 			}
			
// 			// Create messages for final response generation
// 			let messages;
			
// 			if (toolResults.length > 0) {
// 				// If we have tool results, create a focused prompt with the data
// 				const toolContext = toolResults.map(tr => 
// 					`${tr.tool} data: ${JSON.stringify(tr.result, null, 2)}`
// 				).join('\n\n');
				
// 				messages = [
// 					new SystemMessage(`You are an expert energy grid analyst for SinCos Energy Solutions. 

// IMPORTANT: You have already retrieved the following data using tools. Use this data to provide a comprehensive, direct response to the user's query. Do NOT say you need to fetch data or ask them to wait.

// ${toolContext}

// Based on the above data, provide a detailed, professional response to the user's query. Use specific numbers, metrics, and insights from the data.`),
// 					new HumanMessage(userMessage)
// 				];
// 			} else {
// 				// No tools used, regular conversation
// 				messages = [
// 					new SystemMessage(this.systemPrompt),
// 					...conversationHistory.messages.slice(-10), // Keep last 10 messages for context
// 				];
// 			}
			
// 			// Generate final response
// 			const response = await this.llm.invoke(messages);
// 			const finalResponse = response.content;
			
// 			// Add AI response to history
// 			await conversationHistory.addMessage(new AIMessage(finalResponse));
			
// 			const processingTime = Date.now() - startTime;
			
// 			return {
// 				success: true,
// 				response: finalResponse,
// 				toolsUsed: toolResults.map(tr => ({ tool: tr.tool, params: tr.params })),
// 				sessionId: sessionId,
// 				metadata: {
// 					processingTime,
// 					toolCallsCount: toolCalls.length,
// 					userIntent: userIntent,
// 					conversationLength: conversationHistory.messages.length
// 				}
// 			};
			
// 		} catch (error) {
// 			console.error("Failed to process query with LangChain:", error);
			
// 			return {
// 				success: false,
// 				response: `I encountered an error while processing your request: ${error.message}`,
// 				sessionId: sessionId,
// 				metadata: {
// 					error: error.message,
// 					timestamp: new Date().toISOString()
// 				}
// 			};
// 		}
// 	}

// 	// Helper method to extract location from text
// 	extractLocationFromText(text) {
// 		// Look for common patterns like "in City", "weather in City", "City weather"
// 		const patterns = [
// 			/\bin\s+([A-Za-z\s,]+?)(?:\s|$|[.!?])/i,
// 			/\bfor\s+([A-Za-z\s,]+?)(?:\s|$|[.!?])/i,
// 			/weather\s+([A-Za-z\s,]+?)(?:\s|$|[.!?])/i,
// 			/([A-Za-z\s,]{2,})\s+weather/i
// 		];
		
// 		for (const pattern of patterns) {
// 			const match = text.match(pattern);
// 			if (match && match[1]) {
// 				const location = match[1].trim();
// 				// Filter out common non-location words
// 				if (location.length > 1 && 
// 					!['is', 'the', 'what', 'how', 'weather', 'today', 'now'].includes(location.toLowerCase())) {
// 					return location;
// 				}
// 			}
// 		}
		
// 		return null;
// 	}

// 	// Stream response (for real-time chat)
// 	async streamQuery(userMessage, onToken, sessionId = 'default') {
// 		console.log("Streaming query response with LangChain:", userMessage);
		
// 		try {
// 			// Process normally first
// 			const result = await this.processQuery(userMessage, sessionId);
			
// 			if (result.success) {
// 				// Stream the response word by word
// 				const words = result.response.split(" ");
// 				let fullResponse = "";
				
// 				for (const word of words) {
// 					const chunk = word + " ";
// 					fullResponse += chunk;
// 					onToken(chunk);
// 					await new Promise((resolve) => setTimeout(resolve, 50));
// 				}
				
// 				return {
// 					success: true,
// 					fullResponse: fullResponse.trim(),
// 					toolsUsed: result.toolsUsed,
// 					sessionId: result.sessionId,
// 					metadata: result.metadata,
// 				};
// 			} else {
// 				onToken(result.response);
// 				return result;
// 			}
			
// 		} catch (error) {
// 			console.error("Failed to stream query with LangChain:", error);
// 			const errorMessage = `Failed to stream response: ${error.message}`;
// 			onToken(errorMessage);
			
// 			return {
// 				success: false,
// 				fullResponse: errorMessage,
// 				sessionId: sessionId,
// 				metadata: {
// 					error: error.message,
// 					timestamp: new Date().toISOString()
// 				},
// 			};
// 		}
// 	}

// 	// Clear conversation history for a session
// 	clearConversation(sessionId = 'default') {
// 		this.conversations.delete(sessionId);
// 		console.log(`Cleared conversation history for session: ${sessionId}`);
// 	}

// 	// Get conversation summary
// 	getConversationSummary(sessionId = 'default') {
// 		const history = this.conversations.get(sessionId);
// 		if (!history) {
// 			return { messageCount: 0, messages: [] };
// 		}
		
// 		return {
// 			messageCount: history.messages.length,
// 			messages: history.messages.slice(-6).map(msg => ({
// 				type: msg._getType(),
// 				content: msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '')
// 			}))
// 		};
// 	}
// }

// module.exports = new LangChainAIService();


// /*
// agent = create_openai_functions_agent(llm, [add, multiply])
// executor = AgentExecutor(agent=agent, tools=[add, multiply], verbose=True)

// result = executor.invoke({"input": "What is 6 times (3 + 4)?"})
// */