const errorHandler = (err, req, res, next) => {
	let error = { ...err };
	error.message = err.message;

	console.error("Error occurred:", {
		message: err.message,
		stack: err.stack,
		url: req.url,
		method: req.method,
		ip: req.ip,
	});

	res.status(error.statusCode || 500).json({
		success: false,
		error: error.message || "Server Error",
		...(process.env.NODE_ENV === "development" && { stack: err.stack }),
	});
};

const requestLogger = (req, res, next) => {
	const start = Date.now();

	res.on("finish", () => {
		const duration = Date.now() - start;
		console.log(`${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
	});

	next();
};

module.exports = {
	errorHandler,
	requestLogger,
};
