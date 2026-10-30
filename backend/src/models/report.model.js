const { query } = require('../config/db');

/** Data access for generated reports and uploaded medical documents. */
const ReportModel = {
  async create(r) {
    const result = await query(
      `INSERT INTO reports (user_id, title, date_from, date_to, parameters, avg_values, alert_count, summary_text)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        r.userId,
        r.title,
        r.dateFrom,
        r.dateTo,
        JSON.stringify(r.parameters),
        JSON.stringify(r.avgValues || {}),
        r.alertCount || 0,
        r.summaryText || null,
      ]
    );
    return result.insertId;
  },

  async list(userId) {
    const rows = await query(
      `SELECT id, title, date_from, date_to, parameters, avg_values, alert_count, summary_text, created_at
         FROM reports WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
      [userId]
    );
    return rows.map((r) => ({
      ...r,
      parameters: typeof r.parameters === 'string' ? JSON.parse(r.parameters) : r.parameters,
      avg_values: typeof r.avg_values === 'string' ? JSON.parse(r.avg_values) : r.avg_values,
    }));
  },

  async find(id, userId) {
    const rows = await query(
      `SELECT id, user_id, title, date_from, date_to, parameters, avg_values, alert_count, summary_text, created_at
         FROM reports WHERE id = ? AND user_id = ? LIMIT 1`,
      [id, userId]
    );
    if (!rows[0]) return null;
    const row = rows[0];
    row.parameters = typeof row.parameters === 'string' ? JSON.parse(row.parameters) : row.parameters;
    row.avg_values = typeof row.avg_values === 'string' ? JSON.parse(row.avg_values) : row.avg_values;
    return row;
  },

  /** Report lookup that ignores ownership — callers must check access_permissions first. */
  async findAny(id) {
    const rows = await query(
      `SELECT id, user_id, title, date_from, date_to, parameters, avg_values, alert_count, summary_text, created_at
         FROM reports WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!rows[0]) return null;
    const row = rows[0];
    row.parameters = typeof row.parameters === 'string' ? JSON.parse(row.parameters) : row.parameters;
    row.avg_values = typeof row.avg_values === 'string' ? JSON.parse(row.avg_values) : row.avg_values;
    return row;
  },

  async remove(id, userId) {
    const result = await query('DELETE FROM reports WHERE id = ? AND user_id = ?', [id, userId]);
    return result.affectedRows;
  },

  // -------------------------------------------------------- documents (meta)
  async addDocument(d) {
    const result = await query(
      `INSERT INTO medical_documents (user_id, title, document_date, file_path, mime_type, size_bytes)
       VALUES (?,?,?,?,?,?)`,
      [d.userId, d.title, d.documentDate || null, d.filePath, d.mimeType || null, d.sizeBytes || null]
    );
    return result.insertId;
  },

  async listDocuments(userId) {
    return query(
      `SELECT id, title, document_date, file_path, mime_type, size_bytes, created_at
         FROM medical_documents WHERE user_id = ? ORDER BY created_at DESC LIMIT 200`,
      [userId]
    );
  },

  async removeDocument(id, userId) {
    const result = await query('DELETE FROM medical_documents WHERE id = ? AND user_id = ?', [id, userId]);
    return result.affectedRows;
  },
};

module.exports = ReportModel;
