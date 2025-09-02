 const axios = require('axios');
 
 async function getWeather(args = {}) {
	console.log("Fetching weather data...");
	try {
		const { location } = args;
		console.log("Fetching weather data for location:", location);
		
		if (!location || location.trim() === '') {
			return { 
				error: "Location parameter is required", 
				instruction: "Ask the user to specify which city or location they want weather information for. Say: 'I need a specific location to provide you with the current weather. Can you please tell me which city or area you're interested in knowing the weather for?'"
			};
		}
		
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
			// Mock data for demonstration
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

module.exports = { getWeather };