const { Router } = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/reminder.controller');

const router = Router();
router.use(authenticate, authorize('patient', 'admin'));

router.get('/', ctrl.list);
router.post(
  '/',
  [
    body('type').isIn(['medication', 'appointment', 'measurement', 'other']).withMessage('Unknown reminder type.'),
    body('title').trim().isLength({ min: 2, max: 160 }).withMessage('Please enter a title.'),
    body('scheduledAt').isISO8601().withMessage('Please provide a valid date and time.'),
    body('recurrence').optional().isIn(['once', 'daily', 'weekly']).withMessage('Invalid recurrence.'),
    body('notes').optional({ nullable: true }).isLength({ max: 500 }),
  ],
  validate,
  ctrl.create
);
router.put('/:id', validate, ctrl.update);
router.delete('/:id', ctrl.remove);
router.post('/:id/done', ctrl.markDone);
router.post('/:id/snooze', [body('minutes').optional().isInt({ min: 1, max: 1440 })], validate, ctrl.snooze);

module.exports = router;
