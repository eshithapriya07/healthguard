const AlertModel = require('../models/alert.model');
const { asyncHandler } = require('../middleware/auth');
const { audit } = require('../services/auditService');

/** GET /api/alerts?status=unread&page=1 */
const listAlerts = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query;
  const result = await AlertModel.listAlerts({ userId: req.user.id, status: status || null, page, limit });
  res.json(result);
});

/** PATCH /api/alerts/:id/status  { status: unread | read | resolved } */
const setStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const affected = await AlertModel.updateAlertStatus(req.params.id, req.user.id, status);
  if (!affected) return res.status(404).json({ error: 'not_found', message: 'Alert not found.' });
  await audit(req, 'alert.status', 'alerts', req.params.id, `status=${status}`);
  res.json({ message: 'Alert updated.', status });
});

/** GET /api/notifications — the bell feed. */
const listNotifications = asyncHandler(async (req, res) => {
  const rows = await AlertModel.listNotifications(req.user.id, Number(req.query.limit) || 30);
  const unread = await AlertModel.unreadNotificationCount(req.user.id);
  res.json({ notifications: rows, unread });
});

/** POST /api/notifications/read-all */
const markAllRead = asyncHandler(async (req, res) => {
  await AlertModel.markNotificationsRead(req.user.id);
  res.json({ message: 'All notifications marked as read.' });
});

module.exports = { listAlerts, setStatus, listNotifications, markAllRead };
