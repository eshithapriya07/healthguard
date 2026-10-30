const { Router } = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/chat.controller');

const router = Router();
router.use(authenticate);

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_messages', message: 'Please slow down a little.' },
});

router.get('/messages', ctrl.history);
router.delete('/messages', ctrl.clear);
router.post(
  '/',
  chatLimiter,
  [
    body('message').trim().isLength({ min: 1, max: 1000 }).withMessage('Please type a message.'),
    body('language').optional().isIn(['en', 'hi']),
  ],
  validate,
  ctrl.send
);

module.exports = router;
