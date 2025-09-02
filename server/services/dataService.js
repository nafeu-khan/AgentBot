const axios = require("axios");
const NodeCache = require("node-cache");

class DataService {
	constructor() {
		this.cache = new NodeCache({
			stdTTL: parseInt(process.env.CACHE_TTL) || 5000,
			checkperiod: 1000,
		});
		this.dataSourceUrl =
			process.env.DATA_SOURCE_URL || "http://localhost:3001/api/data/";
		this.freshnessThreshold =
			parseInt(process.env.DATA_FRESHNESS_THRESHOLD) || 5000;

		console.log("DataService initialized", {
			cacheTTL: this.cache.options.stdTTL,
			dataSource: this.dataSourceUrl,
			freshnessThreshold: this.freshnessThreshold,
		});
	}

	async fetchFreshData() {
		try {
			console.log("Fetching fresh data from external source");
			const response = await axios.get(this.dataSourceUrl, {
				timeout: 10000,
				headers: {
					"User-Agent": "Energy-Demand-Chatbot/1.0",
				},
			});

			let processedData = response.data;
			let count = 1;

			const freshData = {
				data: processedData,
				timestamp: Date.now(),
				source: this.dataSourceUrl,
				count: count,
				sourceType: "energy-api",
			};
			this.cache.set("latest_data", freshData);
			console.log("Fresh data fetched and cached", {
				recordCount: freshData.count,
				timestamp: new Date(freshData.timestamp).toISOString(),
			});
			return freshData;
		} catch (error) {
			console.error("Failed to fetch fresh data:", {
				error: error.message,
				url: this.dataSourceUrl,
			});
			throw new Error(`Failed to fetch data: ${error.message}`);
		}
	}
	async getCurrentData(forceRefresh = false) {
		const cachedData = this.cache.get("latest_data");
		const now = Date.now();

		if (cachedData && !forceRefresh) {
			const dataAge = now - cachedData.timestamp;
			const isFresh = dataAge < this.freshnessThreshold;
			if (isFresh) {
				return {
					...cachedData,
					isFresh: true,
					ageInSeconds: Math.round(dataAge / 1000),
				};
			}
		}
		try {
			const freshData = await this.fetchFreshData();
			return {
				...freshData,
				isFresh: true,
				ageInSeconds: 0,
			};
		} catch (error) {
			if (cachedData) {
				const dataAge = now - cachedData.timestamp;
				console.warn("Returning stale data due to fetch failure:", {
					dataAge,
					error: error.message,
				});
				return {
					...cachedData,
					isFresh: false,
					ageInSeconds: Math.round(dataAge / 1000),
					error: "Failed to fetch fresh data",
				};
			}
			throw error;
		}
	}
	isDataFresh() {
		const cachedData = this.cache.get("latest_data");
		if (!cachedData) return false;
		const dataAge = Date.now() - cachedData.timestamp;
		return dataAge < this.freshnessThreshold;
	}

	getCacheStats() {
		const stats = this.cache.getStats();
		const cachedData = this.cache.get("latest_data");
		return {
			...stats,
			hasData: !!cachedData,
			dataAge: cachedData ? Date.now() - cachedData.timestamp : null,
			isFresh: this.isDataFresh(),
		};
	}

	clearCache() {
		this.cache.flushAll();
		console.log("Cache cleared");
	}
}

module.exports = new DataService();
