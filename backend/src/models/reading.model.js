const { query } = require('../config/db');

/** Data access for parameter types, health readings and dashboard aggregates. */
const ReadingModel = {
  async listParameterTypes() {
    return query(
      `SELECT id, code, name_en, name_hi, unit, value_kind, min_valid, max_valid, has_trend, display_order
         FROM parameter_types WHERE active = 1 ORDER BY display_order, id`
    );
  },

  async findParameterByCode(code) {
    const rows = await query('SELECT * FROM parameter_types WHERE code = ? LIMIT 1', [code]);
    return rows[0] || null;
  },

  async createReading({ userId, parameterId, systolic, diastolic, pulse, value, measuredAt, notes }) {
    const result = await query(
      `INSERT INTO health_readings (user_id, parameter_id, systolic, diastolic, pulse, value, measured_at, notes)
       VALUES (?,?,?,?,?,?,?,?)`,
      [userId, parameterId, systolic ?? null, diastolic ?? null, pulse ?? null, value ?? null, measuredAt, notes ?? null]
    );
    return result.insertId;
  },

  async updateReading({ id, userId, systolic, diastolic, pulse, value, measuredAt, notes }) {
    await query(
      `UPDATE health_readings
          SET systolic = ?, diastolic = ?, pulse = ?, value = ?, measured_at = ?, notes = ?
        WHERE id = ? AND user_id = ?`,
      [systolic ?? null, diastolic ?? null, pulse ?? null, value ?? null, measuredAt, notes ?? null, id, userId]
    );
  },

  async deleteReading(id, userId) {
    const result = await query('DELETE FROM health_readings WHERE id = ? AND user_id = ?', [id, userId]);
    return result.affectedRows;
  },

  async findById(id, userId) {
    const rows = await query(
      `SELECT h.*, p.code AS parameter_code, p.unit, p.value_kind, p.name_en, p.name_hi
         FROM health_readings h
         JOIN parameter_types p ON p.id = h.parameter_id
        WHERE h.id = ? AND h.user_id = ? LIMIT 1`,
      [id, userId]
    );
    return rows[0] || null;
  },

  /** Paginated list, newest first, optionally filtered by parameter code / date range. */
  async list({ userId, code = null, from = null, to = null, page = 1, limit = 20 }) {
    const where = ['h.user_id = ?'];
    const params = [userId];
    if (code) {
      where.push('p.code = ?');
      params.push(code);
    }
    if (from) {
      where.push('h.measured_at >= ?');
      params.push(from);
    }
    if (to) {
      where.push('h.measured_at <= ?');
      params.push(to);
    }
    const clause = where.join(' AND ');
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 200);
    const safePage = Math.max(Number(page) || 1, 1);
    const offset = (safePage - 1) * safeLimit;

    const countRows = await query(
      `SELECT COUNT(*) AS total FROM health_readings h
         JOIN parameter_types p ON p.id = h.parameter_id
        WHERE ${clause}`,
      params
    );
    const rows = await query(
      `SELECT h.id, h.systolic, h.diastolic, h.pulse, h.value, h.measured_at, h.notes, h.created_at,
              p.code AS parameter_code, p.unit, p.value_kind, p.name_en, p.name_hi
         FROM health_readings h
         JOIN parameter_types p ON p.id = h.parameter_id
        WHERE ${clause}
        ORDER BY h.measured_at DESC, h.id DESC
        LIMIT ${safeLimit} OFFSET ${offset}`,
      params
    );
    return { rows, total: countRows[0].total, page: safePage, limit: safeLimit };
  },

  /** Most recent reading per parameter (dashboard cards). */
  async latestPerParameter(userId) {
    return query(
      `SELECT h.id, h.systolic, h.diastolic, h.pulse, h.value, h.measured_at,
              p.code, p.unit, p.value_kind, p.name_en, p.name_hi
         FROM health_readings h
         JOIN parameter_types p ON p.id = h.parameter_id
         JOIN (SELECT parameter_id, MAX(measured_at) AS mx
                 FROM health_readings WHERE user_id = ? GROUP BY parameter_id) t
           ON t.parameter_id = h.parameter_id AND t.mx = h.measured_at
        WHERE h.user_id = ?
        ORDER BY p.display_order`,
      [userId, userId]
    );
  },

  /** Time series for one parameter between two dates (chart data). */
  async series({ userId, code, from, to }) {
    return query(
      `SELECT h.id, h.systolic, h.diastolic, h.value, h.measured_at
         FROM health_readings h
         JOIN parameter_types p ON p.id = h.parameter_id
        WHERE h.user_id = ? AND p.code = ? AND h.measured_at >= ? AND h.measured_at <= ?
        ORDER BY h.measured_at ASC`,
      [userId, code, from, to]
    );
  },

  /** Average / min / max / count per parameter over a range (summary row). */
  async summary({ userId, from, to }) {
    return query(
      `SELECT p.code, p.unit, p.value_kind, COUNT(*) AS count,
              ROUND(AVG(h.value), 1) AS avg_value, MIN(h.value) AS min_value, MAX(h.value) AS max_value,
              ROUND(AVG(h.systolic), 1) AS avg_sys, MIN(h.systolic) AS min_sys, MAX(h.systolic) AS max_sys,
              ROUND(AVG(h.diastolic), 1) AS avg_dia, MIN(h.diastolic) AS min_dia, MAX(h.diastolic) AS max_dia
         FROM health_readings h
         JOIN parameter_types p ON p.id = h.parameter_id
        WHERE h.user_id = ? AND h.measured_at >= ? AND h.measured_at <= ?
        GROUP BY p.code, p.unit, p.value_kind, p.display_order
        ORDER BY p.display_order`,
      [userId, from, to]
    );
  },

  /** Recent readings used by the trend rules (newest first). */
  async recentForTrend(userId, code, limit = 10) {
    return query(
      `SELECT h.systolic, h.diastolic, h.value, h.measured_at
         FROM health_readings h
         JOIN parameter_types p ON p.id = h.parameter_id
        WHERE h.user_id = ? AND p.code = ?
        ORDER BY h.measured_at DESC, h.id DESC
        LIMIT ${Number(limit)}`,
      [userId, code]
    );
  },
};

module.exports = ReadingModel;
