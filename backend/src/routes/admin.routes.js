const { Router } = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/admin.controller');

const router = Router();
router.use(authenticate, authorize('admin'));

router.get('/users', ctrl.users);
router.patch('/users/:id/status', [body('status').isIn(['active', 'inactive'])], validate, ctrl.setStatus);
router.patch('/users/:id/role', [body('role').isIn(['patient', 'caregiver', 'doctor', 'admin'])], validate, ctrl.setRole);
router.delete('/users/:id', ctrl.removeUser);

router.get('/thresholds', ctrl.thresholds);
router.put(
  '/thresholds/:id',
  [
    body('operator').isIn(['gte', 'gt', 'lte', 'lt', 'bp_or_gte', 'bp_and_gte', 'bp_or_lte']),
    body('valuePrimary').isFloat({ min: 0, max: 1000 }),
    body('valueSecondary').optional({ nullable: true }).isFloat({ min: 0, max: 1000 }),
    body('enabled').optional().isBoolean(),
  ],
  validate,
  ctrl.updateThreshold
);

router.get('/stats', ctrl.stats);
router.get('/audit-logs', ctrl.auditLogs);
router.get('/settings', ctrl.getSettings);
router.put('/settings', [body('key').isLength({ min: 1, max: 64 }), body('value').isLength({ min: 1, max: 255 })], validate, ctrl.putSettings);

module.exports = router;
