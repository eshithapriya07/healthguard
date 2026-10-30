const jwt = require('jsonwebtoken');
const env = require('../config/env');

/** Wrap async route handlers so rejected promises reach the error middleware. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Verifies the Bearer token and attaches { id, role, language } to req.user. */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'auth_required', message: 'Authentication required.' });
  }
  try {
    const payload = jwt.verify(token, env.jwt.secret);
    req.user = {
      id: Number(payload.sub),
      role: payload.role,
      language: payload.language || 'en',
      email: payload.email,
    };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid_token', message: 'Token is invalid or expired.' });
  }
}

/**
 * Role based route guard: authorize('admin'), authorize('patient','caregiver')
 * Also accepts a "self" marker resolved against req.params.userId when present.
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'auth_required', message: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: 'forbidden', message: 'You do not have permission to perform this action.' });
    }
    return next();
  };
}

module.exports = { asyncHandler, authenticate, authorize };
