const cron = require('node-cron');
const env = require('../config/env');
const ReminderModel = require('../models/reminder.model');
const AlertModel = require('../models/alert.model');
const SharingModel = require('../models/sharing.model');
const AdminModel = require('../models/admin.model');
const { sendAlertEmail } = require('../services/emailService');
const UserModel = require('../models/user.model');

/**
 * Background scheduler (node-cron):
 *  - fires due reminders -> in-app notification (+ optional e-mail)
 *  - marks overdue share permissions as expired
 * Runs every minute by default (CRON_SCHEDULE).
 */
async function tick() {
  const now = new Date();

  // ------------------------------------------------------------ reminders
  const due = await ReminderModel.dueReminders(now.toISOString().slice(0, 19).replace('T', ' '));
  for (const row of due) {
    const title = { en: `Reminder: ${row.title}`, hi: `रिमाइंडर: ${row.title}` };
    const body = {
      en: `Your ${row.type} reminder is due now.${row.notes ? ` ${row.notes}` : ''}`,
      hi: `आपका ${row.type} रिमाइंडर अभी होना है।${row.notes ? ` ${row.notes}` : ''}`,
    };
    await AlertModel.insertNotification({
      userId: row.user_id,
      type: 'reminder',
      refId: row.id,
      titleEn: title.en,
      titleHi: title.hi,
      bodyEn: body.en,
      bodyHi: body.hi,
    });
    await ReminderModel.advanceRecurring(row, now.toISOString().slice(0, 19).replace('T', ' '));

    if (env.email.enabled) {
      const user = await UserModel.findById(row.user_id);
      if (user) {
        await sendAlertEmail({ to: user.email, name: user.full_name, title: title.en, message: body.en, language: 'en' });
      }
    }
  }

  // ------------------------------------------------------ share expiry
  const expired = await SharingModel.expireOverdue();
  if (expired > 0) await AdminModel.audit({ action: 'share.auto_expire', detail: `${expired} permission(s) expired` });
}

function startScheduler() {
  if (!env.cron.enabled) {
    console.log('[cron] disabled by CRON_ENABLED=false');
    return null;
  }
  if (!cron.validate(env.cron.schedule)) {
    console.error(`[cron] invalid CRON_SCHEDULE "${env.cron.schedule}" - scheduler not started`);
    return null;
  }
  const task = cron.schedule(env.cron.schedule, () => {
    tick().catch((err) => console.error('[cron] tick failed:', err.message));
  });
  console.log(`[cron] reminder scheduler started: ${env.cron.schedule}`);
  return task;
}

module.exports = { startScheduler, tick };
