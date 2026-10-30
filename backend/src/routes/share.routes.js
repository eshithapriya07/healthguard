const { Router } = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/share.controller');

const router = Router();
router.use(authenticate);

const patientOnly = authorize('patient', 'admin');
const viewerOnly = authorize('caregiver', 'doctor');

router.post(
  '/shares',
  patientOnly,
  [
    body('email').isEmail().withMessage('Please enter a valid email.').normalizeEmail(),
    body('items').isArray({ min: 1 }).withMessage('Select at least one item to share.'),
    body('items.*').isIn(['bp', 'spo2', 'heart_rate', 'glucose', 'temperature', 'weight', 'report', 'alerts', 'all']),
    body('expiresInDays').optional({ nullable: true }).isInt({ min: 1, max: 3650 }),
    body('note').optional({ nullable: true }).isLength({ max: 255 }),
  ],
  validate,
  ctrl.create
);
router.get('/shares', patientOnly, ctrl.granted);
router.get('/shares/incoming', viewerOnly, ctrl.incoming);
router.delete('/shares/:id', patientOnly, ctrl.revoke);

router.get('/shared/patients', viewerOnly, ctrl.patients);
router.get('/shared/patients/:id/summary', viewerOnly, ctrl.patientSummary);
router.get('/shared/patients/:id/trends', viewerOnly, ctrl.patientTrends);
router.get('/shared/patients/:id/alerts', viewerOnly, ctrl.patientAlerts);
router.get('/shared/reports', viewerOnly, ctrl.sharedReports);

module.exports = router;
