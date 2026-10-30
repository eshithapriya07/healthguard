/**
 * End-to-end smoke test against a running API (npm run dev:backend).
 *   node scripts/smoke-test.mjs
 * Covers: auth, language persistence, dashboard, alerts, reminders,
 * chatbot (EN/HI + refusal), reports, controlled sharing, admin and RBAC.
 */
const BASE = process.env.API_URL || 'http://localhost:4000/api';
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);

async function login(email, password) {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`login failed ${r.status}: ${JSON.stringify(j)}`);
  return j;
}

const get = (p, tok) => fetch(`${BASE}${p}`, { headers: { Authorization: `Bearer ${tok}` } });
const send = (p, tok, method, body) =>
  fetch(`${BASE}${p}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
    body: body ? JSON.stringify(body) : undefined,
  });

const health = await fetch(`${BASE}/health`).then((r) => r.json());
check('health endpoint', health.status === 'ok' && health.database === 'up');

const p = await login('priya.sharma@example.com', 'Patient@123');
check('patient login', p.user.role === 'patient');
const me = await (await get('/auth/me', p.token)).json();
check('me endpoint', me.user.email === 'priya.sharma@example.com');

await send('/profile/language', p.token, 'PUT', { language: 'hi' });
const me2 = await (await get('/auth/me', p.token)).json();
check('language saved to users.preferred_language', me2.user.language === 'hi');
await send('/profile/language', p.token, 'PUT', { language: 'en' });

const dash = await (await get('/dashboard', p.token)).json();
check('dashboard cards', Array.isArray(dash.cards) && dash.cards.length >= 6, `${dash.cards.length} cards`);
check('dashboard summary + alert counts', dash.summary.length >= 5 && Array.isArray(dash.alertCounts));

const newReading = await send('/readings', p.token, 'POST', {
  parameter: 'bp',
  measuredAt: new Date().toISOString(),
  systolic: 191,
  diastolic: 128,
  notes: 'smoke test',
});
const rj = await newReading.json();
check(
  'add reading generates critical alert',
  newReading.status === 201 && (rj.alerts || []).some((a) => a.severity === 'critical'),
  JSON.stringify((rj.alerts || []).map((a) => a.severity))
);

const bad = await send('/readings', p.token, 'POST', { parameter: 'spo2', measuredAt: new Date().toISOString(), value: 140 });
check('out-of-range value rejected', bad.status === 400);

const alerts = await (await get('/alerts?status=unread', p.token)).json();
check('alerts listed', alerts.total >= 1, `${alerts.total} unread`);
const notifs = await (await get('/notifications', p.token)).json();
check('notification bell unread count', notifs.unread >= 1, `${notifs.unread} unread`);

const trends = await (await get('/trends?parameter=bp&days=7', p.token)).json();
check('trends series', Array.isArray(trends.points) && trends.points.length > 0, `${trends.points.length} points`);

const rem = await send('/reminders', p.token, 'POST', {
  type: 'medication',
  title: 'Smoke reminder',
  scheduledAt: new Date(Date.now() + 3600000).toISOString(),
  recurrence: 'daily',
});
check('create reminder', rem.status === 201);
const remId = (await rem.json()).reminder?.id;
if (remId) {
  const done = await send(`/reminders/${remId}/done`, p.token, 'POST', {});
  check('mark reminder done', done.status === 200);
  await send(`/reminders/${remId}`, p.token, 'DELETE');
}

const c1 = await (await send('/chat', p.token, 'POST', { message: 'What does SpO2 mean?', language: 'en' })).json();
check('chatbot explains parameter (EN)', /oxygen/i.test(c1.reply), c1.reply.slice(0, 60));
const c2 = await (await send('/chat', p.token, 'POST', { message: 'मेरा बीपी कैसा है?', language: 'hi' })).json();
check('chatbot trend summary (HI)', /रक्तचाप|रीडिंग/.test(c2.reply), c2.reply.slice(0, 60));
const c3 = await (await send('/chat', p.token, 'POST', { message: 'Do I have diabetes? prescribe me medicine', language: 'en' })).json();
check('chatbot refuses diagnosis (EN)', /diagnose/i.test(c3.reply), c3.reply.slice(0, 60));
const c4 = await (await send('/chat', p.token, 'POST', { message: 'निदान बताओ और दवा दो', language: 'hi' })).json();
check('chatbot refuses diagnosis (HI)', /निदान|दवा|खुराक/.test(c4.reply), c4.reply.slice(0, 60));

const rep = await send('/reports/generate', p.token, 'POST', {
  dateFrom: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
  dateTo: new Date().toISOString().slice(0, 10),
  parameters: ['bp', 'spo2', 'glucose'],
  language: 'en',
});
const repJ = await rep.json();
check('generate report', rep.status === 201, `id=${repJ.reportId} alerts=${repJ.alertCount}`);
const repDetail = await (await get(`/reports/${repJ.reportId}`, p.token)).json();
check('report detail (for PDF)', !!repDetail.report && !!repDetail.stats && !!repDetail.series);

const sh = await send('/shares', p.token, 'POST', {
  email: 'ramesh.family@example.com',
  items: ['bp', 'spo2'],
  expiresInDays: 7,
  note: 'smoke',
});
const shJ = await sh.json();
check('create share', sh.status === 201, JSON.stringify(shJ.share?.items));

const c = await login('ramesh.family@example.com', 'Caregiver@123');
check('caregiver login', c.user.role === 'caregiver');
const sharedPatients = await (await get('/shared/patients', c.token)).json();
check('caregiver sees shared patient', sharedPatients.patients.length >= 1);
const items = sharedPatients.patients[0]?.items || [];
check('caregiver permission scope', items.includes('bp') && items.includes('spo2') && !items.includes('glucose'), items.join(','));

const sum = await (await get(`/shared/patients/${sharedPatients.patients[0].patientId}/summary`, c.token)).json();
const sumCodes = (sum.cards || []).map((x) => x.parameter);
check('caregiver summary filtered to shared params', sumCodes.length > 0 && sumCodes.every((x) => ['bp', 'spo2'].includes(x)), sumCodes.join(','));

const forbidden = await get(`/shared/patients/${sharedPatients.patients[0].patientId}/trends?parameter=glucose`, c.token);
check('unshared parameter blocked (403)', forbidden.status === 403);

const writeBlocked = await send('/readings', c.token, 'POST', {
  parameter: 'bp',
  measuredAt: new Date().toISOString(),
  systolic: 120,
  diastolic: 80,
});
check('caregiver cannot add readings (403)', writeBlocked.status === 403);

const shares = await (await get('/shares', p.token)).json();
const created = shares.shares.find((s) => s.id === shJ.share.id);
if (created) {
  const rev = await send(`/shares/${created.id}`, p.token, 'DELETE');
  check('revoke share', rev.status === 200);
}

const d = await login('dr.mehta@example.com', 'Doctor@123');
check('doctor login', d.user.role === 'doctor');

const a = await login('admin@healthguard.local', 'Admin@123');
check('admin login', a.user.role === 'admin');
const users = await (await get('/admin/users', a.token)).json();
check('admin lists users', users.total >= 4, `${users.total} users`);
const stats = await (await get('/admin/stats', a.token)).json();
check('admin monitoring stats', !!stats.stats?.users?.total && !!stats.stats?.alerts?.total);
const th = await (await get('/admin/thresholds', a.token)).json();
check('admin thresholds', th.thresholds.length >= 10, `${th.thresholds.length} rules`);
const target = th.thresholds[1];
const thUpd = await send(`/admin/thresholds/${target.id}`, a.token, 'PUT', {
  operator: target.operator,
  valuePrimary: 142,
  valueSecondary: target.value_secondary,
  enabled: true,
});
check('admin updates threshold', thUpd.status === 200);
await send(`/admin/thresholds/${target.id}`, a.token, 'PUT', {
  operator: target.operator,
  valuePrimary: 140,
  valueSecondary: target.value_secondary,
  enabled: true,
});
const logs = await (await get('/admin/audit-logs', a.token)).json();
check('admin audit logs', logs.total >= 1, `${logs.total} entries`);

const adminDenied = await get('/admin/users', p.token);
check('role guard: patient blocked from admin (403)', adminDenied.status === 403);

const noTok = await fetch(`${BASE}/dashboard`);
check('unauthenticated request (401)', noTok.status === 401);

console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL'));
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
