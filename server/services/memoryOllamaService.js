const { tools, availableFunctions } = require('../tools/toolsIndex');

const ollama = require('ollama').default;
const { MemoryManager } = require('./memoryManager');
const { InMemoryStore } = require('./memoryStore');


const memory = new MemoryManager(new InMemoryStore(), { maxMessages: 40 });

class OllamaService {
	constructor() {
		this.model = process.env.OLLAMA_MODEL || 'llama3.1:latest';
		console.log('OllamaService initialized with model:', this.model);
	}
 
        async streamQuery(userMessage, sessionId = 'default-session', onToken = () => {}) {
                console.log('Streaming query:', userMessage, this.model);
                try {
                        const history = await memory.getHistory(sessionId);
                        const systemMessage = {
                                role: 'system',
                                content: `You are an assistant that can provide expert energy grid analysis for SinCos Automation Technologies Ltd. Also you can provide weather info based on user's provided location in the prompt. And can provide company information. You have access to tool calling that provide real-time data. Firstly, analyze the user prompt and determine which tools to use. Provide response by tool calling.

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
                                                                                Remember: Users should only see natural responses, never tool calling mechanics.`
                        };

                        const messages = [systemMessage, ...history, { role: 'user', content: userMessage }];
                        await memory.appendMessage(sessionId, { role: 'user', content: userMessage });

                        const initialResponse = await ollama.chat({
                                model: this.model,
                                messages,
                                tools: tools,
                                options: {
                                        temperature: 0.1,
                                        top_p: 0.9
                                }
                        });

                        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
                        const streamText = async (text) => {
                                if (!text) return;
                                const chunkSize = 32; 
                                for (let i = 0; i < text.length; i += chunkSize) {
                                        const chunk = text.slice(i, i + chunkSize);
                                        try {
                                                onToken(chunk);
                                        } catch (e) {
                                                // ignore callback errors
                                        }
                                        await sleep(8);
                                }
                        };

                        // If tools were called, execute them, update memory, and get final response
                        if (initialResponse.message && initialResponse.message.tool_calls && initialResponse.message.tool_calls.length) {
                                console.log('Tool calls detected:', initialResponse.message.tool_calls);

                                await memory.appendMessage(sessionId, initialResponse.message);

                                for (const tool of initialResponse.message.tool_calls) {
                                        const functionToCall = availableFunctions[tool.function.name];
                                        if (functionToCall) {
                                                console.log('Calling function:', tool.function.name,'Arguments:', tool.function.arguments);
                                                const output = await functionToCall(tool.function.arguments);
                                                console.log('Function output received for', tool.function.name);
                                                await memory.addToolMessage(sessionId, {
                                                        tool_call_id: tool.function.name,
                                                        content: JSON.stringify(output)
                                                });
                                        } else {
                                                console.log('Function', tool.function.name, 'not found');
                                        }
                                }

                                const updatedHistory = await memory.getHistory(sessionId);
                                const finalResponse = await ollama.chat({
                                        model: this.model,
                                        messages: [systemMessage, ...updatedHistory],
                                        options: {
                                                temperature: 0.1,
                                                top_p: 0.9
                                        }
                                });
                                const finalContent = (finalResponse.message && finalResponse.message.content) || '';

                                await streamText(finalContent);
                                await memory.appendMessage(sessionId, { role: 'assistant', content: finalContent });

                                return {
                                        success: true,
                                        response: finalContent,
                                        toolsUsed: initialResponse.message.tool_calls.map((t) => t.function.name)
                                };
                        } else {
                                const content = (initialResponse.message && initialResponse.message.content) || '';
                                await streamText(content);

                                await memory.appendMessage(sessionId, { role: 'assistant', content });

                                return {
                                        success: true,
                                        response: content,
                                        toolsUsed: []
                                };
                        }
                } catch (error) {
                        console.error('Error in OllamaService.streamQuery:', error);
                        return {
                                success: false,
                                response: `Error: ${error.message}`,
                                toolsUsed: []
                        };
                }
        }
}

module.exports = new OllamaService();

