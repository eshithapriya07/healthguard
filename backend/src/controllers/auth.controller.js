const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');
const UserModel = require('../models/user.model');
const { audit } = require('../services/auditService');
const { asyncHandler } = require('../middleware/auth');

const BCRYPT_ROUNDS = 10;

function signToken(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role, language: user.language || user.preferred_language || 'en', email: user.email },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name || user.fullName,
    role: user.role,
    language: user.preferred_language || user.language || 'en',
    status: user.status || 'active',
  };
}

/** POST /api/auth/register — self registration always creates a patient account. */
const register = asyncHandler(async (req, res) => {
  const { fullName, email, password, language = 'en' } = req.body;
  const existing = await UserModel.findByEmail(email);
  if (existing) {
    return res.status(409).json({ error: 'email_taken', message: 'An account with this email already exists.' });
  }
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const id = await UserModel.create({ fullName, email, passwordHash, roleCode: 'patient', language });
  const user = await UserModel.findById(id);
  await audit(req, 'auth.register', 'users', id, `registered ${email}`);
  res.status(201).json({ token: signToken({ ...user, language }), user: publicUser(user) });
});

/** POST /api/auth/login */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await UserModel.findByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'invalid_credentials', message: 'Incorrect email or password.' });
  }
  if (user.status !== 'active') {
    await audit(req, 'auth.login_blocked', 'users', user.id, 'inactive account');
    return res.status(403).json({ error: 'account_inactive', message: 'This account has been deactivated. Contact the administrator.' });
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    await audit(req, 'auth.login_failed', 'users', user.id, `failed login for ${email}`);
    return res.status(401).json({ error: 'invalid_credentials', message: 'Incorrect email or password.' });
  }
  await UserModel.touchLogin(user.id);
  await audit(req, 'auth.login', 'users', user.id, `login ${email}`);
  const profile = await UserModel.findById(user.id);
  res.json({ token: signToken({ ...profile, email: user.email }), user: publicUser({ ...profile, email: user.email }) });
});

/** GET /api/auth/me */
const me = asyncHandler(async (req, res) => {
  const user = await UserModel.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'not_found', message: 'User not found.' });
  res.json({ user: publicUser(user) });
});

/** POST /api/auth/forgot-password — issues a short lived reset token. */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await UserModel.findByEmail(email);
  // Always answer the same way so the endpoint cannot be used to probe accounts.
  const generic = { message: 'If that account exists, a reset token has been issued.' };
  if (!user) return res.json(generic);

  const token = crypto.randomBytes(24).toString('hex');
  const expires = new Date(Date.now() + env.reset.ttlMinutes * 60000);
  await UserModel.setResetToken(email, token, expires.toISOString().slice(0, 19).replace('T', ' '));
  await audit(req, 'auth.reset_requested', 'users', user.id, 'password reset requested');
  // Demo mode: no SMTP configured, so the token is returned to the caller.
  return res.json({ ...generic, resetToken: env.reset.demoMode ? token : undefined });
});

/** POST /api/auth/reset-password */
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const user = await UserModel.findByResetToken(token);
  if (!user) {
    return res.status(400).json({ error: 'invalid_token', message: 'This reset token is invalid or has expired.' });
  }
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await UserModel.setPassword(user.id, passwordHash);
  await audit(req, 'auth.reset_completed', 'users', user.id, 'password reset completed');
  res.json({ message: 'Password updated. You can now log in.' });
});

/** POST /api/auth/change-password (authenticated) */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const record = await UserModel.findByEmail(req.user.email);
  const ok = record && (await bcrypt.compare(currentPassword, record.password_hash));
  if (!ok) {
    return res.status(401).json({ error: 'invalid_credentials', message: 'Your current password is incorrect.' });
  }
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await UserModel.setPassword(req.user.id, passwordHash);
  await audit(req, 'auth.password_changed', 'users', req.user.id, 'password changed');
  res.json({ message: 'Password changed successfully.' });
});

module.exports = { register, login, me, forgotPassword, resetPassword, changePassword, publicUser, signToken };
