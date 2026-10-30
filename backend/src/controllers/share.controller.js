const SharingModel = require('../models/sharing.model');
const ReportModel = require('../models/report.model');
const UserModel = require('../models/user.model');
const ReadingModel = require('../models/reading.model');
const AlertModel = require('../models/alert.model');
const alertEngine = require('../services/alertEngine');
const { asyncHandler } = require('../middleware/auth');
const { audit } = require('../services/auditService');

/**
 * Controlled sharing: the patient chooses exactly which parameters /
 * reports a caregiver or doctor may see, and for how long.
 */

/** POST /api/shares { email, items[], expiresInDays?, note? } */
const create = asyncHandler(async (req, res) => {
  const { email, items, expiresInDays, note } = req.body;
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'no_items', message: 'Choose at least one item to share.' });
  }
  const grantee = await UserModel.findByEmail(email);
  if (!grantee) return res.status(404).json({ error: 'user_not_found', message: 'No account found for that email.' });
  if (grantee.id === req.user.id) {
    return res.status(400).json({ error: 'self_share', message: 'You cannot share data with yourself.' });
  }
  if (grantee.role !== 'caregiver' && grantee.role !== 'doctor') {
    return res.status(400).json({
      error: 'invalid_role',
      message: 'Data can only be shared with a caregiver or a doctor account.',
    });
  }

  const startsAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const expiresAt = expiresInDays
    ? new Date(Date.now() + Number(expiresInDays) * 86400000).toISOString().slice(0, 19).replace('T', ' ')
    : null;

  const id = await SharingModel.create({
    patientId: req.user.id,
    granteeId: grantee.id,
    items,
    note,
    startsAt,
    expiresAt,
  });
  await audit(req, 'share.create', 'access_permissions', id, `share ${items.join(',')} -> ${email}`);
  res.status(201).json({
    share: { id, items, expiresAt, status: 'active', granteeName: grantee.full_name, granteeEmail: grantee.email },
  });
});

/** GET /api/shares — permissions I granted. */
const granted = asyncHandler(async (req, res) => {
  const rows = await SharingModel.grantedBy(req.user.id);
  res.json({
    shares: rows.map((r) => ({
      id: r.id,
      items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items,
      note: r.note,
      startsAt: r.starts_at,
      expiresAt: r.expires_at,
      status: r.status,
      active: r.status === 'active' && (!r.expires_at || new Date(r.expires_at) > new Date()),
      granteeName: r.grantee_name,
      granteeEmail: r.grantee_email,
      granteeRole: r.grantee_role,
    })),
  });
});

/** GET /api/shares/incoming — permissions granted to me. */
const incoming = asyncHandler(async (req, res) => {
  const rows = await SharingModel.grantedTo(req.user.id);
  res.json({ shares: rows });
});

/** DELETE /api/shares/:id — revoke immediately. */
const revoke = asyncHandler(async (req, res) => {
  const affected = await SharingModel.revoke(req.params.id, req.user.id);
  if (!affected) return res.status(404).json({ error: 'not_found', message: 'Share not found or already inactive.' });
  await audit(req, 'share.revoke', 'access_permissions', req.params.id, 'permission revoked');
  res.json({ message: 'Access revoked.' });
});

/** GET /api/shared/patients — patients sharing their data with me. */
const patients = asyncHandler(async (req, res) => {
  const rows = await SharingModel.grantedTo(req.user.id);
  const active = rows.filter((r) => r.active);
  const result = [];
  for (const row of active) {
    const items = await SharingModel.sharedItems(row.patient_id, req.user.id);
    const profile = await UserModel.getProfile(row.patient_id);
    result.push({
      patientId: row.patient_id,
      name: profile.full_name,
      items,
      expiresAt: row.expires_at,
      permissionId: row.id,
    });
  }
  res.json({ patients: result });
});

/**
 * GET /api/shared/patients/:id/summary — read-only dashboard containing ONLY
 * the parameters the patient shared with this account.
 */
const patientSummary = asyncHandler(async (req, res) => {
  const patientId = Number(req.params.id);
  const items = await SharingModel.sharedItems(patientId, req.user.id);
  if (!items.length) {
    return res.status(403).json({ error: 'forbidden', message: 'The patient has not shared any data with you.' });
  }
  const codes = items.filter((i) => i !== 'report' && i !== 'all');
  const thresholds = await AlertModel.getEnabledThresholds();
  const latest = await ReadingModel.latestPerParameter(patientId);

  const cards = latest
    .filter((r) => codes.includes(r.code) || items.includes('all'))
    .map((r) => {
      const reading = r.value_kind === 'bp' ? { systolic: r.systolic, diastolic: r.diastolic } : { value: r.value == null ? null : Number(r.value) };
      return {
        parameter: r.code,
        nameEn: r.name_en,
        nameHi: r.name_hi,
        unit: r.unit,
        valueKind: r.value_kind,
        systolic: r.systolic,
        diastolic: r.diastolic,
        value: r.value == null ? null : Number(r.value),
        measuredAt: r.measured_at,
        status: alertEngine.statusFor(reading, thresholds[r.code] || []),
      };
    });

  const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  const summaryRows = await ReadingModel.summary({ userId: patientId, from, to: `${to} 23:59:59` });
  const summary = summaryRows.filter((s) => codes.includes(s.code) || items.includes('all'));

  res.json({
    patient: { id: patientId },
    items,
    cards,
    range: { from, to },
    summary: summary.map((s) => ({
      parameter: s.code,
      count: Number(s.count),
      unit: s.unit,
      valueKind: s.value_kind,
      avg: s.value_kind === 'bp' ? { systolic: s.avg_sys, diastolic: s.avg_dia } : Number(s.avg_value),
      min: s.value_kind === 'bp' ? { systolic: s.min_sys, diastolic: s.min_dia } : Number(s.min_value),
      max: s.value_kind === 'bp' ? { systolic: s.max_sys, diastolic: s.max_dia } : Number(s.max_value),
    })),
  });
});

/** GET /api/shared/patients/:id/trends?parameter=bp */
const patientTrends = asyncHandler(async (req, res) => {
  const patientId = Number(req.params.id);
  const code = req.query.parameter;
  const items = await SharingModel.sharedItems(patientId, req.user.id);
  if (!items.includes(code) && !items.includes('all')) {
    return res.status(403).json({ error: 'forbidden', message: 'This parameter is not shared with you.' });
  }
  const to = req.query.to || new Date().toISOString().slice(0, 10);
  const from = req.query.from || new Date(Date.now() - (Number(req.query.days) || 30) * 86400000).toISOString().slice(0, 10);
  const rows = await ReadingModel.series({ userId: patientId, code, from, to: `${to} 23:59:59` });
  res.json({
    parameter: code,
    range: { from, to },
    points: rows.map((r) => ({ t: r.measured_at, systolic: r.systolic, diastolic: r.diastolic, value: r.value == null ? null : Number(r.value) })),
  });
});

/** GET /api/shared/patients/:id/alerts — only when "alerts" was shared. */
const patientAlerts = asyncHandler(async (req, res) => {
  const patientId = Number(req.params.id);
  const items = await SharingModel.sharedItems(patientId, req.user.id);
  if (!items.includes('alerts') && !items.includes('all')) {
    return res.status(403).json({ error: 'forbidden', message: 'Alerts are not shared with you.' });
  }
  const result = await AlertModel.listAlerts({ userId: patientId, limit: 20 });
  res.json(result);
});

/** GET /api/shared/reports — reports shared with me (via the "report" item). */
const sharedReports = asyncHandler(async (req, res) => {
  const rows = await SharingModel.grantedTo(req.user.id);
  const active = rows.filter((r) => r.active && (r.items.includes('report') || r.items.includes('all')));
  const reports = [];
  for (const row of active) {
    const list = await ReportModel.list(row.patient_id);
    list.slice(0, 5).forEach((r) => {
      reports.push({ ...r, patientId: row.patient_id, patientName: row.patient_name });
    });
  }
  res.json({ reports });
});

module.exports = { create, granted, incoming, revoke, patients, patientSummary, patientTrends, patientAlerts, sharedReports };
