const { query } = require('../config/db');

/** Data access for users, roles, profiles and language preference. */
const UserModel = {
  async getRoles() {
    return query('SELECT id, code, name_en, name_hi FROM roles ORDER BY id');
  },

  async getRoleByCode(code) {
    const rows = await query('SELECT id, code FROM roles WHERE code = ? LIMIT 1', [code]);
    return rows[0] || null;
  },

  async findByEmail(email) {
    const rows = await query(
      `SELECT u.id, u.email, u.full_name, u.password_hash, u.preferred_language, u.status,
              u.reset_token, u.reset_expires_at, r.code AS role
         FROM users u
         JOIN roles r ON r.id = u.role_id
        WHERE u.email = ? LIMIT 1`,
      [email]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const rows = await query(
      `SELECT u.id, u.email, u.full_name, u.preferred_language, u.status, u.last_login_at,
              u.created_at, r.code AS role, r.name_en AS role_name_en, r.name_hi AS role_name_hi
         FROM users u
         JOIN roles r ON r.id = u.role_id
        WHERE u.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  async create({ fullName, email, passwordHash, roleCode = 'patient', language = 'en' }) {
    const role = await this.getRoleByCode(roleCode);
    if (!role) throw Object.assign(new Error('Unknown role'), { status: 400, code: 'unknown_role' });
    const result = await query(
      `INSERT INTO users (full_name, email, password_hash, role_id, preferred_language)
       VALUES (?, ?, ?, ?, ?)`,
      [fullName, email, passwordHash, role.id, language]
    );
    const userId = result.insertId;
    await query('INSERT INTO user_profiles (user_id) VALUES (?)', [userId]);
    return userId;
  },

  async touchLogin(id) {
    await query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [id]);
  },

  async setPreferredLanguage(id, language) {
    await query('UPDATE users SET preferred_language = ? WHERE id = ?', [language, id]);
    return language;
  },

  async setPassword(id, passwordHash) {
    await query('UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires_at = NULL WHERE id = ?', [
      passwordHash,
      id,
    ]);
  },

  async setResetToken(email, token, expiresAt) {
    await query('UPDATE users SET reset_token = ?, reset_expires_at = ? WHERE email = ?', [
      token,
      expiresAt,
      email,
    ]);
  },

  async findByResetToken(token) {
    const rows = await query(
      `SELECT id FROM users WHERE reset_token = ? AND reset_expires_at > NOW() LIMIT 1`,
      [token]
    );
    return rows[0] || null;
  },

  // ---------------------------------------------------------------- profile
  async getProfile(userId) {
    const rows = await query(
      `SELECT u.id, u.email, u.full_name, u.preferred_language, u.status, u.last_login_at,
              r.code AS role,
              p.age, p.gender, p.height_cm, p.weight_kg, p.blood_group,
              p.known_conditions, p.allergies,
              p.emergency_contact_name, p.emergency_contact_phone
         FROM users u
         JOIN roles r ON r.id = u.role_id
         LEFT JOIN user_profiles p ON p.user_id = u.id
        WHERE u.id = ? LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  },

  async updateProfile(userId, p) {
    await query(
      `INSERT INTO user_profiles
         (user_id, age, gender, height_cm, weight_kg, blood_group, known_conditions, allergies,
          emergency_contact_name, emergency_contact_phone)
       VALUES (?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         age=VALUES(age), gender=VALUES(gender), height_cm=VALUES(height_cm),
         weight_kg=VALUES(weight_kg), blood_group=VALUES(blood_group),
         known_conditions=VALUES(known_conditions), allergies=VALUES(allergies),
         emergency_contact_name=VALUES(emergency_contact_name),
         emergency_contact_phone=VALUES(emergency_contact_phone)`,
      [
        userId,
        p.age ?? null,
        p.gender || 'unspecified',
        p.heightCm ?? null,
        p.weightKg ?? null,
        p.bloodGroup || null,
        p.knownConditions || null,
        p.allergies || null,
        p.emergencyContactName || null,
        p.emergencyContactPhone || null,
      ]
    );
    await query('UPDATE users SET full_name = ? WHERE id = ?', [p.fullName, userId]);
  },

  async touchWeight(userId, weightKg) {
    if (weightKg == null) return;
    await query('UPDATE user_profiles SET weight_kg = ? WHERE user_id = ?', [weightKg, userId]);
  },
};

module.exports = UserModel;
