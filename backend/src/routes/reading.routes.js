const { Router } = require('express');
const { body, query } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/reading.controller');

const router = Router();
router.use(authenticate);

/** Readings + trends belong to the patient role; caregivers read shared data elsewhere. */
const writer = authorize('patient', 'admin');

router.get('/parameters', ctrl.listParameters);

router.get(
  '/readings',
  [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 200 })],
  validate,
  ctrl.listReadings
);

router.post(
  '/readings',
  writer,
  [
    body('parameter').isIn(['bp', 'spo2', 'heart_rate', 'glucose', 'temperature', 'weight']).withMessage('Unknown parameter.'),
    body('measuredAt').isISO8601().withMessage('Please provide a valid date and time.'),
    body('systolic').optional({ nullable: true }).isInt({ min: 50, max: 300 }),
    body('diastolic').optional({ nullable: true }).isInt({ min: 30, max: 200 }),
    body('value').optional({ nullable: true }).isFloat({ min: 0, max: 1000 }),
    body('notes').optional({ nullable: true }).isLength({ max: 500 }),
  ],
  validate,
  ctrl.createReading
);

router.put('/readings/:id', writer, validate, ctrl.updateReading);
router.delete('/readings/:id', writer, ctrl.deleteReading);

router.get('/dashboard', ctrl.dashboard);

router.get('/trends', [query('days').optional().isInt({ min: 1, max: 3650 })], validate, ctrl.trends);

module.exports = router;
