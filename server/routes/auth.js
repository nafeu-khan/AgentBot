const express = require("express");
const authController = require("../controllers/authController");
const authService = require("../auth/authService");
const authMiddleware = require("../auth/middleware");

const router = express.Router();


router.post(
	"/register",
	authMiddleware.rateLimit(10, 60 * 1000), // 10 attempts per 1 minute
	authService.getRegistrationValidation(),
	authService.handleValidationErrors,
	authController.register
);

router.post(
	"/login",
	authMiddleware.rateLimit(60, 60 * 1000), // 60 attempts per 1 minute
	authService.getLoginValidation(),
	authService.handleValidationErrors,
	authController.login
);


router.post(
	"/refresh",
	authMiddleware.rateLimit(60, 60 * 1000), // 60 attempts per 1 minute
	authController.refreshToken
);


router.post("/logout", authMiddleware.authenticate, authController.logout);

router.post(
	"/logout-all",
	authMiddleware.authenticate,
	authController.logoutAll
);


router.post(
	"/change-password",
	authMiddleware.authenticate,
	authService.getPasswordChangeValidation(),
	authService.handleValidationErrors,
	authController.changePassword
);


router.get("/profile", authMiddleware.authenticate, authController.getProfile);

router.put(
	"/profile",
	authMiddleware.authenticate,
	authController.updateProfile
);


router.get(
	"/sessions",
	authMiddleware.authenticate,
	authController.getSessions
);


router.delete(
	"/sessions/:sessionId",
	authMiddleware.authenticate,
	authController.revokeSession
);


router.get(
	"/conversations",
	authMiddleware.authenticate,
	authController.getConversations
);


router.post("/verify", authMiddleware.authenticate, authController.verifyToken);

// Admin routes (admin role required)


router.get(
	"/admin/users",
	authMiddleware.authenticate,
	authMiddleware.authorize(["admin"]),
	async (req, res) => {
		try {
			res.json({
				success: true,
				message: "Admin endpoint - not implemented yet",
			});
		} catch (error) {
			res.status(500).json({
				success: false,
				error: error.message,
			});
		}
	}
);


router.post(
	"/admin/clear-rate-limit",
	authMiddleware.authenticate,
	authMiddleware.authorize(["admin"]),
	async (req, res) => {
		try {
			const { ipAddress } = req.body;

			if (!ipAddress) {
				return res.status(400).json({
					success: false,
					error: "IP address is required",
				});
			}

			await authMiddleware.clearRateLimit(ipAddress);

			res.json({
				success: true,
				message: `Rate limit cleared for IP: ${ipAddress}`,
			});
		} catch (error) {
			res.status(500).json({
				success: false,
				error: error.message,
			});
		}
	}
);

router.get("/health", async (req, res) => {
	try {
		const db = require("../database/connection");
		const redis = require("../services/redisCacheService");

		const dbHealth = await db.healthCheck();
		const redisHealth = await redis.healthCheck();

		const overallHealth =
			dbHealth.status === "healthy" && redisHealth.status === "healthy";

		res.status(overallHealth ? 200 : 503).json({
			success: true,
			status: overallHealth ? "healthy" : "degraded",
			services: {
				database: dbHealth,
				redis: redisHealth,
			},
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		res.status(503).json({
			success: false,
			status: "unhealthy",
			error: error.message,
			timestamp: new Date().toISOString(),
		});
	}
});

if (process.env.NODE_ENV === "development") {

	router.post("/dev/clear-rate-limits", async (req, res) => {
		try {
			await authMiddleware.clearAllRateLimits();
			res.json({
				success: true,
				message: "Rate limits cleared successfully",
				timestamp: new Date().toISOString(),
			});
		} catch (error) {
			res.status(500).json({
				success: false,
				error: "Failed to clear rate limits",
				details: error.message,
			});
		}
	});
}

module.exports = router;
