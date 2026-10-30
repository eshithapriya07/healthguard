const ReadingModel = require('../models/reading.model');
const AlertModel = require('../models/alert.model');
const ReminderModel = require('../models/reminder.model');
const UserModel = require('../models/user.model');
const alertEngine = require('../services/alertEngine');
const { asyncHandler } = require('../middleware/auth');
const { audit } = require('../services/auditService');

/** Server side realism check (client side validation mirrors this). */
function rangeError(parameter, { value, systolic, diastolic }) {
  if (parameter.value_kind === 'bp') {
    if (systolic == null || diastolic == null) return 'Both systolic and diastolic values are required.';
    if (systolic < 50 || systolic > 300) return 'Systolic must be between 50 and 300 mmHg.';
    if (diastolic < 30 || diastolic > 200) return 'Diastolic must be between 30 and 200 mmHg.';
    if (diastolic >= systolic) return 'Diastolic must be lower than systolic.';
    return null;
  }
  if (value == null) return 'A value is required.';
  const min = parameter.min_valid == null ? -Infinity : Number(parameter.min_valid);
  const max = parameter.max_valid == null ? Infinity : Number(parameter.max_valid);
  if (value < min || value > max) {
    return `${parameter.name_en} must be between ${min} and ${max} ${parameter.unit}.`;
  }
  return null;
}

function toReadingPayload(row) {
  return {
    id: row.id,
    parameter: row.parameter_code,
    value: row.value == null ? null : Number(row.value),
    systolic: row.systolic,
    diastolic: row.diastolic,
    pulse: row.pulse,
    unit: row.unit,
    measuredAt: row.measured_at,
    notes: row.notes,
  };
}

/** GET /api/parameters — lookup list used by every form and chart. */
const listParameters = asyncHandler(async (req, res) => {
  const rows = await ReadingModel.listParameterTypes();
  res.json({ parameters: rows });
});

/** GET /api/readings?parameter=bp&from=&to=&page=&limit= */
const listReadings = asyncHandler(async (req, res) => {
  const { parameter, from, to, page, limit } = req.query;
  const result = await ReadingModel.list({
    userId: req.user.id,
    code: parameter || null,
    from: from || null,
    to: to ? `${to} 23:59:59` : null,
    page,
    limit,
  });
  res.json({
    readings: result.rows.map(toReadingPayload),
    total: result.total,
    page: result.page,
    limit: result.limit,
  });
});

/** POST /api/readings — stores the value and runs the alert engine. */
const createReading = asyncHandler(async (req, res) => {
  const { parameter: code, measuredAt, notes, systolic, diastolic, pulse, value } = req.body;
  const parameter = await ReadingModel.findParameterByCode(code);
  if (!parameter) return res.status(400).json({ error: 'unknown_parameter', message: 'Unknown parameter.' });

  const error = rangeError(parameter, { value, systolic, diastolic });
  if (error) return res.status(400).json({ error: 'range_error', message: error });

  const readingId = await ReadingModel.createReading({
    userId: req.user.id,
    parameterId: parameter.id,
    systolic: parameter.value_kind === 'bp' ? systolic : null,
    diastolic: parameter.value_kind === 'bp' ? diastolic : null,
    pulse: pulse ?? null,
    value: parameter.value_kind === 'bp' ? null : value,
    measuredAt: measuredAt.replace('T', ' ').slice(0, 19),
    notes,
  });

  if (code === 'weight' && value != null) await UserModel.touchWeight(req.user.id, value);

  const reading = await ReadingModel.findById(readingId, req.user.id);
  const alerts = await alertEngine.processReading({
    user: { id: req.user.id },
    reading: {
      id: readingId,
      systolic: reading.systolic,
      diastolic: reading.diastolic,
      value: reading.value == null ? null : Number(reading.value),
      measured_at: reading.measured_at,
    },
    parameter,
  });

  await audit(req, 'reading.create', 'health_readings', readingId, `${code} reading saved`);
  res.status(201).json({ reading: toReadingPayload(reading), alerts });
});

/** PUT /api/readings/:id */
const updateReading = asyncHandler(async (req, res) => {
  const existing = await ReadingModel.findById(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'not_found', message: 'Reading not found.' });

  const parameter = await ReadingModel.findParameterByCode(existing.parameter_code);
  const { measuredAt, notes, systolic, diastolic, pulse, value } = req.body;
  const error = rangeError(parameter, { value, systolic, diastolic });
  if (error) return res.status(400).json({ error: 'range_error', message: error });

  await ReadingModel.updateReading({
    id: existing.id,
    userId: req.user.id,
    systolic: parameter.value_kind === 'bp' ? systolic : null,
    diastolic: parameter.value_kind === 'bp' ? diastolic : null,
    pulse: pulse ?? null,
    value: parameter.value_kind === 'bp' ? null : value,
    measuredAt: (measuredAt || existing.measured_at).replace('T', ' ').slice(0, 19),
    notes,
  });
  await audit(req, 'reading.update', 'health_readings', existing.id, `${existing.parameter_code} reading updated`);
  const updated = await ReadingModel.findById(existing.id, req.user.id);
  res.json({ reading: toReadingPayload(updated) });
});

/** DELETE /api/readings/:id */
const deleteReading = asyncHandler(async (req, res) => {
  const affected = await ReadingModel.deleteReading(req.params.id, req.user.id);
  if (!affected) return res.status(404).json({ error: 'not_found', message: 'Reading not found.' });
  await audit(req, 'reading.delete', 'health_readings', req.params.id, 'reading deleted');
  res.json({ message: 'Reading deleted.' });
});

/**
 * GET /api/dashboard — latest cards (with status colour), 7/30 day
 * summaries, alert counters, recent alerts and upcoming reminders.
 */
const dashboard = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const thresholds = await AlertModel.getEnabledThresholds();
  const latest = await ReadingModel.latestPerParameter(userId);

  const days = Number(req.query.days) > 0 ? Number(req.query.days) : 30;
  const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  const summary = await ReadingModel.summary({ userId, from, to: `${to} 23:59:59` });

  const cards = latest.map((r) => {
    const reading =
      r.value_kind === 'bp'
        ? { systolic: r.systolic, diastolic: r.diastolic }
        : { value: r.value == null ? null : Number(r.value) };
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

  const alertCounts = await AlertModel.countAlerts(userId, `${from} 00:00:00`);
  const recentAlerts = await AlertModel.recentAlerts(userId, 5);
  const unread = await AlertModel.unreadNotificationCount(userId);
  const upcoming = (await ReminderModel.list(userId, { limit: 5 })).filter(
    (r) => r.status === 'scheduled' || r.status === 'snoozed'
  );
  const profile = await UserModel.getProfile(userId);

  res.json({
    cards,
    summary: summary.map((s) => ({
      parameter: s.code,
      count: Number(s.count),
      unit: s.unit,
      valueKind: s.value_kind,
      avg: s.value_kind === 'bp' ? { systolic: s.avg_sys, diastolic: s.avg_dia } : Number(s.avg_value),
      min: s.value_kind === 'bp' ? { systolic: s.min_sys, diastolic: s.min_dia } : Number(s.min_value),
      max: s.value_kind === 'bp' ? { systolic: s.max_sys, diastolic: s.max_dia } : Number(s.max_value),
    })),
    alertCounts,
    recentAlerts,
    unreadNotifications: unread,
    upcomingReminders: upcoming,
    profile: { fullName: profile.full_name, language: profile.preferred_language },
    range: { from, to, days },
  });
});

/** GET /api/trends?parameter=bp&days=7 | from=&to= — chart series. */
const trends = asyncHandler(async (req, res) => {
  const code = req.query.parameter || 'bp';
  const to = req.query.to || new Date().toISOString().slice(0, 10);
  const from = req.query.from || new Date(Date.now() - (Number(req.query.days) || 7) * 86400000).toISOString().slice(0, 10);
  const parameter = await ReadingModel.findParameterByCode(code);
  if (!parameter) return res.status(400).json({ error: 'unknown_parameter', message: 'Unknown parameter.' });

  const rows = await ReadingModel.series({ userId: req.user.id, code, from, to: `${to} 23:59:59` });
  const thresholds = await AlertModel.getEnabledThresholds();
  const summaryRows = await ReadingModel.summary({ userId: req.user.id, from, to: `${to} 23:59:59` });
  const summary = summaryRows.find((s) => s.code === code) || null;

  res.json({
    parameter: code,
    range: { from, to },
    points: rows.map((r) => ({
      t: r.measured_at,
      systolic: r.systolic,
      diastolic: r.diastolic,
      value: r.value == null ? null : Number(r.value),
      status: alertEngine.statusFor(
        parameter.value_kind === 'bp' ? { systolic: r.systolic, diastolic: r.diastolic } : { value: r.value == null ? null : Number(r.value) },
        thresholds[code] || []
      ),
    })),
    summary: summary
      ? {
          count: Number(summary.count),
          avg: summary.value_kind === 'bp' ? { systolic: summary.avg_sys, diastolic: summary.avg_dia } : Number(summary.avg_value),
          min: summary.value_kind === 'bp' ? { systolic: summary.min_sys, diastolic: summary.min_dia } : Number(summary.min_value),
          max: summary.value_kind === 'bp' ? { systolic: summary.max_sys, diastolic: summary.max_dia } : Number(summary.max_value),
        }
      : null,
  });
});

module.exports = {
  listParameters,
  listReadings,
  createReading,
  updateReading,
  deleteReading,
  dashboard,
  trends,
  rangeError,
};
