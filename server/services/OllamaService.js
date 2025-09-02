const ollama = require('ollama').default;
const dataService = require('./dataService');
const axios = require('axios');

async function getGridData() {
        console.log("Fetching grid data...");
	try {
		const currentData = await dataService.getCurrentData();
		if (!currentData || !currentData.data) {
			return { error: "No grid data available" };
		}
		return currentData.data;
	} catch (error) {
		return { error: `Failed to fetch grid data: ${error.message}` };
	}
}

async function getWeather(args) {
        console.log("Fetching weather data...");
	try {
		const { location } = args;
		console.log("Fetching weather data for location:", location);
		
		if (!location || location.trim() === '') {
			return { error: "Location parameter is required. Please specify a city or location." };
		}
		
		// // Reject common default/assumed locations
		// const defaultLocations = ['new york', 'newyork', 'default', 'current location', 'here'];
		// if (defaultLocations.includes(location.toLowerCase().trim())) {
		// 	return { error: "Please specify a valid city name. I cannot assume your location." };
		// }
		
		if (process.env.OPENWEATHER_API_KEY) {
			const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather`, {
				params: {
					q: location,
					appid: process.env.OPENWEATHER_API_KEY,
					units: "metric"
				},
			});
			return response.data;
		} else {
			return {
				name: location,
				main: {
					temp: Math.round(15 + Math.random() * 20),
					humidity: Math.round(40 + Math.random() * 40),
					pressure: Math.round(1000 + Math.random() * 50)
				},
				weather: [{
					main: ["Clear", "Clouds", "Rain", "Snow"][Math.floor(Math.random() * 4)],
					description: "simulated weather data"
				}],
				wind: { speed: Math.round(Math.random() * 15) },
				visibility: Math.round(5000 + Math.random() * 10000)
			};
		}
	} catch (error) {
		return { error: `Failed to fetch weather data: ${error.message}` };
	}
}

async function getCompanyInfo() {
        console.log("Fetching company info...");
	try {
		return {
			name: "SinCos Automation Technologies Ltd.",
			description: "Leading energy technology company focused on smart grid solutions and renewable energy integration",
			founded: "1983",
			headquarters: "Dhaka,Bangladesh",
			services: [
				"Smart Grid Technology",
				"Renewable Energy Integration", 
				"Energy Storage Solutions",
				"Grid Monitoring & Analytics",
				"Demand Response Systems",
				"Microgrid Solutions"
			],
			products: [
				"GridSync Pro - Real-time Grid Monitoring",
				"EcoFlow - Renewable Energy Management",
				"PowerOptim - Energy Storage Systems",
				"SmartLoad - Demand Response Platform"
			],
			contact: {
				email: "info@sincosbd.com",
				phone: "+1 (555) 123-4567",
				website: "https://www.sincosbd.com"
			}
		};
	} catch (error) {
		return { error: `Failed to retrieve company information: ${error.message}` };
	}
}

const tools = [
	{
		type: 'function',
		function: {
			name: 'getGridData',
			description: 'Get current real-time energy grid data including voltage, demand, frequency, and system alerts',
			parameters: {
				type: 'object',
				properties: {},
				required: []
			}
		}
	},
	{
		type: 'function', 
		function: {
			name: 'getWeather',
			description: 'Get current weather information for a specific location',
			parameters: {
				type: 'object',
				properties: {
					location: {
						type: 'string',
						description: 'The city or location name'
					}
				},
				required: ['location']
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'getCompanyInfo', 
			description: 'Get information about SinCos Energy Solutions',
			parameters: {
				type: 'object',
				properties: {},
				required: []
			}
		}
	}
];

const availableFunctions = {
	getGridData,
	getWeather,
	getCompanyInfo
};

class OllamaService {
	constructor() {
		this.model = process.env.OLLAMA_MODEL || 'llama3.1:latest';
		console.log('OllamaService initialized with model:', this.model);
	}

	async processQuery(userMessage) {
                console.log('Processing query:', userMessage,this.model);
		try {
			console.log('Processing query:', userMessage);
			
			const messages = [
				{
					role: 'system',
					content: `You are an expert energy grid analyst for SinCos Automation Technologies Ltd. You have access to tools that you MUST use appropriately.

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

                                                COMPANY INFO QUERIES:
                                                - ALWAYS use getCompanyInfo tool for company, services, products, or contact details

                                                CRITICAL: Do not make assumptions about missing required parameters. Always ask for clarification first.
`
				},
				{
					role: 'user', 
					content: userMessage
				}
			];

			const response = await ollama.chat({
				model: this.model,
				messages: messages,
				tools: tools,
				options: {
					temperature: 0.1,  
					top_p: 0.9
				}
			});

			if (response.message.tool_calls) {
				console.log('Tool calls detected:', response.message.tool_calls);
				// Process tool calls
				for (const tool of response.message.tool_calls) {
					const functionToCall = availableFunctions[tool.function.name];
					if (functionToCall) {
						console.log('Calling function:', tool.function.name);
						console.log('Arguments:', tool.function.arguments);
						
						const output = await functionToCall(tool.function.arguments);
						console.log('Function output received');

						messages.push(response.message);
						messages.push({
							role: 'tool',
							content: JSON.stringify(output),
							tool_call_id: tool.function.name
						});
					} else {
						console.log('Function', tool.function.name, 'not found');
					}
				}

				const finalResponse = await ollama.chat({
					model: this.model,
					messages: messages,
					options: {
						temperature: 0.1,
						top_p: 0.9
					}
				});

				return {
					success: true,
					response: finalResponse.message.content,
					toolsUsed: response.message.tool_calls.map(tool => tool.function.name)
				};
			} else {
				return {
					success: true,
					response: response.message.content,
					toolsUsed: []
				};
			}
		} catch (error) {
			console.error('Error in OllamaService:', error);
			return {
				success: false,
				response: `Error: ${error.message}`,
				toolsUsed: []
			};
		}
	}
}

module.exports = new OllamaService();

