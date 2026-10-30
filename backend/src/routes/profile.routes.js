const { Router } = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/profile.controller');

const router = Router();
router.use(authenticate);

router.get('/', ctrl.getProfile);

router.put(
  '/',
  [
    body('fullName').trim().isLength({ min: 2, max: 120 }).withMessage('Please enter your full name.'),
    body('age').optional({ nullable: true }).isInt({ min: 1, max: 120 }).withMessage('Age must be between 1 and 120.'),
    body('gender').optional().isIn(['female', 'male', 'other', 'unspecified']),
    body('heightCm').optional({ nullable: true }).isFloat({ min: 50, max: 260 }).withMessage('Height must be 50–260 cm.'),
    body('weightKg').optional({ nullable: true }).isFloat({ min: 2, max: 400 }).withMessage('Weight must be 2–400 kg.'),
    body('bloodGroup').optional({ nullable: true }).matches(/^(A|B|AB|O)[+-]$/i).withMessage('Blood group must look like A+ or O-.'),
    body('emergencyContactPhone').optional({ nullable: true }).isLength({ max: 30 }),
  ],
  validate,
  ctrl.updateProfile
);

/** Language selection screen (after login) and the navbar EN | हिं switcher. */
router.put('/language', [body('language').isIn(['en', 'hi']).withMessage('Language must be en or hi.')], validate, ctrl.setLanguage);

module.exports = router;
