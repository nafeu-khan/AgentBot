const jwtService = require("./jwtService");
const User = require("../models/User");
const redisCacheService = require("../services/redisCacheService");


class AuthMiddleware {
	constructor() {
		this.tokenBlacklistPrefix = "blacklist:token:";
		this.rateLimitPrefix = "rate_limit:auth:";
	}


	authenticate = async (req, res, next) => {
		try {
			const authHeader = req.headers.authorization;
			const token = jwtService.extractTokenFromHeader(authHeader);

			if (!token) {
				return res.status(401).json({
					success: false,
					error: "Access token required",
					code: "MISSING_TOKEN",
				});
			}

			// Check if token is blacklisted
			const isBlacklisted = await this.isTokenBlacklisted(token);
			if (isBlacklisted) {
				return res.status(401).json({
					success: false,
					error: "Token has been revoked",
					code: "TOKEN_REVOKED",
				});
			}

			// Verify token
			const decoded = jwtService.verifyAccessToken(token);

			// Get user from database
			const user = await User.findById(decoded.userId);
			if (!user) {
				return res.status(401).json({
					success: false,
					error: "User not found",
					code: "USER_NOT_FOUND",
				});
			}

			// Verify session is still active
			if (decoded.sessionId) {
				const session = await User.findSessionById(decoded.sessionId);
				if (!session) {
					return res.status(401).json({
						success: false,
						error: "Session expired",
						code: "SESSION_EXPIRED",
					});
				}

				// Update session activity
				await User.updateSessionActivity(decoded.sessionId);
				req.session = session;
			}

			// Add user and token info to request
			req.user = User.sanitizeUser(user);
			req.token = {
				raw: token,
				decoded: decoded,
				sessionId: decoded.sessionId,
			};

			next();
		} catch (error) {
			console.error("Authentication error:", error.message);

			let errorCode = "AUTH_ERROR";
			let statusCode = 401;

			if (error.message.includes("expired")) {
				errorCode = "TOKEN_EXPIRED";
			} else if (error.message.includes("invalid")) {
				errorCode = "INVALID_TOKEN";
			}

			return res.status(statusCode).json({
				success: false,
				error: error.message,
				code: errorCode,
			});
		}
	};

	async optionalAuth(req, res, next) {
		try {
			const authHeader = req.headers.authorization;
			const token = jwtService.extractTokenFromHeader(authHeader);

			if (token) {
				const isBlacklisted = await this.isTokenBlacklisted(token);
				if (!isBlacklisted) {
					const decoded = jwtService.verifyAccessToken(token);
					const user = await User.findById(decoded.userId);

					if (user) {
						req.user = User.sanitizeUser(user);
						req.token = {
							raw: token,
							decoded: decoded,
							sessionId: decoded.sessionId,
						};
					}
				}
			}
		} catch (error) {
			// Silent fail for optional auth
			console.warn("Optional auth warning:", error.message);
		}

		next();
	}


	authorize(allowedRoles) {
		const roles = Array.isArray(allowedRoles)
			? allowedRoles
			: [allowedRoles];

		return (req, res, next) => {
			if (!req.user) {
				return res.status(401).json({
					success: false,
					error: "Authentication required",
					code: "AUTH_REQUIRED",
				});
			}

			if (!roles.includes(req.user.role)) {
				return res.status(403).json({
					success: false,
					error: "Insufficient permissions",
					code: "INSUFFICIENT_PERMISSIONS",
					required: roles,
					current: req.user.role,
				});
			}

			next();
		};
	}


	rateLimit(maxAttempts = 5, windowMs = 15 * 60 * 1000) {
		return async (req, res, next) => {
			try {
				const identifier = req.ip || req.connection.remoteAddress;
				const key = `${this.rateLimitPrefix}${identifier}`;

				const attempts = (await redisCacheService.get(key)) || 0;

				if (attempts >= maxAttempts) {
					// Calculate remaining time since Redis doesn't have getTTL method
					const remainingTime = Math.floor(windowMs / 1000);
					return res.status(429).json({
						success: false,
						error: "Too many authentication attempts",
						code: "RATE_LIMIT_EXCEEDED",
						retryAfter: remainingTime,
					});
				}

				// Increment attempts using the correct method name
				await redisCacheService.set(
					key,
					attempts + 1,
					Math.floor(windowMs / 1000)
				);

				next();
			} catch (error) {
				console.error("Rate limiting error:", error);
				next(); // Continue on rate limit error
			}
		};
	}


	async verifySessionOwnership(req, res, next) {
		try {
			const { sessionId } = req.params;
			const userId = req.user.id;

			if (!sessionId) {
				return res.status(400).json({
					success: false,
					error: "Session ID required",
					code: "MISSING_SESSION_ID",
				});
			}

			// Check if session belongs to user
			const session = await User.findSessionById(sessionId);
			if (!session || session.user_id !== userId) {
				return res.status(403).json({
					success: false,
					error: "Access denied to session",
					code: "SESSION_ACCESS_DENIED",
				});
			}

			req.verifiedSession = session;
			next();
		} catch (error) {
			console.error("Session verification error:", error);
			return res.status(500).json({
				success: false,
				error: "Session verification failed",
				code: "SESSION_VERIFICATION_ERROR",
			});
		}
	}


	async verifyConversationOwnership(req, res, next) {
		try {
			const { conversationId } = req.params;
			const userId = req.user.id;

			if (!conversationId) {
				return res.status(400).json({
					success: false,
					error: "Conversation ID required",
					code: "MISSING_CONVERSATION_ID",
				});
			}

			// Check if conversation belongs to user
			const conversation = await User.getConversationById(
				conversationId,
				userId
			);
			if (!conversation) {
				return res.status(403).json({
					success: false,
					error: "Access denied to conversation",
					code: "CONVERSATION_ACCESS_DENIED",
				});
			}

			req.verifiedConversation = conversation;
			next();
		} catch (error) {
			console.error("Conversation verification error:", error);
			return res.status(500).json({
				success: false,
				error: "Conversation verification failed",
				code: "CONVERSATION_VERIFICATION_ERROR",
			});
		}
	}


	async isTokenBlacklisted(token) {
		try {
			const decoded = jwtService.decodeToken(token);
			if (!decoded || !decoded.payload.jti) return false;

			const key = `${this.tokenBlacklistPrefix}${decoded.payload.jti}`;
			const blacklisted = await redisCacheService.get(key);
			return blacklisted !== null;
		} catch (error) {
			console.error("Blacklist check error:", error);
			return false;
		}
	}


	async blacklistToken(token) {
		try {
			const decoded = jwtService.decodeToken(token);
			if (!decoded || !decoded.payload.jti) return;

			const key = `${this.tokenBlacklistPrefix}${decoded.payload.jti}`;
			const expiry = decoded.payload.exp
				? decoded.payload.exp - Math.floor(Date.now() / 1000)
				: 3600; // 1 hour default

			if (expiry > 0) {
				await redisCacheService.set(key, "1", expiry);
			}
		} catch (error) {
			console.error("Token blacklist error:", error);
		}
	}


	async clearRateLimit(ipAddress) {
		try {
			const key = `${this.rateLimitPrefix}${ipAddress}`;
			await redisCacheService.del(key);
		} catch (error) {
			console.error("Clear rate limit error:", error);
		}
	}


	async clearAllRateLimits() {
		try {
			// This is a simplified approach - in production you'd want to scan for keys
			const keys =
				(await redisCacheService.client?.keys(
					`${this.rateLimitPrefix}*`
				)) || [];
			for (const key of keys) {
				await redisCacheService.del(key);
			}
			console.log(`Cleared ${keys.length} rate limit entries`);
		} catch (error) {
			console.error("Clear all rate limits error:", error);
		}
	}


	extractSessionInfo(req) {
		return {
			userId: req.user?.id,
			sessionId: req.token?.sessionId,
			ipAddress: req.ip || req.connection.remoteAddress,
			userAgent: req.headers["user-agent"],
			timestamp: new Date().toISOString(),
		};
	}
}

module.exports = new AuthMiddleware();
