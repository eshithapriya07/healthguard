const { Router } = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/report.controller');

const router = Router();
router.use(authenticate);

router.get('/reports', authorize('patient', 'admin'), ctrl.list);
router.post(
  '/reports/generate',
  authorize('patient', 'admin'),
  [
    body('dateFrom').isISO8601().withMessage('Start date is required.'),
    body('dateTo').isISO8601().withMessage('End date is required.'),
    body('parameters').optional().isArray().withMessage('Parameters must be a list.'),
    body('title').optional().isLength({ max: 160 }),
  ],
  validate,
  ctrl.generate
);
router.get('/reports/:id', ctrl.detail);
router.delete('/reports/:id', ctrl.remove);
router.get('/shared/reports/:id', authorize('caregiver', 'doctor'), ctrl.sharedReport);

// optional medical report metadata
router.get('/documents', ctrl.listDocuments);
router.post(
  '/documents',
  authorize('patient', 'admin'),
  [
    body('title').trim().isLength({ min: 2, max: 160 }).withMessage('Please enter a title.'),
    body('filePath').trim().isLength({ min: 1, max: 500 }).withMessage('File path is required.'),
    body('documentDate').optional({ nullable: true }).isISO8601(),
  ],
  validate,
  ctrl.addDocument
);
router.delete('/documents/:id', ctrl.removeDocument);

module.exports = router;
