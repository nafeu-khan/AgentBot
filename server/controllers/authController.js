const authService = require("../auth/authService");
const authMiddleware = require("../auth/middleware");

class AuthController {
	constructor() {
		// Bind methods to preserve 'this' context
		this.register = this.register.bind(this);
		this.login = this.login.bind(this);
		this.refreshToken = this.refreshToken.bind(this);
		this.logout = this.logout.bind(this);
		this.logoutAll = this.logoutAll.bind(this);
		this.changePassword = this.changePassword.bind(this);
		this.getProfile = this.getProfile.bind(this);
		this.updateProfile = this.updateProfile.bind(this);
		this.getSessions = this.getSessions.bind(this);
		this.revokeSession = this.revokeSession.bind(this);
		this.getConversations = this.getConversations.bind(this);
	}


	extractClientInfo(req) {
		return {
			ipAddress: req.ip || req.connection.remoteAddress,
			userAgent: req.headers["user-agent"],
		};
	}


	async register(req, res) {
		try {
			const {
				username,
				email,
				password,
				firstName,
				lastName,
			} = req.body;
			const clientInfo = this.extractClientInfo(req);

			const result = await authService.register(
				{
					username,
					email,
					password,
					firstName,
					lastName,
				},
				clientInfo
			);

			res.status(201).json(result);
		} catch (error) {
			console.error("Registration error:", error);

			let statusCode = 400;
			if (error.message.includes("already exists")) {
				statusCode = 409;
			}

			res.status(statusCode).json({
				success: false,
				error: error.message,
				code: "REGISTRATION_FAILED",
			});
		}
	}

	async login(req, res) {
		try {
			const { identifier, email, password } = req.body;
			// Use email field if provided, otherwise fall back to identifier
			const loginIdentifier = email || identifier;
			const clientInfo = this.extractClientInfo(req);
			console.log("Login attempt:", {
				loginIdentifier,
				clientInfo,
			}); // Debug log
			const result = await authService.login(
				loginIdentifier,
				password,
				clientInfo
			);

			res.json(result);
		} catch (error) {
			console.error("Login error:", error);

			let statusCode = 401;
			if (error.message.includes("deactivated")) {
				statusCode = 403;
			}

			res.status(statusCode).json({
				success: false,
				error: error.message,
				code: "LOGIN_FAILED",
			});
		}
	}


	async refreshToken(req, res) {
		try {
			const { refreshToken } = req.body;
			const clientInfo = this.extractClientInfo(req);

			if (!refreshToken) {
				return res.status(400).json({
					success: false,
					error: "Refresh token is required",
					code: "MISSING_REFRESH_TOKEN",
				});
			}
			console.log("Refresh token attempt:", { clientInfo }); // Debug log
			const result = await authService.refreshTokens(
				refreshToken,
				clientInfo
			);

			res.json(result);
		} catch (error) {
			console.error("Token refresh error:", error);

			res.status(401).json({
				success: false,
				error: error.message,
				code: "TOKEN_REFRESH_FAILED",
			});
		}
	}

	async logout(req, res) {
		try {
			const { refreshToken } = req.body;
			const accessToken = req.token?.raw;

			const result = await authService.logout(
				accessToken,
				refreshToken
			);

			res.json(result);
		} catch (error) {
			console.error("Logout error:", error);

			// Always return success for logout
			res.json({
				success: true,
				message: "Logout completed",
			});
		}
	}


	async logoutAll(req, res) {
		try {
			const userId = req.user.id;

			const result = await authService.logoutAll(userId);

			res.json(result);
		} catch (error) {
			console.error("Logout all error:", error);

			res.status(500).json({
				success: false,
				error: "Failed to logout from all devices",
				code: "LOGOUT_ALL_FAILED",
			});
		}
	}


	async changePassword(req, res) {
		try {
			const { currentPassword, newPassword } = req.body;
			const userId = req.user.id;

			const result = await authService.changePassword(
				userId,
				currentPassword,
				newPassword
			);

			res.json(result);
		} catch (error) {
			console.error("Change password error:", error);

			let statusCode = 400;
			if (error.message.includes("incorrect")) {
				statusCode = 401;
			}

			res.status(statusCode).json({
				success: false,
				error: error.message,
				code: "PASSWORD_CHANGE_FAILED",
			});
		}
	}


	async getProfile(req, res) {
		try {
			const userId = req.user.id;

			const result = await authService.getUserProfile(userId);

			res.json(result);
		} catch (error) {
			console.error("Get profile error:", error);

			res.status(500).json({
				success: false,
				error: "Failed to get user profile",
				code: "PROFILE_FETCH_FAILED",
			});
		}
	}


	async updateProfile(req, res) {
		try {
			const userId = req.user.id;
			const { firstName, lastName, email } = req.body;

			const User = require("../models/User");
			const updatedUser = await User.updateProfile(userId, {
				first_name: firstName,
				last_name: lastName,
				email,
			});

			res.json({
				success: true,
				message: "Profile updated successfully",
				user: updatedUser,
			});
		} catch (error) {
			console.error("Update profile error:", error);

			let statusCode = 400;
			if (error.message.includes("already exists")) {
				statusCode = 409;
			}

			res.status(statusCode).json({
				success: false,
				error: error.message,
				code: "PROFILE_UPDATE_FAILED",
			});
		}
	}

	async getSessions(req, res) {
		try {
			const userId = req.user.id;
			const User = require("../models/User");

			const sessions = await User.getUserActiveSessions(
				userId
			);

			res.json({
				success: true,
				sessions: sessions.map((session) => ({
					id: session.id,
					createdAt: session.created_at,
					lastActivity: session.updated_at,
					ipAddress: session.ip_address,
					userAgent: session.user_agent,
					isCurrent:
						session.id ===
						req.token?.sessionId,
				})),
			});
		} catch (error) {
			console.error("Get sessions error:", error);

			res.status(500).json({
				success: false,
				error: "Failed to get sessions",
				code: "SESSIONS_FETCH_FAILED",
			});
		}
	}


	async revokeSession(req, res) {
		try {
			const { sessionId } = req.params;
			const userId = req.user.id;
			const User = require("../models/User");

			// Verify session belongs to user
			const session = await User.findSessionById(sessionId);
			if (!session || session.user_id !== userId) {
				return res.status(403).json({
					success: false,
					error: "Access denied to session",
					code: "SESSION_ACCESS_DENIED",
				});
			}

			// Revoke session
			await User.revokeSession(sessionId);

			// Remove refresh token
			await authService.removeRefreshToken(userId, sessionId);

			res.json({
				success: true,
				message: "Session revoked successfully",
			});
		} catch (error) {
			console.error("Revoke session error:", error);

			res.status(500).json({
				success: false,
				error: "Failed to revoke session",
				code: "SESSION_REVOKE_FAILED",
			});
		}
	}


	async getConversations(req, res) {
		try {
			const userId = req.user.id;
			const { limit = 20, offset = 0 } = req.query;
			const User = require("../models/User");

			const conversations = await User.getUserConversations(
				userId,
				parseInt(limit),
				parseInt(offset)
			);

			res.json({
				success: true,
				conversations: conversations.map((conv) => ({
					id: conv.id,
					title: conv.title,
					createdAt: conv.created_at,
					updatedAt: conv.updated_at,
					messageCount: conv.message_count,
				})),
				pagination: {
					limit: parseInt(limit),
					offset: parseInt(offset),
					hasMore:
						conversations.length ===
						parseInt(limit),
				},
			});
		} catch (error) {
			console.error("Get conversations error:", error);

			res.status(500).json({
				success: false,
				error: "Failed to get conversations",
				code: "CONVERSATIONS_FETCH_FAILED",
			});
		}
	}


	async verifyToken(req, res) {
		try {
			const jwtService = require("../auth/jwtService");
			const token = req.token?.raw;

			if (!token) {
				return res.status(400).json({
					success: false,
					error: "No token provided",
				});
			}

			const tokenInfo = jwtService.getTokenInfo(token);

			res.json({
				success: true,
				token: tokenInfo,
				user: req.user,
				session: req.session
					? {
							id: req.session.id,
							createdAt: req.session
								.created_at,
							updatedAt: req.session
								.updated_at,
					  }
					: null,
			});
		} catch (error) {
			res.status(500).json({
				success: false,
				error: error.message,
			});
		}
	}
}

module.exports = new AuthController();
