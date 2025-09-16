const express = require("express");
const cors = require("cors");
const app = express();
const PORT = process.env.DATA_PORT || 3001;

app.use(cors({
	origin: '*',
	methods: ["GET"],
	allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

let currentData = {
	voltage: 120.0,
	demand: 50.0,
	frequency: 60.0,
	temperature: 25.0,
	humidity: 45.0,
	powerFactor: 0.95,
	efficiency: 92.0,
	carbonIntensity: 0.45,
	renewablePercentage: 35.0,
	gridLoad: 75.0,
	transmissionLoss: 3.5,
	generationCapacity: 850.0,
	peakDemandToday: 0,
	alerts: [],
};

function updateData() {
	// Voltage variations (110-130V range)
	const voltageVariation = (Math.random() - 0.5) * 4;
	currentData.voltage = Math.max(
		110,
		Math.min(130, currentData.voltage + voltageVariation)
	);

	// Demand variations (20-100MW range)
	const demandVariation = (Math.random() - 0.5) * 10;
	currentData.demand = Math.max(
		20,
		Math.min(100, currentData.demand + demandVariation)
	);

	// Frequency variations (59.5-60.5Hz range)
	const frequencyVariation = (Math.random() - 0.5) * 0.8;
	currentData.frequency = Math.max(
		59.5,
		Math.min(60.5, currentData.frequency + frequencyVariation)
	);

	// Temperature variations (15-40°C range)
	const tempVariation = (Math.random() - 0.5) * 2;
	currentData.temperature = Math.max(
		15,
		Math.min(40, currentData.temperature + tempVariation)
	);

	// Humidity variations (30-70% range)
	const humidityVariation = (Math.random() - 0.5) * 4;
	currentData.humidity = Math.max(
		30,
		Math.min(70, currentData.humidity + humidityVariation)
	);

	// Power factor variations (0.85-0.98 range)
	const pfVariation = (Math.random() - 0.5) * 0.06;
	currentData.powerFactor = Math.max(
		0.85,
		Math.min(0.98, currentData.powerFactor + pfVariation)
	);

	// Efficiency variations (85-98% range)
	const efficiencyVariation = (Math.random() - 0.5) * 3;
	currentData.efficiency = Math.max(
		85,
		Math.min(98, currentData.efficiency + efficiencyVariation)
	);

	// Carbon intensity variations (0.2-0.8 kg CO2/kWh range)
	const carbonVariation = (Math.random() - 0.5) * 0.1;
	currentData.carbonIntensity = Math.max(
		0.2,
		Math.min(0.8, currentData.carbonIntensity + carbonVariation)
	);

	// Renewable percentage variations (20-60% range)
	const renewableVariation = (Math.random() - 0.5) * 5;
	currentData.renewablePercentage = Math.max(
		20,
		Math.min(60, currentData.renewablePercentage + renewableVariation)
	);

	// Grid load variations (40-95% range)
	const loadVariation = (Math.random() - 0.5) * 8;
	currentData.gridLoad = Math.max(
		40,
		Math.min(95, currentData.gridLoad + loadVariation)
	);

	// Transmission loss variations (2-6% range)
	const lossVariation = (Math.random() - 0.5) * 0.8;
	currentData.transmissionLoss = Math.max(
		2,
		Math.min(6, currentData.transmissionLoss + lossVariation)
	);

	// Generation capacity variations (800-900MW range)
	const capacityVariation = (Math.random() - 0.5) * 20;
	currentData.generationCapacity = Math.max(
		800,
		Math.min(900, currentData.generationCapacity + capacityVariation)
	);

	// Update peak demand (track highest demand of the day)
	if (currentData.demand > currentData.peakDemandToday) {
		currentData.peakDemandToday = currentData.demand;
	}

	// Generate alerts based on conditions
	currentData.alerts = [];
	if (currentData.voltage < 115) currentData.alerts.push("LOW_VOLTAGE");
	if (currentData.voltage > 125) currentData.alerts.push("HIGH_VOLTAGE");
	if (currentData.frequency < 59.7) currentData.alerts.push("LOW_FREQUENCY");
	if (currentData.frequency > 60.3) currentData.alerts.push("HIGH_FREQUENCY");
	if (currentData.gridLoad > 90) currentData.alerts.push("HIGH_LOAD");
	if (currentData.powerFactor < 0.9)
		currentData.alerts.push("LOW_POWER_FACTOR");
	if (currentData.transmissionLoss > 5)
		currentData.alerts.push("HIGH_TRANSMISSION_LOSS");
	if (currentData.temperature > 35)
		currentData.alerts.push("HIGH_TEMPERATURE");

	// Round all numerical values
	currentData.voltage = Math.round(currentData.voltage * 100) / 100;
	currentData.demand = Math.round(currentData.demand * 100) / 100;
	currentData.frequency = Math.round(currentData.frequency * 100) / 100;
	currentData.temperature = Math.round(currentData.temperature * 100) / 100;
	currentData.humidity = Math.round(currentData.humidity * 100) / 100;
	currentData.powerFactor = Math.round(currentData.powerFactor * 1000) / 1000;
	currentData.efficiency = Math.round(currentData.efficiency * 100) / 100;
	currentData.carbonIntensity =
		Math.round(currentData.carbonIntensity * 1000) / 1000;
	currentData.renewablePercentage =
		Math.round(currentData.renewablePercentage * 100) / 100;
	currentData.gridLoad = Math.round(currentData.gridLoad * 100) / 100;
	currentData.transmissionLoss =
		Math.round(currentData.transmissionLoss * 100) / 100;
	currentData.generationCapacity =
		Math.round(currentData.generationCapacity * 100) / 100;
	currentData.peakDemandToday =
		Math.round(currentData.peakDemandToday * 100) / 100;
}
const interval=1000;
setInterval(updateData, interval);

app.get("/api/data/", (req, res) => {
	res.json({
		voltage: `${currentData.voltage} V`,
		demand: `${currentData.demand} MW`,
		frequency: `${currentData.frequency} Hz`,

		temperature: `${currentData.temperature} °C`,
		humidity: `${currentData.humidity}%`,

		powerFactor: currentData.powerFactor,
		efficiency: `${currentData.efficiency}%`,

		carbonIntensity: `${currentData.carbonIntensity} kg CO2/kWh`,
		renewablePercentage: `${currentData.renewablePercentage}%`,

		gridLoad: `${currentData.gridLoad}%`,
		transmissionLoss: `${currentData.transmissionLoss}%`,
		generationCapacity: `${currentData.generationCapacity} MW`,
		peakDemandToday: `${currentData.peakDemandToday} MW`,

		// System status
		alerts: currentData.alerts,
		status: currentData.alerts.length > 0 ? "WARNING" : "NORMAL",

		// Metadata
		timestamp: new Date().toISOString(),
		dataSource: "real-time-grid-monitor",
		updateInterval: `${interval}ms`,
	});
});

app.get("/health", (req, res) => {
	res.json({
		status: "healthy",
		timestamp: new Date().toISOString(),
		uptime: process.uptime(),
	});
});

app.get("/api/data/stats", (req, res) => {
	res.json({
		current: currentData,
		statistics: {
			avgVoltage: Math.round(((110 + 130) / 2) * 100) / 100,
			avgDemand: Math.round(((20 + 100) / 2) * 100) / 100,
			systemHealth:
				currentData.alerts.length === 0
					? "EXCELLENT"
					: currentData.alerts.length <= 2
					? "GOOD"
					: currentData.alerts.length <= 4
					? "FAIR"
					: "POOR",
			riskLevel:
				currentData.alerts.length === 0
					? "LOW"
					: currentData.alerts.length <= 2
					? "MEDIUM"
					: "HIGH",
		},
		metadata: {
			timestamp: new Date().toISOString(),
			totalAlerts: currentData.alerts.length,
			monitoringActive: true,
		},
	});
});

app.get("/api/data/alerts", (req, res) => {
	res.json({
		activeAlerts: currentData.alerts,
		alertCount: currentData.alerts.length,
		severity:
			currentData.alerts.length === 0
				? "NONE"
				: currentData.alerts.some(
						(alert) =>
							alert.includes("HIGH_VOLTAGE") ||
							alert.includes("LOW_VOLTAGE") ||
							alert.includes("HIGH_LOAD")
				  )
				? "CRITICAL"
				: "WARNING",
		timestamp: new Date().toISOString(),
	});
});

app.listen(PORT, () => {
	console.log(`Data server running on port ${PORT}`);
	console.log(`Real-time data endpoint: http://localhost:${PORT}/api/data/`);
	console.log("Data updates every second...");
});

module.exports = app;
