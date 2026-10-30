const nodemailer = require('nodemailer');
const env = require('../config/env');

/**
 * Optional e-mail notifications. When EMAIL_ENABLED=false (default) every
 * call resolves immediately, so the app runs with no SMTP server at all.
 */
let transporter = null;
if (env.email.enabled && env.email.host) {
  transporter = nodemailer.createTransport({
    host: env.email.host,
    port: env.email.port,
    secure: env.email.port === 465,
    auth: env.email.user ? { user: env.email.user, pass: env.email.pass } : undefined,
  });
}

async function sendMail({ to, subject, text, html }) {
  if (!transporter) return { skipped: true, reason: 'email_disabled' };
  try {
    await transporter.sendMail({ from: env.email.from, to, subject, text, html });
    return { sent: true };
  } catch (err) {
    console.error('[email]', err.message);
    return { sent: false, error: err.message };
  }
}

/** Alert notification e-mail (cautious wording, includes the disclaimer). */
async function sendAlertEmail({ to, name, title, message, language }) {
  const subject = language === 'hi' ? `HealthGuard अलर्ट: ${title}` : `HealthGuard alert: ${title}`;
  const disclaimer =
    language === 'hi'
      ? 'यह चिकित्सकीय सलाह नहीं है। कृपया किसी योग्य डॉक्टर से परामर्श लें।'
      : 'This is not medical advice. Consult a qualified doctor.';
  return sendMail({
    to,
    subject,
    text: `${name},\n\n${message}\n\n${disclaimer}\n\n— HealthGuard`,
    html: `<p>${name},</p><p>${message}</p><p><strong>${disclaimer}</strong></p><p>— HealthGuard</p>`,
  });
}

module.exports = { sendMail, sendAlertEmail };
