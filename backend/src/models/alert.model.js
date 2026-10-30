const { query } = require('../config/db');

/** Data access for thresholds, alerts and the in-app notification feed. */
const AlertModel = {
  // ------------------------------------------------------------- thresholds
  async getThresholds() {
    return query(
      `SELECT t.id, t.parameter_id, t.severity, t.operator, t.value_primary, t.value_secondary,
              t.enabled, p.code AS parameter_code, p.name_en, p.name_hi, t.updated_at
         FROM alert_thresholds t
         JOIN parameter_types p ON p.id = t.parameter_id
        ORDER BY p.display_order, FIELD(t.severity,'critical','warning','low')`
    );
  },

  /** Enabled thresholds keyed by parameter code — the alert engine's rule set. */
  async getEnabledThresholds() {
    const rows = await this.getThresholds();
    const byCode = {};
    rows.forEach((r) => {
      if (!r.enabled) return;
      (byCode[r.parameter_code] = byCode[r.parameter_code] || []).push(r);
    });
    return byCode;
  },

  async updateThreshold({ id, operator, valuePrimary, valueSecondary, enabled, updatedBy }) {
    await query(
      `UPDATE alert_thresholds
          SET operator = ?, value_primary = ?, value_secondary = ?, enabled = ?, updated_by = ?
        WHERE id = ?`,
      [operator, valuePrimary, valueSecondary ?? null, enabled ? 1 : 0, updatedBy, id]
    );
  },

  // ----------------------------------------------------------------- alerts
  async insertAlert(a) {
    const result = await query(
      `INSERT INTO alerts (user_id, reading_id, parameter_id, severity, kind,
                           title_en, title_hi, message_en, message_hi, status)
       VALUES (?,?,?,?,?,?,?,?,?, 'unread')`,
      [
        a.userId,
        a.readingId ?? null,
        a.parameterId ?? null,
        a.severity,
        a.kind || 'threshold',
        a.titleEn,
        a.titleHi,
        a.messageEn,
        a.messageHi,
      ]
    );
    return result.insertId;
  },

  async listAlerts({ userId, status = null, page = 1, limit = 20 }) {
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const safePage = Math.max(Number(page) || 1, 1);
    const params = [userId];
    let clause = 'a.user_id = ?';
    if (status) {
      clause += ' AND a.status = ?';
      params.push(status);
    }
    const [count] = await query(`SELECT COUNT(*) AS total FROM alerts a WHERE ${clause}`, params);
    const rows = await query(
      `SELECT a.id, a.severity, a.kind, a.title_en, a.title_hi, a.message_en, a.message_hi,
              a.status, a.created_at, p.code AS parameter_code, p.name_en AS parameter_en, p.name_hi AS parameter_hi
         FROM alerts a
         LEFT JOIN parameter_types p ON p.id = a.parameter_id
        WHERE ${clause}
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT ${safeLimit} OFFSET ${(safePage - 1) * safeLimit}`,
      params
    );
    return { rows, total: count.total, page: safePage, limit: safeLimit };
  },

  async updateAlertStatus(id, userId, status) {
    const result = await query('UPDATE alerts SET status = ? WHERE id = ? AND user_id = ?', [
      status,
      id,
      userId,
    ]);
    return result.affectedRows;
  },

  async countAlerts(userId, sinceDate) {
    const rows = await query(
      `SELECT severity, COUNT(*) AS total FROM alerts
        WHERE user_id = ? AND created_at >= ? GROUP BY severity`,
      [userId, sinceDate]
    );
    return rows;
  },

  async recentAlerts(userId, limit = 5) {
    return query(
      `SELECT id, severity, kind, title_en, title_hi, message_en, message_hi, status, created_at
         FROM alerts WHERE user_id = ? ORDER BY created_at DESC LIMIT ${Number(limit)}`,
      [userId]
    );
  },

  // ---------------------------------------------------------- notifications
  async insertNotification(n) {
    const result = await query(
      `INSERT INTO notifications (user_id, type, ref_id, title_en, title_hi, body_en, body_hi, is_read)
       VALUES (?,?,?,?,?,?,?,0)`,
      [n.userId, n.type || 'system', n.refId ?? null, n.titleEn, n.titleHi, n.bodyEn, n.bodyHi]
    );
    return result.insertId;
  },

  async listNotifications(userId, limit = 30) {
    return query(
      `SELECT id, type, ref_id, title_en, title_hi, body_en, body_hi, is_read, created_at
         FROM notifications WHERE user_id = ?
        ORDER BY created_at DESC, id DESC LIMIT ${Number(limit)}`,
      [userId]
    );
  },

  async unreadNotificationCount(userId) {
    const [row] = await query(
      'SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );
    return row.total;
  },

  async markNotificationsRead(userId) {
    await query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [userId]);
  },
};

module.exports = AlertModel;
