const UserModel = require('../models/user.model');
const { audit } = require('../services/auditService');
const { asyncHandler } = require('../middleware/auth');

/** GET /api/profile */
const getProfile = asyncHandler(async (req, res) => {
  const profile = await UserModel.getProfile(req.user.id);
  res.json({ profile });
});

/** PUT /api/profile */
const updateProfile = asyncHandler(async (req, res) => {
  const p = req.body;
  await UserModel.updateProfile(req.user.id, {
    fullName: p.fullName,
    age: p.age,
    gender: p.gender,
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    bloodGroup: p.bloodGroup,
    knownConditions: p.knownConditions,
    allergies: p.allergies,
    emergencyContactName: p.emergencyContactName,
    emergencyContactPhone: p.emergencyContactPhone,
  });
  await audit(req, 'profile.update', 'users', req.user.id, 'profile updated');
  const profile = await UserModel.getProfile(req.user.id);
  res.json({ profile });
});

/**
 * PUT /api/profile/language
 * Called from the full-screen language selector right after login and from
 * the navbar switcher (EN | हिं) at any time.
 */
const setLanguage = asyncHandler(async (req, res) => {
  const { language } = req.body;
  await UserModel.setPreferredLanguage(req.user.id, language);
  res.json({ language });
});

module.exports = { getProfile, updateLanguage: setLanguage, updateProfile, setLanguage };
