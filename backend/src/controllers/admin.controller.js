const AdminModel = require('../models/admin.model');
const AlertModel = require('../models/alert.model');
const { asyncHandler } = require('../middleware/auth');
const { audit } = require('../services/auditService');

/** GET /api/admin/users?search=&role=&status=&page= */
const users = asyncHandler(async (req, res) => {
  const result = await AdminModel.listUsers({
    search: req.query.search || '',
    role: req.query.role || null,
    status: req.query.status || null,
    page: req.query.page,
    limit: req.query.limit,
  });
  res.json(result);
});

/** PATCH /api/admin/users/:id/status { status } */
const setStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['active', 'inactive'].includes(status)) {
    return res.status(400).json({ error: 'invalid_status', message: 'Status must be active or inactive.' });
  }
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'self_action', message: 'You cannot deactivate your own account.' });
  }
  await AdminModel.setUserStatus(req.params.id, status);
  await audit(req, 'admin.user_status', 'users', req.params.id, `status=${status}`);
  res.json({ message: 'User status updated.' });
});

/** PATCH /api/admin/users/:id/role { role } */
const setRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!['patient', 'caregiver', 'doctor', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'invalid_role', message: 'Unknown role.' });
  }
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'self_action', message: 'You cannot change your own role.' });
  }
  await AdminModel.setUserRole(req.params.id, role);
  await audit(req, 'admin.user_role', 'users', req.params.id, `role=${role}`);
  res.json({ message: 'User role updated.' });
});

/** DELETE /api/admin/users/:id */
const removeUser = asyncHandler(async (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'self_action', message: 'You cannot delete your own account.' });
  }
  const affected = await AdminModel.deleteUser(req.params.id);
  if (!affected) return res.status(404).json({ error: 'not_found', message: 'User not found.' });
  await audit(req, 'admin.user_delete', 'users', req.params.id, 'user deleted');
  res.json({ message: 'User deleted.' });
});

/** GET /api/admin/thresholds */
const thresholds = asyncHandler(async (req, res) => {
  const rows = await AlertModel.getThresholds();
  res.json({ thresholds: rows });
});

/** PUT /api/admin/thresholds/:id { operator, valuePrimary, valueSecondary, enabled } */
const updateThreshold = asyncHandler(async (req, res) => {
  const { operator, valuePrimary, valueSecondary, enabled } = req.body;
  await AlertModel.updateThreshold({
    id: req.params.id,
    operator,
    valuePrimary,
    valueSecondary,
    enabled: enabled === undefined ? true : Boolean(enabled),
    updatedBy: req.user.id,
  });
  await audit(req, 'admin.threshold_update', 'alert_thresholds', req.params.id, `operator=${operator}`);
  const rows = await AlertModel.getThresholds();
  res.json({ thresholds: rows });
});

/** GET /api/admin/stats — monitoring overview. */
const stats = asyncHandler(async (req, res) => {
  const data = await AdminModel.stats();
  res.json({ stats: data });
});

/** GET /api/admin/audit-logs */
const auditLogs = asyncHandler(async (req, res) => {
  const result = await AdminModel.auditLogs({
    page: req.query.page,
    limit: req.query.limit,
    action: req.query.action || null,
  });
  res.json(result);
});

/** GET/PUT /api/admin/settings */
const getSettings = asyncHandler(async (req, res) => {
  const settings = await AdminModel.getSettings();
  res.json({ settings });
});

const putSettings = asyncHandler(async (req, res) => {
  const { key, value, description } = req.body;
  await AdminModel.setSetting(key, value, description);
  await audit(req, 'admin.setting_update', 'system_settings', null, `${key}=${value}`);
  res.json({ message: 'Setting saved.' });
});

module.exports = { users, setStatus, setRole, removeUser, thresholds, updateThreshold, stats, auditLogs, getSettings, putSettings };
