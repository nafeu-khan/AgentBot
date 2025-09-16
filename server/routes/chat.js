const express = require("express");
const chatController = require("../controllers/chatController");
const authMiddleware = require("../auth/middleware");

const router = express.Router();


// Main chat endpoint (SSE streaming) - requires authentication
router.post("/", authMiddleware.authenticate, async (req, res) => {
	try {
		req.body.userId = req.user.id;
		req.body.userSessionId = req.token.sessionId;

		await chatController.chat(req, res);
	} catch (error) {
		console.error("Chat route error:", error);
		res.status(500).json({
			success: false,
			error: "Internal server error",
			code: "CHAT_ERROR",
		});
	}
});

// System status - public endpoint
router.get("/status", (req, res) => chatController.getStatus(req, res));

// Health check - public endpoint
router.get("/health", (req, res) => chatController.healthCheck(req, res));

// Data refresh - requires authentication
router.post("/refresh", authMiddleware.authenticate, (req, res) =>
	chatController.refreshData(req, res)
);

// Memory management endpoints - require authentication and session ownership
router.get("/memory/:sessionId/stats",
	authMiddleware.authenticate,
	authMiddleware.verifySessionOwnership,
	(req, res) => chatController.getMemoryStats(req, res)
);

router.delete("/memory/:sessionId",
	authMiddleware.authenticate,
	authMiddleware.verifySessionOwnership,
	(req, res) => chatController.clearMemory(req, res)
);

router.get("/memory/:sessionId/history",
	authMiddleware.authenticate,
	authMiddleware.verifySessionOwnership,
	(req, res) => chatController.getConversationHistory(req, res)
);

router.get("/conversations", authMiddleware.authenticate, async (req, res) => {
	try {
		const { limit = 20, offset = 0 } = req.query;
		const User = require("../models/User");

		// Validate user authentication
		if (!req.user || !req.user.id) {
			return res.status(401).json({
				success: false,
				error: "User not authenticated",
			});
		}

		// Ensure user ID is a number
		const userId = parseInt(req.user.id, 10);
		if (isNaN(userId)) {
			return res.status(400).json({
				success: false,
				error: "Invalid user ID",
			});
		}

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
		});
	}
});


router.post("/conversations", authMiddleware.authenticate, async (req, res) => {
	try {
		const { title } = req.body;
		const User = require("../models/User");

		const conversationId = await User.createConversation(
			req.user.id,
			title
		);

		res.status(201).json({
			success: true,
			conversationId,
			message: "Conversation created successfully",
		});
	} catch (error) {
		console.error("Create conversation error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to create conversation",
		});
	}
});


router.get("/conversations/:conversationId",
	authMiddleware.authenticate,
	authMiddleware.verifyConversationOwnership,
	async (req, res) => {
		try {
			const { conversationId } = req.params;
			const { limit = 50, offset = 0 } = req.query;
			const User = require("../models/User");

			const messages = await User.getConversationMessages(
				conversationId,
				parseInt(limit),
				parseInt(offset)
			);

			const hybridMemoryManager = require("../services/hybridMemoryManager");
			try {
				for (const message of messages) {
					await hybridMemoryManager.addMessage(
						conversationId,
						{
							id: message.id,
							role: message.role,
							content: message.content,
							timestamp: message.timestamp,
							metadata: message.metadata,
						}
					);
				}
			} catch (memoryError) {
				console.warn(
					"Failed to load messages into memory:",
					memoryError.message
				);
			}

			res.json({
				success: true,
				conversation: req.verifiedConversation,
				messages: messages.map((msg) => ({
					id: msg.id,
					role: msg.role,
					content: msg.content,
					timestamp: msg.timestamp,
					toolCalls: msg.metadata?.tool_calls,
					isRAG: false,
				})),
				pagination: {
					limit: parseInt(limit),
					offset: parseInt(offset),
					total: messages.length,
					hasMore:
						messages.length ===
						parseInt(limit),
				},
			});
		} catch (error) {
			console.error("Get conversation error:", error);
			res.status(500).json({
				success: false,
				error: "Failed to get conversation",
			});
		}
	}
);


router.delete("/conversations/:conversationId",
	authMiddleware.authenticate,
	authMiddleware.verifyConversationOwnership,
	async (req, res) => {
		try {
			const { conversationId } = req.params;
			const db = require("../database/connection");

			await db.query(
				"UPDATE chat_conversations SET is_active = false WHERE id = ?",
				[conversationId]
			);

			// Clear from memory systems
			const hybridMemoryManager = require("../services/hybridMemoryManager");
			await hybridMemoryManager.clearSession(conversationId);

			res.json({
				success: true,
				message: "Conversation deleted successfully",
			});
		} catch (error) {
			console.error("Delete conversation error:", error);
			res.status(500).json({
				success: false,
				error: "Failed to delete conversation",
			});
		}
	}
);

module.exports = router;
