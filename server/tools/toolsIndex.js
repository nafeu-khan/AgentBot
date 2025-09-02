const { getWeather } = require('../tools/weatherTool');
const {  getGridData } = require('../tools/gridDataTool');
const { getCompanyInfo } = require('../tools/companyTool');

// Tool definitions
const tools = [
	{
		type: 'function',
		function: {
			name: 'getGridData',
			description: 'Get current real-time energy grid data including voltage, demand, frequency, and system alerts. Don\'t  need any location information.',
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
			description: 'Get current weather information for a specific location.Need location information. and return weather information for the specified location.',
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
			description: 'Get information about SinCos Automation Technologies Ltd. company data.',
			parameters: {
				type: 'object',
				properties: {},
				required: []
			}
		}
	}
];

// Available functions mapping
const availableFunctions = {
	getGridData,
	getWeather,
	getCompanyInfo
};

module.exports = {
	tools,
	availableFunctions
};