
const dataService = require('../services/dataService');

async function getGridData() {
        console.log("Fetching grid data...");
        try {
                const currentData = await dataService.getCurrentData();
                if (!currentData || !currentData.data) {
                        return { error: "No grid data available" };
                }
                return currentData.data;
        } catch (error) {
                const message = error && error.message ? error.message : String(error);
                return { error: `Failed to fetch grid data: ${message}` };
        }
}

module.exports = { getGridData };
