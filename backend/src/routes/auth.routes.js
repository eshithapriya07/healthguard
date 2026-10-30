const { Router } = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/auth.controller');

const router = Router();

/** Brute-force protection on the login endpoint (per IP). */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_attempts', message: 'Too many login attempts. Try again in 15 minutes.' },
});

const passwordRules = body('password')
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters.')
  .matches(/[a-z]/)
  .withMessage('Password must contain a lowercase letter.')
  .matches(/[A-Z]/)
  .withMessage('Password must contain an uppercase letter.')
  .matches(/\d/)
  .withMessage('Password must contain a number.');

router.post(
  '/register',
  [
    body('fullName').trim().isLength({ min: 2, max: 120 }).withMessage('Please enter your full name.'),
    body('email').isEmail().withMessage('Please enter a valid email.').normalizeEmail(),
    passwordRules,
    body('language').optional().isIn(['en', 'hi']).withMessage('Language must be en or hi.'),
  ],
  validate,
  ctrl.register
);

router.post(
  '/login',
  loginLimiter,
  [body('email').isEmail().withMessage('Please enter a valid email.').normalizeEmail(), body('password').notEmpty().withMessage('Password is required.')],
  validate,
  ctrl.login
);

router.get('/me', authenticate, ctrl.me);

router.post(
  '/forgot-password',
  [body('email').isEmail().withMessage('Please enter a valid email.').normalizeEmail()],
  validate,
  ctrl.forgotPassword
);

router.post('/reset-password', [body('token').notEmpty().withMessage('Reset token is required.'), passwordRules], validate, ctrl.resetPassword);

router.post('/change-password', authenticate, [body('currentPassword').notEmpty(), passwordRules], validate, ctrl.changePassword);

module.exports = router;
