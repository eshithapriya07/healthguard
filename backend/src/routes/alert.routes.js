const { Router } = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/alert.controller');

const router = Router();
router.use(authenticate);

router.get('/alerts', ctrl.listAlerts);
router.patch(
  '/alerts/:id/status',
  [body('status').isIn(['unread', 'read', 'resolved']).withMessage('Invalid alert status.')],
  validate,
  ctrl.setStatus
);

router.get('/notifications', ctrl.listNotifications);
router.post('/notifications/read-all', ctrl.markAllRead);

module.exports = router;
