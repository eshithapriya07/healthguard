const ReminderModel = require('../models/reminder.model');
const { asyncHandler } = require('../middleware/auth');
const { audit } = require('../services/auditService');

/** GET /api/reminders?status=scheduled */
const list = asyncHandler(async (req, res) => {
  const rows = await ReminderModel.list(req.user.id, { status: req.query.status || null });
  res.json({ reminders: rows });
});

/** POST /api/reminders */
const create = asyncHandler(async (req, res) => {
  const { type, title, notes, scheduledAt, recurrence } = req.body;
  const id = await ReminderModel.create({
    userId: req.user.id,
    type,
    title,
    notes,
    scheduledAt: scheduledAt.replace('T', ' ').slice(0, 19),
    recurrence,
  });
  await audit(req, 'reminder.create', 'reminders', id, title);
  const [reminder] = await ReminderModel.list(req.user.id, { limit: 100 }).then((r) => r.filter((x) => x.id === id));
  res.status(201).json({ reminder });
});

/** PUT /api/reminders/:id */
const update = asyncHandler(async (req, res) => {
  const existing = await ReminderModel.find(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'not_found', message: 'Reminder not found.' });
  const fields = {};
  if (req.body.title !== undefined) fields.title = req.body.title;
  if (req.body.type !== undefined) fields.type = req.body.type;
  if (req.body.notes !== undefined) fields.notes = req.body.notes;
  if (req.body.recurrence !== undefined) fields.recurrence = req.body.recurrence;
  if (req.body.scheduledAt !== undefined) fields.scheduled_at = req.body.scheduledAt.replace('T', ' ').slice(0, 19);
  if (req.body.status !== undefined) fields.status = req.body.status;
  await ReminderModel.update(req.params.id, req.user.id, fields);
  await audit(req, 'reminder.update', 'reminders', req.params.id, 'reminder updated');
  const reminder = await ReminderModel.find(req.params.id, req.user.id);
  res.json({ reminder });
});

/** DELETE /api/reminders/:id */
const remove = asyncHandler(async (req, res) => {
  const affected = await ReminderModel.remove(req.params.id, req.user.id);
  if (!affected) return res.status(404).json({ error: 'not_found', message: 'Reminder not found.' });
  await audit(req, 'reminder.delete', 'reminders', req.params.id, 'reminder deleted');
  res.json({ message: 'Reminder deleted.' });
});

/** POST /api/reminders/:id/done */
const markDone = asyncHandler(async (req, res) => {
  const affected = await ReminderModel.update(req.params.id, req.user.id, { status: 'done' });
  if (!affected) return res.status(404).json({ error: 'not_found', message: 'Reminder not found.' });
  res.json({ message: 'Reminder completed.', status: 'done' });
});

/** POST /api/reminders/:id/snooze { minutes } */
const snooze = asyncHandler(async (req, res) => {
  const minutes = Number(req.body.minutes) || 10;
  const until = new Date(Date.now() + minutes * 60000).toISOString().slice(0, 19).replace('T', ' ');
  const affected = await ReminderModel.update(req.params.id, req.user.id, {
    status: 'snoozed',
    snoozed_until: until,
  });
  if (!affected) return res.status(404).json({ error: 'not_found', message: 'Reminder not found.' });
  res.json({ message: `Snoozed for ${minutes} minutes.`, status: 'snoozed', snoozedUntil: until });
});

module.exports = { list, create, update, remove, markDone, snooze };
