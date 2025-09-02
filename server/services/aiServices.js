// const axios = require("axios");

// // Import tools
// const { getGridData } = require("../tools/gridDataTool");
// const { getWeather } = require("../tools/weatherTool");
// const { getCompanyInfo } = require("../tools/companyTool");

// class AIService {
// 	constructor() {
// 		// Ollama OpenAI-compatible endpoint base (ensure it includes /v1)
// 		this.ollamaBase = (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/v1$/, "") + "/v1";
// 		this.model = process.env.OLLAMA_MODEL || "llama3.1";

// 		// Tools spec for Ollama / OpenAI-compatible API (JSON Schema style)
// 		this.toolsSpec = [
// 			{
// 				type: "function",
// 				function: {
// 					name: "get_grid_data",
// 					description: "Get current real-time energy grid data including voltage, demand, frequency, power quality metrics, environmental data, and system alerts. No parameters required.",
// 					parameters: {
// 						type: "object",
// 						properties: {},
// 						required: []
// 					}
// 				}
// 			},
// 			{
// 				type: "function",
// 				function: {
// 					name: "get_weather",
// 					description: "Get current weather information for a specific location. Parameters: { location: string }",
// 					parameters: {
// 						type: "object",
// 						properties: {
// 							location: { type: "string", description: "The city or location name" }
// 						},
// 						required: ["location"]
// 					}
// 				}
// 			},
// 			{
// 				type: "function",
// 				function: {
// 					name: "get_company_info",
// 					description: "Get information about SinCos Energy Solutions (services, products, contact, sustainability, achievements). Parameters: { query?: string }",
// 					parameters: {
// 						type: "object",
// 						properties: {
// 							query: { type: "string", description: "Optional specific aspect (e.g., 'contact', 'services', 'products')" }
// 						},
// 						required: []
// 					}
// 				}
// 			}
// 		];

// 		console.log("AIService initialized", {
// 			model: this.model,
// 			baseUrl: this.ollamaBase,
// 			toolsCount: this.toolsSpec.length,
// 		});
// 	}

// 	// getToolDescriptions() {
// 	// 	return `
//         //                 Available Tools:
//         //                 1. get_grid_data: Get current real-time energy grid data including voltage, demand, frequency, power quality metrics, environmental data, and system alerts. No parameters needed.

//         //                 2. get_weather: Get current weather information for a specific location including temperature, humidity, wind speed, and conditions. 
//         //                 Parameters:  ${ location} - The location\/city name to get weather for

//         //                 3. get_company_info: Get information about SinCos Ltd. including services, products, contact details, and company overview.
//         //                 Parameters: ${ query } - Specific information needed (e.g., 'contact', 'services', 'products')

//         //                 Based on the user's query, determine which tool(s) would be most appropriate and specify the tool calls in your response using this exact format:
//         //                 TOOL_CALL: tool_name(parameters)

//         //                 For example:
//         //                 - For "What's the current grid status?" → TOOL_CALL: get_grid_data({})
//         //                 - For "What's the weather in New York?" → TOOL_CALL: get_weather({"location": "New York"})
//         //                 - For "Tell me about the company" → TOOL_CALL: get_company_info({"query": "overview"})

//         //                 You can call multiple tools if needed.
//         //                 `;
// 	// }

// 	parseToolCalls(response) {
// 		const toolCalls = [];
// 		const toolCallPattern = /TOOL_CALL:\s*(\w+)\s*\((\{[^}]*\}|\{\})\)/g;
// 		let match;

// 		while ((match = toolCallPattern.exec(response)) !== null) {
// 			try {
// 				const toolName = match[1];
// 				const argsStr = match[2];
// 				const args = JSON.parse(argsStr);
				
// 				toolCalls.push({
// 					name: toolName,
// 					args: args
// 				});
// 			} catch (error) {
// 				console.error("Error parsing tool call:", error);
// 			}
// 		}

// 		return toolCalls;
// 	}

// 	async processQuery(userQuery) {
// 		console.log("Processing user query:", userQuery);

// 		try {
// 			const startTime = Date.now();
// 			// Use Ollama / OpenAI-compatible chat API with tools field
// 			// Step 1: ask model which tool(s) to call
// 			// Strong instructions: do NOT guess locations. Only call get_weather when the user's text
// 			// explicitly contains a clear location. If no location is present, ask the user for it
// 			// ("Which city would you like the weather for?") and do NOT call get_weather.
// 			const messages = [
// 				{
// 					role: 'system',
// 					content:
// 						'You are an assistant that can call tools. Tools available are: get_grid_data, get_weather, get_company_info.\n'
// 						+ 'IMPORTANT: For weather requests, only call get_weather if the user explicitly includes a clear location (for example: "weather in London", "what is the weather in New York?").\n'
// 						+ 'If the user does NOT include a location, DO NOT call get_weather and instead ask the user: "Which city would you like the weather for?".\n'
// 						+ 'Never guess or invent a city. Wait for the user to provide a location.\n'
// 						+ 'When you call a tool, return a structured tool call according to the provided tool schema.'
// 				},
// 				{ role: 'user', content: userQuery }
// 			];

// 				const chatReq = {
// 				model: this.model,
// 				messages,
// 				tools: this.toolsSpec
// 			};

// 			const chatResp = await axios.post(`${this.ollamaBase}/chat/completions`, chatReq, {
// 				headers: { 'Content-Type': 'application/json' }
// 			});

// 			const message = chatResp.data?.choices?.[0]?.message || chatResp.data?.message;

// 			// If the model returned tool_calls, execute them
// 			// Ollama/OpenAI may return tool call shapes in a few forms. normalize them here.
// 			const rawToolCalls = message?.tool_calls ||  [];
// 			console.log("Raw tool calls:", rawToolCalls);

// 			const toolCalls = [];
// 			for (const call of rawToolCalls) {
// 				try {
// 					let name;
// 					let args = {};

// 					// Newer shape: call.name and call.args
// 					if (call.name) {
// 						name = call.name;
// 						args = call.args || call.arguments || call.arguments_raw || {};
// 					}

// 					// Some responses embed under call.function with JSON-stringified arguments
// 					else if (call.function) {
// 						name = call.function.name || call.function;
// 						const argStr = call.function.arguments || call.arguments;
// 						if (typeof argStr === 'string') {
// 							try {
// 								args = JSON.parse(argStr);
// 							} catch (e) {
// 								console.warn('Failed to parse tool args JSON string, passing raw string', argStr);
// 								args = { _raw: argStr };
// 							}
// 						} else if (typeof argStr === 'object' && argStr !== null) {
// 							args = argStr;
// 						}
// 					}

// 					// Fallback: if call.type === 'function' and has function property
// 					else if (call.type === 'function' && call.function) {
// 						name = call.function.name;
// 						const argStr = call.function.arguments;
// 						if (typeof argStr === 'string') {
// 							try { args = JSON.parse(argStr); } catch (e) { args = { _raw: argStr }; }
// 						} else args = call.function.arguments || {};
// 					}

// 					if (typeof args === 'string') {
// 						try { args = JSON.parse(args); } catch (e) { args = { _raw: args }; }
// 					}

// 					if (name) toolCalls.push({ name, args });
// 				} catch (error) {
// 					console.error('Error normalizing tool call:', error, call);
// 				}
// 			}

// 			console.log('Detected tool calls:', toolCalls);

// 			// Helper: quick heuristic to detect whether the user actually provided a location in the query
// 			function userProvidedLocation(text) {
// 				if (!text) return false;
// 				// common patterns: "in <City>", "for <City>", or city name followed by punctuation
// 				const inMatch = text.match(/\bin\s+([A-Za-z\s]{2,50})/i);
// 				if (inMatch && inMatch[1].trim().length > 1) return true;
// 				const forMatch = text.match(/\bfor\s+([A-Za-z\s]{2,50})/i);
// 				if (forMatch && forMatch[1].trim().length > 1) return true;
// 				// if the query contains a comma-separated location like "Seattle, WA" or similar
// 				if (/[,]\s*[A-Za-z]{2,}/.test(text)) return true;
// 				return false;
// 			}

// 			// If model attempted to call get_weather but the user didn't provide a location,
// 			// don't execute the tool; instead ask the user to supply the city.
// 			const askedWeatherTool = toolCalls.find((c) => c.name === 'get_weather');
// 			if (askedWeatherTool && !userProvidedLocation(userQuery)) {
// 				console.log('get_weather was requested but no explicit location detected in user query — asking user for location instead.');
// 				return {
// 					success: true,
// 					response: "Which city would you like the weather for?",
// 					toolsUsed: [],
// 					metadata: { processingTime: Date.now() - startTime, note: 'requested_city' }
// 				};
// 			}

// 			if (toolCalls.length > 0) {
// 				const toolResults = [];

// 				for (const call of toolCalls) {
// 					const name = call.name;
// 					const args = call.args || {};

// 					console.log('Executing tool', name, args);

// 					let result;
// 					switch (name) {
// 						case 'get_grid_data':
// 							// grid tool expects no args
// 							result = await getGridData.invoke({});
// 							break;
// 						case 'get_weather':
// 							result = await getWeather.invoke(args);
// 							break;
// 						case 'get_company_info':
// 							result = await getCompanyInfo.invoke(args);
// 							break;
// 						default:
// 							result = { error: `Unknown tool: ${name}` };
// 					}

// 					toolResults.push({ name, args, result });
// 				}

// 				// Step 2: send tool responses back as tool-role messages and ask for final answer
// 				const toolMessages = toolResults.map(tr => ({ role: 'tool', name: tr.name, content: JSON.stringify(tr.result) }));

// 				const finalMessages = [
// 					{ role: 'system', content: 'You are an expert energy grid analyst for SinCos Energy Solutions. Provide a concise, actionable response based on tool outputs.' },
// 					{ role: 'user', content: userQuery },
// 					...toolMessages
// 				];

// 				const finalReq = { model: this.model, messages: finalMessages };
// 				const finalResp = await axios.post(`${this.ollamaBase}/chat/completions`, finalReq, { headers: { 'Content-Type': 'application/json' } });

// 				const finalMessage = finalResp.data?.choices?.[0]?.message || finalResp.data?.message;

// 				return {
// 					success: true,
// 					response: finalMessage.content || JSON.stringify(finalMessage),
// 					toolsUsed: toolResults.map(tr => ({ tool: tr.name, args: tr.args })),
// 					metadata: { processingTime: Date.now() - startTime, toolCallsCount: toolCalls.length }
// 				};
// 			}

// 			// No tool calls - return direct model text
// 			return {
// 				success: true,
// 				response: message?.content || JSON.stringify(message),
// 				toolsUsed: [],
// 				metadata: { processingTime: Date.now() - startTime, toolCallsCount: 0 }
// 			};

// 		} catch (error) {
// 			console.error("Failed to process query:", error.message);

// 			return {
// 				success: false,
// 				response: `Failed to process query: ${error.message}`,
// 				metadata: {
// 					error: error.message,
// 					timestamp: new Date().toISOString()
// 				},
// 			};
// 		}
// 	}

// 	// async streamQuery(userQuery, onToken) {
// 	// 	console.log("Streaming query response:", userQuery);

// 	// 	try {
// 	// 		// For streaming, we'll process normally and then stream the result
// 	// 		const result = await this.processQuery(userQuery);
			
// 	// 		if (result.success) {
// 	// 			const words = result.response.split(" ");
// 	// 			let fullResponse = "";

// 	// 			for (const word of words) {
// 	// 				const chunk = word + " ";
// 	// 				fullResponse += chunk;
// 	// 				onToken(chunk);
// 	// 				await new Promise((resolve) => setTimeout(resolve, 50));
// 	// 			}

// 	// 			return {
// 	// 				success: true,
// 	// 				fullResponse: fullResponse.trim(),
// 	// 				toolsUsed: result.toolsUsed,
// 	// 				metadata: result.metadata,
// 	// 			};
// 	// 		} else {
// 	// 			onToken(result.response);
// 	// 			return result;
// 	// 		}

// 	// 	} catch (error) {
// 	// 		console.error("Failed to stream query:", error.message);
// 	// 		const errorMessage = `Failed to stream response: ${error.message}`;
// 	// 		onToken(errorMessage);

// 	// 		return {
// 	// 			success: false,
// 	// 			fullResponse: errorMessage,
// 	// 			metadata: {
// 	// 				error: error.message,
// 	// 				timestamp: new Date().toISOString()
// 	// 			},
// 	// 		};
// 	// 	}
// 	// }
// }

// module.exports = new AIService();
