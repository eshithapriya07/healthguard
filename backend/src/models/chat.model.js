const { query } = require('../config/db');

/** Data access for chatbot history. */
const ChatModel = {
  async append({ userId, role, content, language, source = 'rule' }) {
    const result = await query(
      'INSERT INTO chat_messages (user_id, role, content, language, source) VALUES (?,?,?,?,?)',
      [userId, role, content, language, source]
    );
    return result.insertId;
  },

  async history(userId, limit = 50) {
    return query(
      `SELECT id, role, content, language, source, created_at
         FROM chat_messages WHERE user_id = ?
        ORDER BY id DESC LIMIT ${Number(limit)}`,
      [userId]
    );
  },

  async clear(userId) {
    const result = await query('DELETE FROM chat_messages WHERE user_id = ?', [userId]);
    return result.affectedRows;
  },
};

module.exports = ChatModel;
