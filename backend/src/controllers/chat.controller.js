const ChatModel = require('../models/chat.model');
const chatbot = require('../services/chatbotService');
const { asyncHandler } = require('../middleware/auth');

/** GET /api/chat/messages — newest first. */
const history = asyncHandler(async (req, res) => {
  const rows = await ChatModel.history(req.user.id, Number(req.query.limit) || 60);
  res.json({ messages: rows.reverse() });
});

/** POST /api/chat { message, language } */
const send = asyncHandler(async (req, res) => {
  const { message, language } = req.body;
  const lang = language === 'hi' ? 'hi' : 'en';
  const result = await chatbot.respond({ user: req.user, message, language: lang });
  res.status(201).json({ reply: result.reply, source: result.source, language: lang });
});

/** DELETE /api/chat/messages — clear my history. */
const clear = asyncHandler(async (req, res) => {
  const removed = await ChatModel.clear(req.user.id);
  res.json({ message: 'Chat history cleared.', removed });
});

module.exports = { history, send, clear };
