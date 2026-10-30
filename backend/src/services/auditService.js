const AdminModel = require('../models/admin.model');

/**
 * Audit trail helper. Records security relevant events
 * (logins, sharing changes, admin actions) in audit_logs.
 */
async function audit(req, action, entity = null, entityId = null, detail = null) {
  try {
    await AdminModel.audit({
      userId: req.user ? req.user.id : null,
      action,
      entity,
      entityId: entityId == null ? null : Number(entityId),
      detail: detail ? String(detail).slice(0, 500) : null,
      ip: (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().slice(0, 64),
    });
  } catch (err) {
    // Auditing must never break the main request.
    console.error('[audit]', err.message);
  }
}

module.exports = { audit };
