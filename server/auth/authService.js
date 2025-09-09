const User = require("../models/User");
const jwtService = require("./jwtService");
const authMiddleware = require("./middleware");
const redisCacheService = require("../services/redisCacheService");
const { body, validationResult } = require("express-validator");


class AuthService {
	constructor() {
		this.refreshTokenPrefix = "refresh_token:";
		this.userSessionPrefix = "user_sessions:";
	}

	async register(userData, clientInfo = {}) {
		try {
			const user = await User.create(userData);

			const sessionId = await User.createSession(
				user.id,
				{ registrationMethod: "email" },
				clientInfo.ipAddress,
				clientInfo.userAgent
			);

			const tokens = jwtService.generateTokenPair(
				user,
				sessionId
			);

			await this.storeRefreshToken(
				user.id,
				tokens.refreshToken,
				sessionId
			);
			await User.updateLastLogin(user.id);

			return {
				success: true,
				message: "User registered successfully",
				user: tokens.user,
				tokens: {
					accessToken: tokens.accessToken,
					refreshToken: tokens.refreshToken,
					tokenType: tokens.tokenType,
					expiresIn: tokens.expiresIn,
				},
				sessionId,
			};
		} catch (error) {
			throw error;
		}
	}

	async login(identifier, password, clientInfo = {}) {
		try {
			// Find user by username or email
			let user = await User.findByUsername(identifier);
			if (!user) {
				user = await User.findByEmail(identifier);
			}

			if (!user) {
				throw new Error("Invalid credentials");
			}

			const isPasswordValid = await User.verifyPassword(
				password,
				user.password_hash
			);
			if (!isPasswordValid) {
				throw new Error("Invalid credentials");
			}

			if (!user.is_active) {
				throw new Error("Account is deactivated");
			}

			// Create session
			const sessionId = await User.createSession(
				user.id,
				{ loginMethod: "password" },
				clientInfo.ipAddress,
				clientInfo.userAgent
			);

			// Generate token pair
			const tokens = jwtService.generateTokenPair(
				user,
				sessionId
			);

			// Store refresh token
			await this.storeRefreshToken(
				user.id,
				tokens.refreshToken,
				sessionId
			);

			// Update last login
			await User.updateLastLogin(user.id);

			return {
				success: true,
				message: "Login successful",
				user: tokens.user,
				tokens: {
					accessToken: tokens.accessToken,
					refreshToken: tokens.refreshToken,
					tokenType: tokens.tokenType,
					expiresIn: tokens.expiresIn,
				},
				sessionId,
			};
		} catch (error) {
			throw error;
		}
	}
	async refreshTokens(refreshToken, clientInfo = {}) {
		try {
			// Verify refresh token
			const decoded =
				jwtService.verifyRefreshToken(refreshToken);

			// Get user
			const user = await User.findById(decoded.userId);
			if (!user) {
				throw new Error("User not found");
			}

			// Verify session
			const session = await User.findSessionById(
				decoded.sessionId
			);
			if (!session) {
				throw new Error("Session expired");
			}

			// Verify stored refresh token
			const storedToken = await this.getStoredRefreshToken(
				decoded.userId,
				decoded.sessionId
			);
			if (!storedToken || storedToken !== refreshToken) {
				throw new Error("Invalid refresh token");
			}

			// Generate new token pair
			const tokens = jwtService.generateTokenPair(
				user,
				decoded.sessionId
			);

			// Store new refresh token
			await this.storeRefreshToken(
				decoded.userId,
				tokens.refreshToken,
				decoded.sessionId
			);

			// Update session activity
			await User.updateSessionActivity(decoded.sessionId);

			return {
				success: true,
				message: "Tokens refreshed successfully",
				tokens: {
					accessToken: tokens.accessToken,
					refreshToken: tokens.refreshToken,
					tokenType: tokens.tokenType,
					expiresIn: tokens.expiresIn,
				},
			};
		} catch (error) {
			throw error;
		}
	}

	async logout(accessToken, refreshToken) {
		try {
			const decoded =
				jwtService.verifyAccessToken(accessToken);

			// Blacklist access token
			await authMiddleware.blacklistToken(accessToken);

			// Remove refresh token
			await this.removeRefreshToken(
				decoded.userId,
				decoded.sessionId
			);

			// Revoke session
			await User.revokeSession(decoded.sessionId);

			return {
				success: true,
				message: "Logout successful",
			};
		} catch (error) {
			// Still logout even if token verification fails
			return {
				success: true,
				message: "Logout successful",
			};
		}
	}

	async logoutAll(userId) {
		try {
			// Revoke all user sessions
			await User.revokeAllUserSessions(userId);

			// Remove all refresh tokens for user
			await this.removeAllUserRefreshTokens(userId);

			return {
				success: true,
				message: "Logged out from all devices",
			};
		} catch (error) {
			throw error;
		}
	}

	async changePassword(userId, currentPassword, newPassword) {
		try {
			const user = await User.findById(userId);
			if (!user) {
				throw new Error("User not found");
			}

			// Verify current password
			const isCurrentPasswordValid =
				await User.verifyPassword(
					currentPassword,
					user.password_hash
				);
			if (!isCurrentPasswordValid) {
				throw new Error(
					"Current password is incorrect"
				);
			}

			// Update password
			await User.changePassword(userId, newPassword);

			// Logout from all devices for security
			await this.logoutAll(userId);

			return {
				success: true,
				message: "Password changed successfully. Please login again.",
			};
		} catch (error) {
			throw error;
		}
	}

	async getUserProfile(userId) {
		try {
			const user = await User.findById(userId);
			if (!user) {
				throw new Error("User not found");
			}

			const activeSessions = await User.getUserActiveSessions(
				userId
			);
			const conversations = await User.getUserConversations(
				userId,
				10
			);

			return {
				success: true,
				user: User.sanitizeUser(user),
				stats: {
					activeSessions: activeSessions.length,
					totalConversations:
						conversations.length,
					lastLogin: user.last_login,
				},
				activeSessions: activeSessions.map(
					(session) => ({
						id: session.id,
						createdAt: session.created_at,
						lastActivity:
							session.updated_at,
						ipAddress: session.ip_address,
						userAgent: session.user_agent,
					})
				),
			};
		} catch (error) {
			throw error;
		}
	}


	async storeRefreshToken(userId, refreshToken, sessionId) {
		try {
			const key = `${this.refreshTokenPrefix}${userId}:${sessionId}`;
			const expiry = jwtService.parseExpiry(
				process.env.JWT_REFRESH_EXPIRY || "7d"
			);
			await redisCacheService.set(key, refreshToken, expiry);
		} catch (error) {
			console.error("Store refresh token error:", error);
		}
	}


	async getStoredRefreshToken(userId, sessionId) {
		try {
			const key = `${this.refreshTokenPrefix}${userId}:${sessionId}`;
			return await redisCacheService.get(key);
		} catch (error) {
			console.error("Get refresh token error:", error);
			return null;
		}
	}


	async removeRefreshToken(userId, sessionId) {
		try {
			const key = `${this.refreshTokenPrefix}${userId}:${sessionId}`;
			await redisCacheService.delete(key);
		} catch (error) {
			console.error("Remove refresh token error:", error);
		}
	}

	async removeAllUserRefreshTokens(userId) {
		try {
			const pattern = `${this.refreshTokenPrefix}${userId}:*`;
			const keys = await redisCacheService.getKeysByPattern(
				pattern
			);

			if (keys.length > 0) {
				await redisCacheService.deleteMultiple(keys);
			}
		} catch (error) {
			console.error(
				"Remove all refresh tokens error:",
				error
			);
		}
	}

	getRegistrationValidation() {
		return [
			body("username")
				.isLength({ min: 3, max: 50 })
				.matches(/^[a-zA-Z0-9_]+$/)
				.withMessage(
					"Username must be 3-50 characters and contain only letters, numbers, and underscores"
				),
			body("email")
				.isEmail()
				.normalizeEmail()
				.withMessage("Valid email is required"),
			body("password")
				.isLength({ min: 8 })
				// .matches(
				// 	/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
				// )
				.withMessage(
					"Password must be at least 8 characters with uppercase, lowercase, number, and special character"
				),
			body("firstName")
				.optional()
				.isLength({ min: 1, max: 50 })
				.withMessage(
					"First name must be 1-50 characters"
				),
			body("lastName")
				.optional()
				.isLength({ min: 1, max: 50 })
				.withMessage(
					"Last name must be 1-50 characters"
				),
		];
	}

	getLoginValidation() {
		return [
			body().custom((value, { req }) => {
				// Accept either identifier or email field
				if (!req.body.identifier && !req.body.email) {
					throw new Error(
						"Username or email is required"
					);
				}
				return true;
			}),
			body("password")
				.notEmpty()
				.withMessage("Password is required"),
		];
	}

	getPasswordChangeValidation() {
		return [
			body("currentPassword")
				.notEmpty()
				.withMessage("Current password is required"),
			body("newPassword")
				.isLength({ min: 8 })
				.matches(
					/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
				)
				.withMessage(
					"New password must be at least 8 characters with uppercase, lowercase, number, and special character"
				),
		];
	}

	handleValidationErrors(req, res, next) {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			console.log(
				"Validation errors:",
				errors.array(),
				req.body
			);
			return res.status(400).json({
				success: false,
				error: "Validation failed",
				details: errors.array(),
			});
		}
		next();
	}
}

module.exports = new AuthService();
