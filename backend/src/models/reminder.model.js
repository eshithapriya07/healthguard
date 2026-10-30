const { query } = require('../config/db');

/** Data access for reminders. */
const ReminderModel = {
  async create(r) {
    const result = await query(
      `INSERT INTO reminders (user_id, type, title, notes, scheduled_at, recurrence, status)
       VALUES (?,?,?,?,?,?, 'scheduled')`,
      [r.userId, r.type, r.title, r.notes ?? null, r.scheduledAt, r.recurrence || 'once']
    );
    return result.insertId;
  },

  async list(userId, { status = null, from = null, limit = 100 } = {}) {
    const where = ['user_id = ?'];
    const params = [userId];
    if (status) {
      where.push('status = ?');
      params.push(status);
    }
    if (from) {
      where.push('scheduled_at >= ?');
      params.push(from);
    }
    return query(
      `SELECT id, type, title, notes, scheduled_at, recurrence, status, snoozed_until, created_at
         FROM reminders WHERE ${where.join(' AND ')}
        ORDER BY scheduled_at ASC LIMIT ${Math.min(Number(limit) || 100, 500)}`,
      params
    );
  },

  async find(id, userId) {
    const rows = await query('SELECT * FROM reminders WHERE id = ? AND user_id = ? LIMIT 1', [id, userId]);
    return rows[0] || null;
  },

  async update(id, userId, fields) {
    const allowed = ['type', 'title', 'notes', 'scheduled_at', 'recurrence', 'status'];
    const sets = [];
    const params = [];
    Object.entries(fields).forEach(([key, value]) => {
      if (!allowed.includes(key) || value === undefined) return;
      sets.push(`${key} = ?`);
      params.push(value);
    });
    if (!sets.length) return 0;
    params.push(id, userId);
    const result = await query(`UPDATE reminders SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, params);
    return result.affectedRows;
  },

  async remove(id, userId) {
    const result = await query('DELETE FROM reminders WHERE id = ? AND user_id = ?', [id, userId]);
    return result.affectedRows;
  },

  /** Due reminders for the cron scheduler (scheduled or snoozed past their time). */
  async dueReminders(now) {
    return query(
      `SELECT id, user_id, type, title, notes, scheduled_at, recurrence, status
         FROM reminders
        WHERE status IN ('scheduled','snoozed')
          AND (status = 'scheduled' AND scheduled_at <= ? OR status = 'snoozed' AND snoozed_until <= ?)
        ORDER BY scheduled_at ASC LIMIT 200`,
      [now, now]
    );
  },

  /** Advance a recurring reminder to its next occurrence after it fires. */
  async advanceRecurring(row, now) {
    if (row.recurrence === 'daily') {
      await query(
        `UPDATE reminders SET status='scheduled',
                scheduled_at = DATE_ADD(scheduled_at, INTERVAL 1 DAY)
          WHERE id = ? AND scheduled_at <= ?`,
        [row.id, now]
      );
    } else if (row.recurrence === 'weekly') {
      await query(
        `UPDATE reminders SET status='scheduled',
                scheduled_at = DATE_ADD(scheduled_at, INTERVAL 7 DAY)
          WHERE id = ? AND scheduled_at <= ?`,
        [row.id, now]
      );
    } else {
      await query(`UPDATE reminders SET status = 'triggered', last_triggered_at = ? WHERE id = ?`, [
        now,
        row.id,
      ]);
    }
  },
};

module.exports = ReminderModel;
