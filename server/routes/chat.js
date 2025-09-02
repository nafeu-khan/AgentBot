const express = require("express");
const chatController = require("../controllers/chatController");

const router = express.Router();

router.post("/", chatController.chat);
//
// router.post('/stream', chatController.streamChat);

router.get("/status", chatController.getStatus);

router.post("/refresh", chatController.refreshData);

module.exports = router;
