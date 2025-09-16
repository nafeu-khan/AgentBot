const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const db = require("../database/connection");


class UserModel {
	constructor() {
		this.tableName = "users";
		this.sessionTableName = "user_sessions";
		this.conversationTableName = "chat_conversations";
		this.messageTableName = "chat_messages";
	}

	async create(userData) {
		const {
			username,
			email,
			password,
			firstName,
			lastName,
			role = "user",
		} = userData;

		const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
		const passwordHash = await bcrypt.hash(password, saltRounds);

		const query = `
            INSERT INTO ${this.tableName} 
            (username, email, password_hash, first_name, last_name, role)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

		try {
			const result = await db.query(query, [
				username,
				email,
				passwordHash,
				firstName || null,
				lastName || null,
				role,
			]);

			const user = await this.findById(result.insertId);
			return this.sanitizeUser(user);
		} catch (error) {
			if (error.code === "ER_DUP_ENTRY") {
				if (error.message.includes("username")) {
					throw new Error(
						"Username already exists"
					);
				}
				if (error.message.includes("email")) {
					throw new Error("Email already exists");
				}
			}
			throw error;
		}
	}

	async findById(id) {
		const query = `SELECT * FROM ${this.tableName} WHERE id = ? AND is_active = true`;
		const results = await db.query(query, [id]);
		return results[0] || null;
	}

	async findByUsername(username) {
		const query = `SELECT * FROM ${this.tableName} WHERE username = ? AND is_active = true`;
		const results = await db.query(query, [username]);
		return results[0] || null;
	}

	async findByEmail(email) {
		const query = `SELECT * FROM ${this.tableName} WHERE email = ? AND is_active = true`;
		const results = await db.query(query, [email]);
		return results[0] || null;
	}

	async verifyPassword(password, hashedPassword) {
		return await bcrypt.compare(password, hashedPassword);
	}

	async updateLastLogin(userId) {
		const query = `UPDATE ${this.tableName} SET last_login = NOW() WHERE id = ?`;
		await db.query(query, [userId]);
	}

	async updateProfile(userId, updateData) {
		const allowedFields = ["first_name", "last_name", "email"];
		const updateFields = [];
		const values = [];

		Object.keys(updateData).forEach((key) => {
			if (
				allowedFields.includes(key) &&
				updateData[key] !== undefined
			) {
				updateFields.push(`${key} = ?`);
				values.push(updateData[key]);
			}
		});

		if (updateFields.length === 0) {
			throw new Error("No valid fields to update");
		}

		values.push(userId);
		const query = `
            UPDATE ${this.tableName} 
            SET ${updateFields.join(", ")}, updated_at = NOW() 
            WHERE id = ?
        `;

		await db.query(query, values);
		const user = await this.findById(userId);
		return this.sanitizeUser(user);
	}

	async changePassword(userId, newPassword) {
		const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
		const passwordHash = await bcrypt.hash(newPassword, saltRounds);

		const query = `
            UPDATE ${this.tableName} 
            SET password_hash = ?, updated_at = NOW() 
            WHERE id = ?
        `;

		await db.query(query, [passwordHash, userId]);
	}

	async createSession(
		userId,
		sessionData = {},
		ipAddress = null,
		userAgent = null
	) {
		const sessionId = uuidv4();
		const expiresAt = new Date();
		expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours from now

		const query = `
            INSERT INTO ${this.sessionTableName} 
            (id, user_id, session_data, expires_at, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

		await db.query(query, [
			sessionId,
			userId,
			JSON.stringify(sessionData),
			expiresAt,
			ipAddress,
			userAgent,
		]);

		return sessionId;
	}

	async findSessionById(sessionId) {
		const query = `
            SELECT s.*, u.username, u.email, u.role 
            FROM ${this.sessionTableName} s
            JOIN ${this.tableName} u ON s.user_id = u.id
            WHERE s.id = ? AND s.is_active = true AND s.expires_at > NOW()
        `;

		const results = await db.query(query, [sessionId]);
		const session = results[0];

		if (session) {
			// Handle both string and object cases for session_data
			if (typeof session.session_data === "string") {
				try {
					session.session_data = JSON.parse(
						session.session_data || "{}"
					);
				} catch (error) {
					console.error(
						"Error parsing session_data:",
						error
					);
					session.session_data = {};
				}
			} else if (!session.session_data) {
				session.session_data = {};
			}
		}

		return session || null;
	}


	async updateSessionActivity(sessionId) {
		const query = `
            UPDATE ${this.sessionTableName} 
            SET updated_at = NOW() 
            WHERE id = ? AND is_active = true
        `;
		await db.query(query, [sessionId]);
	}


	async revokeSession(sessionId) {
		const query = `
            UPDATE ${this.sessionTableName} 
            SET is_active = false 
            WHERE id = ?
        `;
		await db.query(query, [sessionId]);
	}


	async revokeAllUserSessions(userId) {
		const query = `
            UPDATE ${this.sessionTableName} 
            SET is_active = false 
            WHERE user_id = ?
        `;
		await db.query(query, [userId]);
	}

	async getUserActiveSessions(userId) {
		const query = `
            SELECT id, created_at, ip_address, user_agent, updated_at
            FROM ${this.sessionTableName}
            WHERE user_id = ? AND is_active = true AND expires_at > NOW()
            ORDER BY updated_at DESC
        `;
		return await db.query(query, [userId]);
	}


	async createConversation(userId, title = null) {
		const conversationId = uuidv4();
		const query = `
            INSERT INTO ${this.conversationTableName} 
            (id, user_id, title)
            VALUES (?, ?, ?)
        `;

		await db.query(query, [conversationId, userId, title]);
		return conversationId;
	}

	async getUserConversations(userId, limit = 20, offset = 0) {
		// Ensure parameters are integers and valid
		const limitInt = Math.max(
			1,
			Math.min(parseInt(limit, 10) || 20, 100)
		); // Max 100
		const offsetInt = Math.max(0, parseInt(offset, 10) || 0);
		const userIdInt = parseInt(userId, 10);

		// Validate userId
		if (isNaN(userIdInt) || userIdInt <= 0) {
			throw new Error("Invalid user ID provided");
		}

		// Build query with LIMIT and OFFSET as direct values to avoid MySQL parameter binding issues
		const query = `
            SELECT id, title, created_at, updated_at, message_count
            FROM ${this.conversationTableName}
            WHERE user_id = ? AND is_active = true
            ORDER BY updated_at DESC
            LIMIT ${limitInt} OFFSET ${offsetInt}
        `;

		try {
			const results = await db.query(query, [userIdInt]);
			return results;
		} catch (error) {
			console.error(
				"Database error in getUserConversations:",
				{
					userId: userIdInt,
					limit: limitInt,
					offset: offsetInt,
					error: error.message,
				}
			);
			throw error;
		}
	}

	async getConversationById(conversationId, userId) {
		const query = `
            SELECT * FROM ${this.conversationTableName}
            WHERE id = ? AND user_id = ? AND is_active = true
        `;
		const results = await db.query(query, [conversationId, userId]);
		return results[0] || null;
	}

	async getConversationByIdDirect(conversationId) {
		const query = `
            SELECT * FROM ${this.conversationTableName}
            WHERE id = ? AND is_active = true
        `;
		const results = await db.query(query, [conversationId]);
		return results[0] || null;
	}


	async saveMessage(
		conversationId,
		role,
		content,
		metadata = {},
		userId = null
	) {
		const messageId = uuidv4();

		// If userId is not provided, try to get it from the conversation
		if (!userId) {
			const conversation =
				await this.getConversationByIdDirect(
					conversationId
				);
			if (conversation) {
				userId = conversation.user_id;
			} else {
				console.warn(
					"Cannot save message: conversation not found or userId not provided"
				);
				return null;
			}
		}

		const query = `
            INSERT INTO ${this.messageTableName} 
            (id, conversation_id, user_id, role, content, metadata, created_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        `;

		await db.query(query, [
			messageId,
			conversationId,
			userId,
			role,
			content,
			JSON.stringify(metadata),
		]);

		// Update conversation's message count and last activity
		await this.updateConversationActivity(conversationId);

		return messageId;
	}

	async getConversationMessages(conversationId, limit = 50, offset = 0) {
		// Ensure parameters are valid integers
		const limitInt = Math.max(
			1,
			Math.min(parseInt(limit, 10) || 50, 200)
		); // Max 200
		const offsetInt = Math.max(0, parseInt(offset, 10) || 0);

		const query = `
            SELECT id, role, content, metadata, created_at
            FROM ${this.messageTableName}
            WHERE conversation_id = ?
            ORDER BY created_at ASC
            LIMIT ${limitInt} OFFSET ${offsetInt}
        `;
		const messages = await db.query(query, [conversationId]);

		// Parse metadata JSON
		return messages.map((msg) => ({
			...msg,
			metadata:
				typeof msg.metadata === "string"
					? JSON.parse(msg.metadata)
					: msg.metadata,
			timestamp: msg.created_at,
		}));
	}


	async updateConversationActivity(conversationId) {
		const query = `
            UPDATE ${this.conversationTableName} 
            SET updated_at = NOW(), 
                message_count = (
                    SELECT COUNT(*) FROM ${this.messageTableName} 
                    WHERE conversation_id = ?
                )
            WHERE id = ?
        `;
		await db.query(query, [conversationId, conversationId]);
	}


	async getOrCreateConversation(
		userId,
		conversationId = null,
		title = null
	) {
		if (conversationId) {
			const conversation = await this.getConversationById(
				conversationId,
				userId
			);
			if (conversation) {
				return conversationId;
			}
		}

		// Create new conversation
		return await this.createConversation(
			userId,
			title || "New Conversation"
		);
	}

	sanitizeUser(user) {
		if (!user) return null;

		const { password_hash, ...sanitizedUser } = user;
		return sanitizedUser;
	}


	async cleanupExpiredSessions() {
		const query = `
            UPDATE ${this.sessionTableName} 
            SET is_active = false 
            WHERE expires_at <= NOW() AND is_active = true
        `;
		const result = await db.query(query);
		return result.affectedRows;
	}
}

module.exports = new UserModel();
