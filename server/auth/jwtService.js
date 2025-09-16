const jwt = require("jsonwebtoken");
const crypto = require("crypto");
require("dotenv").config();


class JWTService {
	constructor() {
		this.accessTokenSecret =
			process.env.JWT_ACCESS_SECRET || this.generateSecret();
		this.refreshTokenSecret =
			process.env.JWT_REFRESH_SECRET || this.generateSecret();
		this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || "15m";
		this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || "7d";
		this.issuer = process.env.JWT_ISSUER || "taskjs-server";
		this.audience = process.env.JWT_AUDIENCE || "taskjs-client";
	}

	generateSecret() {
		return crypto.randomBytes(64).toString("hex");
	}

	generateAccessToken(payload, options = {}) {
		const tokenPayload = {
			type: "access",
			...payload,
			iat: Math.floor(Date.now() / 1000),
		};

		const tokenOptions = {
			expiresIn: options.expiresIn || this.accessTokenExpiry,
			issuer: this.issuer,
			audience: this.audience,
			subject: payload.userId?.toString(),
			...options,
		};

		return jwt.sign(tokenPayload, this.accessTokenSecret, tokenOptions);
	}

	generateRefreshToken(payload, options = {}) {
		const tokenPayload = {
			type: "refresh",
			userId: payload.userId,
			sessionId: payload.sessionId,
			iat: Math.floor(Date.now() / 1000),
		};

		const tokenOptions = {
			expiresIn: options.expiresIn || this.refreshTokenExpiry,
			issuer: this.issuer,
			audience: this.audience,
			subject: payload.userId?.toString(),
			...options,
		};

		return jwt.sign(tokenPayload, this.refreshTokenSecret, tokenOptions);
	}

	generateTokenPair(user, sessionId, options = {}) {
		const payload = {
			userId: user.id,
			username: user.username,
			email: user.email,
			role: user.role,
			sessionId: sessionId,
		};

		const accessToken = this.generateAccessToken(payload, options.access);
		const refreshToken = this.generateRefreshToken(
			{
				userId: user.id,
				sessionId,
			},
			options.refresh
		);

		return {
			accessToken,
			refreshToken,
			tokenType: "Bearer",
			expiresIn: this.parseExpiry(this.accessTokenExpiry),
			issuedAt: new Date().toISOString(),
			user: {
				id: user.id,
				username: user.username,
				email: user.email,
				role: user.role,
				firstName: user.first_name,
				lastName: user.last_name,
			},
		};
	}


	verifyAccessToken(token, options = {}) {
		try {
			const verifyOptions = {
				issuer: this.issuer,
				audience: this.audience,
				...options,
			};

			const decoded = jwt.verify(
				token,
				this.accessTokenSecret,
				verifyOptions
			);

			if (decoded.type !== "access") {
				throw new Error("Invalid token type");
			}

			return decoded;
		} catch (error) {
			if (error.name === "TokenExpiredError") {
				throw new Error("Access token expired");
			} else if (error.name === "JsonWebTokenError") {
				throw new Error("Invalid access token");
			} else if (error.name === "NotBeforeError") {
				throw new Error("Access token not active");
			}
			throw error;
		}
	}

	verifyRefreshToken(token, options = {}) {
		try {
			const verifyOptions = {
				issuer: this.issuer,
				audience: this.audience,
				...options,
			};

			const decoded = jwt.verify(
				token,
				this.refreshTokenSecret,
				verifyOptions
			);

			if (decoded.type !== "refresh") {
				throw new Error("Invalid token type");
			}

			return decoded;
		} catch (error) {
			if (error.name === "TokenExpiredError") {
				throw new Error("Refresh token expired");
			} else if (error.name === "JsonWebTokenError") {
				throw new Error("Invalid refresh token");
			} else if (error.name === "NotBeforeError") {
				throw new Error("Refresh token not active");
			}
			throw error;
		}
	}

	decodeToken(token) {
		return jwt.decode(token, { complete: true });
	}


	extractTokenFromHeader(authHeader) {
		if (!authHeader) return null;

		const parts = authHeader.split(" ");
		if (parts.length !== 2 || parts[0] !== "Bearer") {
			return null;
		}

		return parts[1];
	}


	isTokenExpired(token) {
		try {
			const decoded = jwt.decode(token);
			if (!decoded || !decoded.exp) return true;

			return decoded.exp < Math.floor(Date.now() / 1000);
		} catch (error) {
			return true;
		}
	}

	getTokenExpiration(token) {
		try {
			const decoded = jwt.decode(token);
			if (!decoded || !decoded.exp) return null;

			return new Date(decoded.exp * 1000);
		} catch (error) {
			return null;
		}
	}


	parseExpiry(expiry) {
		const units = {
			s: 1,
			m: 60,
			h: 3600,
			d: 86400,
		};

		const match = expiry.match(/^(\d+)([smhd])$/);
		if (!match) return 900; // Default 15 minutes

		const [, value, unit] = match;
		return parseInt(value) * units[unit];
	}

	generateSecureToken(length = 32) {
		return crypto.randomBytes(length).toString("hex");
	}


	hashToken(token) {
		return crypto.createHash("sha256").update(token).digest("hex");
	}


	verifyHashedToken(token, hashedToken) {
		const computedHash = this.hashToken(token);
		return crypto.timingSafeEqual(
			Buffer.from(hashedToken, "hex"),
			Buffer.from(computedHash, "hex")
		);
	}


	createBlacklistEntry(token) {
		const decoded = jwt.decode(token);
		return {
			jti: decoded?.jti || crypto.randomUUID(),
			exp: decoded?.exp || Math.floor(Date.now() / 1000) + 86400,
			blacklistedAt: Math.floor(Date.now() / 1000),
		};
	}

	getTokenInfo(token) {
		try {
			const decoded = jwt.decode(token, { complete: true });
			if (!decoded) return null;

			return {
				header: decoded.header,
				payload: {
					...decoded.payload,
					issuedAt: new Date(
						decoded.payload.iat * 1000
					).toISOString(),
					expiresAt: decoded.payload.exp
						? new Date(decoded.payload.exp * 1000).toISOString()
						: null,
				},
				isExpired: this.isTokenExpired(token),
				expiresIn: decoded.payload.exp
					? decoded.payload.exp - Math.floor(Date.now() / 1000)
					: null,
			};
		} catch (error) {
			return { error: error.message };
		}
	}
}

module.exports = new JWTService();
