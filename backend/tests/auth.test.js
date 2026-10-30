/**
 * Integration tests: authentication, role guards, language preference and
 * the add-reading -> alert flow. Requires a seeded MySQL database.
 * Run: npm test
 */
const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');

const stamp = Date.now();
const account = {
  fullName: 'Test Person',
  email: `test.user.${stamp}@example.com`,
  password: 'TestPass123',
};

let token = '';

test('health endpoint reports the database as up', async () => {
  const res = await request(app).get('/api/health').expect(200);
  assert.equal(res.body.status, 'ok');
  assert.equal(res.body.database, 'up');
});

test('register creates a patient account and returns a JWT', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ ...account, language: 'en' })
    .expect(201);
  assert.ok(res.body.token, 'token expected');
  assert.equal(res.body.user.role, 'patient');
  token = res.body.token;
});

test('register rejects a weak password', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ fullName: 'Weak', email: `weak.${stamp}@example.com`, password: 'abc' })
    .expect(400);
  assert.equal(res.body.error, 'validation_error');
});

test('login rejects wrong credentials', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: account.email, password: 'WrongPass123' })
    .expect(401);
  assert.equal(res.body.error, 'invalid_credentials');
});

test('login accepts the correct credentials', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: account.email, password: account.password })
    .expect(200);
  assert.ok(res.body.token);
  assert.equal(res.body.user.email, account.email);
  token = res.body.token;
});

test('requests without a token are rejected with 401', async () => {
  await request(app).get('/api/profile').expect(401);
  await request(app).get('/api/readings').expect(401);
});

test('language preference can be set after login and is returned by /me', async () => {
  await request(app)
    .put('/api/profile/language')
    .set('Authorization', `Bearer ${token}`)
    .send({ language: 'hi' })
    .expect(200);

  const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
  assert.equal(res.body.user.language, 'hi');

  await request(app)
    .put('/api/profile/language')
    .set('Authorization', `Bearer ${token}`)
    .send({ language: 'en' })
    .expect(200);
});

test('role guards block patients from the admin module', async () => {
  const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${token}`).expect(403);
  assert.equal(res.body.error, 'forbidden');
});

test('seeded demo accounts can log in (all four roles)', async () => {
  const demos = [
    ['priya.sharma@example.com', 'Patient@123', 'patient'],
    ['ramesh.family@example.com', 'Caregiver@123', 'caregiver'],
    ['dr.mehta@example.com', 'Doctor@123', 'doctor'],
    ['admin@healthguard.local', 'Admin@123', 'admin'],
  ];
  for (const [email, password, role] of demos) {
    const res = await request(app).post('/api/auth/login').send({ email, password }).expect(200);
    assert.equal(res.body.user.role, role, `role mismatch for ${email}`);
  }
});

test('a critical BP reading generates an in-app alert', async () => {
  const res = await request(app)
    .post('/api/readings')
    .set('Authorization', `Bearer ${token}`)
    .send({
      parameter: 'bp',
      measuredAt: new Date().toISOString(),
      systolic: 188,
      diastolic: 126,
      notes: 'unit test reading',
    })
    .expect(201);

  assert.ok(res.body.alerts.length >= 1, 'at least one alert expected');
  const critical = res.body.alerts.find((a) => a.severity === 'critical');
  assert.ok(critical, 'critical alert expected');
  assert.match(critical.messageEn, /consult a qualified doctor/i);
  assert.match(critical.messageHi, /डॉक्टर से परामर्श/);

  const alerts = await request(app)
    .get('/api/alerts?status=unread')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  assert.ok(alerts.body.total >= 1);

  const notifications = await request(app)
    .get('/api/notifications')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  assert.ok(notifications.body.unread >= 1, 'notification bell should be unread');
});

test('a normal reading generates no alert', async () => {
  const res = await request(app)
    .post('/api/readings')
    .set('Authorization', `Bearer ${token}`)
    .send({ parameter: 'bp', measuredAt: new Date().toISOString(), systolic: 118, diastolic: 78 })
    .expect(201);
  assert.equal(res.body.alerts.length, 0);
});

test('impossible values are rejected by validation', async () => {
  const res = await request(app)
    .post('/api/readings')
    .set('Authorization', `Bearer ${token}`)
    .send({ parameter: 'spo2', measuredAt: new Date().toISOString(), value: 150 })
    .expect(400);
  assert.ok(res.body.error === 'range_error' || res.body.error === 'validation_error');
});

test('dashboard returns cards with a status colour', async () => {
  const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`).expect(200);
  assert.ok(res.body.cards.length >= 1);
  const bp = res.body.cards.find((c) => c.parameter === 'bp');
  assert.ok(bp);
  assert.ok(['normal', 'warning', 'critical'].includes(bp.status));
  assert.ok(res.body.summary.length >= 1);
});
