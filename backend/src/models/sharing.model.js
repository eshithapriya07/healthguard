const { query } = require('../config/db');

/** Data access for controlled sharing (patient -> caregiver / doctor). */
const SharingModel = {
  async create({ patientId, granteeId, items, note, startsAt, expiresAt }) {
    const result = await query(
      `INSERT INTO access_permissions (patient_id, grantee_id, items, note, starts_at, expires_at, status)
       VALUES (?,?,?,?,?,?, 'active')`,
      [patientId, granteeId, JSON.stringify(items), note ?? null, startsAt, expiresAt ?? null]
    );
    return result.insertId;
  },

  /** Shares I granted (as patient). */
  async grantedBy(patientId) {
    return query(
      `SELECT a.id, a.items, a.note, a.starts_at, a.expires_at, a.status, a.created_at,
              u.id AS grantee_id, u.full_name AS grantee_name, u.email AS grantee_email,
              r.code AS grantee_role
         FROM access_permissions a
         JOIN users u ON u.id = a.grantee_id
         JOIN roles r ON r.id = u.role_id
        WHERE a.patient_id = ?
        ORDER BY a.created_at DESC`,
      [patientId]
    );
  },

  /** Shares I receive (as caregiver/doctor). */
  async grantedTo(granteeId) {
    const rows = await query(
      `SELECT a.id, a.items, a.note, a.starts_at, a.expires_at, a.status, a.created_at,
              u.id AS patient_id, u.full_name AS patient_name, u.email AS patient_email
         FROM access_permissions a
         JOIN users u ON u.id = a.patient_id
        WHERE a.grantee_id = ?
        ORDER BY a.created_at DESC`,
      [granteeId]
    );
    return rows.map((r) => ({
      ...r,
      items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items,
      active: r.status === 'active' && (!r.expires_at || new Date(r.expires_at) > new Date()),
    }));
  },

  async find(id) {
    const rows = await query('SELECT * FROM access_permissions WHERE id = ? LIMIT 1', [id]);
    if (!rows[0]) return null;
    const row = rows[0];
    row.items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items;
    return row;
  },

  async revoke(id, patientId) {
    const result = await query(
      `UPDATE access_permissions SET status = 'revoked', revoked_at = NOW()
        WHERE id = ? AND patient_id = ? AND status = 'active'`,
      [id, patientId]
    );
    return result.affectedRows;
  },

  async expireOverdue() {
    const result = await query(
      `UPDATE access_permissions SET status = 'expired'
        WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < NOW()`
    );
    return result.affectedRows;
  },

  /**
   * An active permission covering the requested item, or null.
   * Used by every caregiver/doctor read route (defence in depth).
   */
  async activePermission(patientId, granteeId, item) {
    const rows = await query(
      `SELECT id, items FROM access_permissions
        WHERE patient_id = ? AND grantee_id = ? AND status = 'active'
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY created_at DESC`,
      [patientId, granteeId]
    );
    for (const row of rows) {
      const items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items;
      if (Array.isArray(items) && (items.includes(item) || items.includes('all'))) return row;
    }
    return null;
  },

  /** Parameters explicitly shared with a grantee (used to filter the UI). */
  async sharedItems(patientId, granteeId) {
    const rows = await query(
      `SELECT items FROM access_permissions
        WHERE patient_id = ? AND grantee_id = ? AND status = 'active'
          AND (expires_at IS NULL OR expires_at > NOW())`,
      [patientId, granteeId]
    );
    const set = new Set();
    rows.forEach((r) => {
      const items = typeof r.items === 'string' ? JSON.parse(r.items) : r.items;
      (Array.isArray(items) ? items : []).forEach((i) => set.add(i));
    });
    return [...set];
  },
};

module.exports = SharingModel;
