const mysql = require("mysql2/promise");
require("dotenv").config();

class DatabaseConnection {
	constructor() {
		this.pool = null;
		this.isConnected = false;
	}

	async initialize() {
		try {
			this.pool = mysql.createPool({
				host: process.env.DB_HOST || "localhost",
				port: process.env.DB_PORT || 3306,
				user: process.env.DB_USER || "root",
				password: process.env.DB_PASSWORD || "",
				database: process.env.DB_NAME || "taskjs_db",
				waitForConnections: true,
				connectionLimit:
					parseInt(
						process.env.DB_CONNECTION_LIMIT
					) || 10,
				queueLimit: 0,
				acquireTimeout: 60000,
				timeout: 60000,
				reconnect: true,
			});

			// Test connection
			const connection = await this.pool.getConnection();
			await connection.ping();
			connection.release();

			this.isConnected = true;
			console.log("MySQL database connected successfully");

			// Initialize database schema
			await this.initializeSchema();

			return true;
		} catch (error) {
			console.error(
				" Database connection failed:",
				error.message
			);
			this.isConnected = false;
			throw error;
		}
	}


	async initializeSchema() {
		try {
			//  users table
			await this.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    email VARCHAR(100) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    first_name VARCHAR(50),
                    last_name VARCHAR(50),
                    role ENUM('user', 'admin', 'moderator') DEFAULT 'user',
                    is_active BOOLEAN DEFAULT true,
                    email_verified BOOLEAN DEFAULT false,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    last_login TIMESTAMP NULL,
                    
                    INDEX idx_username (username),
                    INDEX idx_email (email),
                    INDEX idx_created_at (created_at)
                )
            `);

			//  user sessions table
			await this.query(`
                CREATE TABLE IF NOT EXISTS user_sessions (
                    id VARCHAR(255) PRIMARY KEY,
                    user_id INT NOT NULL,
                    session_data JSON,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP NOT NULL,
                    is_active BOOLEAN DEFAULT true,
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    INDEX idx_user_id (user_id),
                    INDEX idx_expires_at (expires_at),
                    INDEX idx_active (is_active)
                )
            `);

			//  chat conversations table
			await this.query(`
                CREATE TABLE IF NOT EXISTS chat_conversations (
                    id VARCHAR(255) PRIMARY KEY,
                    user_id INT NOT NULL,
                    title VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    is_active BOOLEAN DEFAULT true,
                    message_count INT DEFAULT 0,
                    
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    INDEX idx_user_id (user_id),
                    INDEX idx_created_at (created_at),
                    INDEX idx_active (is_active)
                )
            `);

			//  chat messages table
			await this.query(`
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id VARCHAR(255) PRIMARY KEY,
                    conversation_id VARCHAR(255) NOT NULL,
                    user_id INT NOT NULL,
                    role ENUM('user', 'assistant', 'system', 'tool') NOT NULL,
                    content TEXT NOT NULL,
                    metadata JSON,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    
                    FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    INDEX idx_conversation_id (conversation_id),
                    INDEX idx_user_id (user_id),
                    INDEX idx_created_at (created_at),
                    INDEX idx_role (role)
                )
            `);

			//  refresh tokens table
			await this.query(`
                CREATE TABLE IF NOT EXISTS refresh_tokens (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    user_id INT NOT NULL,
                    token_hash VARCHAR(255) NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_revoked BOOLEAN DEFAULT false,
                    device_info JSON,
                    
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    INDEX idx_user_id (user_id),
                    INDEX idx_token_hash (token_hash),
                    INDEX idx_expires_at (expires_at)
                )
            `);

			console.log(
				" Database schema initialized successfully"
			);
		} catch (error) {
			console.error(
				" Schema initialization failed:",
				error.message
			);
			throw error;
		}
	}

	async query(sql, params = []) {
		if (!this.isConnected) {
			throw new Error("Database not connected");
		}

		try {
			// Ensure parameters are properly typed for MySQL2
			const sanitizedParams = params.map((param) => {
				if (param === null || param === undefined) {
					return null;
				}
				if (
					typeof param === "string" &&
					!isNaN(param) &&
					!isNaN(parseFloat(param))
				) {
					return param;
				}
				return param;
			});

			const [results] = await this.pool.execute(
				sql,
				sanitizedParams
			);
			return results;
		} catch (error) {
			console.error("Database query error:", error.message);
			console.error("SQL:", sql);
			console.error("Params:", params);
			throw error;
		}
	}

	async beginTransaction() {
		if (!this.isConnected) {
			throw new Error("Database not connected");
		}

		const connection = await this.pool.getConnection();
		await connection.beginTransaction();
		return connection;
	}


	async healthCheck() {
		try {
			if (!this.pool) {
				return {
					status: "unhealthy",
					error: "Pool not initialized",
				};
			}

			const connection = await this.pool.getConnection();
			await connection.ping();
			connection.release();

			return {
				status: "healthy",
				connectionLimit:
					this.pool.config?.connectionLimit ||
					"unknown",
				connectionsInUse:
					this.pool._allConnections?.length || 0,
				timestamp: new Date().toISOString(),
			};
		} catch (error) {
			return {
				status: "unhealthy",
				error: error.message,
				timestamp: new Date().toISOString(),
			};
		}
	}

	async close() {
		if (this.pool) {
			await this.pool.end();
			this.isConnected = false;
			console.log("Database connection closed");
		}
	}
}

module.exports = new DatabaseConnection();
