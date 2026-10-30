const { query } = require('../config/db');

/** Data access for audit logging, admin user management and monitoring. */
const AdminModel = {
  // ------------------------------------------------------------ audit trail
  async audit({ userId = null, action, entity = null, entityId = null, detail = null, ip = null }) {
    await query(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, ip_address)
       VALUES (?,?,?,?,?,?)`,
      [userId, action, entity, entityId, detail, ip]
    );
  },

  async auditLogs({ page = 1, limit = 50, action = null }) {
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const params = [];
    let clause = '1=1';
    if (action) {
      clause = 'a.action = ?';
      params.push(action);
    }
    const [count] = await query(`SELECT COUNT(*) AS total FROM audit_logs a WHERE ${clause}`, params);
    const rows = await query(
      `SELECT a.id, a.action, a.entity, a.entity_id, a.detail, a.ip_address, a.created_at,
              u.email AS user_email
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.user_id
        WHERE ${clause}
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT ${safeLimit} OFFSET ${(Math.max(Number(page) || 1, 1) - 1) * safeLimit}`,
      params
    );
    return { rows, total: count.total, page: Math.max(Number(page) || 1, 1), limit: safeLimit };
  },

  // ------------------------------------------------------- admin user admin
  async listUsers({ search = '', role = null, status = null, page = 1, limit = 20 }) {
    const where = ['1=1'];
    const params = [];
    if (search) {
      where.push('(u.email LIKE ? OR u.full_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (role) {
      where.push('r.code = ?');
      params.push(role);
    }
    if (status) {
      where.push('u.status = ?');
      params.push(status);
    }
    const clause = where.join(' AND ');
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const [count] = await query(
      `SELECT COUNT(*) AS total FROM users u JOIN roles r ON r.id = u.role_id WHERE ${clause}`,
      params
    );
    const rows = await query(
      `SELECT u.id, u.email, u.full_name, u.preferred_language, u.status, u.created_at, u.last_login_at,
              r.code AS role
         FROM users u JOIN roles r ON r.id = u.role_id
        WHERE ${clause}
        ORDER BY u.created_at DESC
        LIMIT ${safeLimit} OFFSET ${(Math.max(Number(page) || 1, 1) - 1) * safeLimit}`,
      params
    );
    return { rows, total: count.total, page: Math.max(Number(page) || 1, 1), limit: safeLimit };
  },

  async setUserStatus(id, status) {
    const result = await query('UPDATE users SET status = ? WHERE id = ?', [status, id]);
    return result.affectedRows;
  },

  async setUserRole(id, roleCode) {
    const role = await query('SELECT id FROM roles WHERE code = ? LIMIT 1', [roleCode]);
    if (!role.length) throw Object.assign(new Error('Unknown role'), { status: 400, code: 'unknown_role' });
    const result = await query('UPDATE users SET role_id = ? WHERE id = ?', [role[0].id, id]);
    return result.affectedRows;
  },

  async deleteUser(id) {
    const result = await query('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows;
  },

  // ------------------------------------------------------------- monitoring
  async stats() {
    const [users] = await query(
      `SELECT COUNT(*) AS total,
              SUM(status = 'active') AS active,
              SUM(status = 'inactive') AS inactive
         FROM users`
    );
    // GROUP BY → many rows: keep the whole result set, never take row[0].
    const byRole = await query(
      `SELECT r.code, COUNT(u.id) AS total FROM roles r LEFT JOIN users u ON u.role_id = r.id GROUP BY r.code ORDER BY r.id`
    );
    const [readings] = await query('SELECT COUNT(*) AS total FROM health_readings');
    const [alerts] = await query(
      `SELECT COUNT(*) AS total, SUM(status = 'unread') AS unread FROM alerts`
    );
    const [reminders] = await query('SELECT COUNT(*) AS total FROM reminders');
    const [shares] = await query(
      `SELECT COUNT(*) AS total, SUM(status = 'active') AS active FROM access_permissions`
    );
    const recent = await query(
      `SELECT DATE(measured_at) AS day, COUNT(*) AS total FROM health_readings
        WHERE measured_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY DATE(measured_at) ORDER BY day`
    );
    return {
      users,
      usersByRole: byRole,
      readings,
      alerts,
      reminders,
      shares,
      readingsLast7Days: recent,
    };
  },

  async getSettings() {
    return query('SELECT setting_key, setting_value, description, updated_at FROM system_settings ORDER BY setting_key');
  },

  async setSetting(key, value, description = null) {
    await query(
      `INSERT INTO system_settings (setting_key, setting_value, description) VALUES (?,?,?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value),
           description = COALESCE(VALUES(description), description)`,
      [key, value, description]
    );
  },
};

module.exports = AdminModel;
