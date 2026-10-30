/**
 * Unit tests for the rule-based alert engine (pure functions, no database).
 * Run: npm test
 */
const test = require('node:test');
const assert = require('node:assert');
const {
  matchThreshold,
  evaluateReading,
  isAbnormal,
  findTrendAlerts,
  statusFor,
  formatReading,
} = require('../src/services/alertEngine');

/** Mirrors the default thresholds from database/schema + seed.sql. */
const BP = [
  { severity: 'critical', operator: 'bp_and_gte', value_primary: 180, value_secondary: 120, enabled: 1 },
  { severity: 'warning', operator: 'bp_or_gte', value_primary: 140, value_secondary: 90, enabled: 1 },
  { severity: 'low', operator: 'bp_or_lte', value_primary: 90, value_secondary: 60, enabled: 1 },
];
const SPO2 = [
  { severity: 'critical', operator: 'lt', value_primary: 90, enabled: 1 },
  { severity: 'warning', operator: 'lt', value_primary: 95, enabled: 1 },
];
const HR = [
  { severity: 'warning', operator: 'gt', value_primary: 100, enabled: 1 },
  { severity: 'low', operator: 'lt', value_primary: 50, enabled: 1 },
];
const GLUCOSE = [
  { severity: 'warning', operator: 'gt', value_primary: 125, enabled: 1 },
  { severity: 'low', operator: 'lt', value_primary: 70, enabled: 1 },
];
const TEMP = [{ severity: 'warning', operator: 'gte', value_primary: 100.4, enabled: 1 }];

test('matchThreshold handles every operator used by the rule set', () => {
  assert.equal(matchThreshold(BP[0], { systolic: 184, diastolic: 121 }), true);
  assert.equal(matchThreshold(BP[0], { systolic: 184, diastolic: 100 }), false, 'AND operator needs both values');
  assert.equal(matchThreshold(BP[1], { systolic: 130, diastolic: 95 }), true, 'OR operator matches on diastolic');
  assert.equal(matchThreshold(BP[2], { systolic: 88, diastolic: 58 }), true);
  assert.equal(matchThreshold(SPO2[1], { value: 94 }), true);
  assert.equal(matchThreshold(HR[0], { value: 104 }), true);
  assert.equal(matchThreshold(GLUCOSE[1], { value: 64 }), true);
  assert.equal(matchThreshold(TEMP[0], { value: 100.6 }), true);
  assert.equal(matchThreshold(TEMP[0], { value: 98.6 }), false);
});

test('evaluateReading returns the most severe matching rule', () => {
  assert.equal(evaluateReading({ systolic: 190, diastolic: 125 }, BP).severity, 'critical');
  assert.equal(evaluateReading({ systolic: 150, diastolic: 94 }, BP).severity, 'warning');
  assert.equal(evaluateReading({ systolic: 88, diastolic: 58 }, BP).severity, 'low');
  assert.equal(evaluateReading({ systolic: 120, diastolic: 80 }, BP), null, 'normal BP raises no alert');
});

test('severity precedence: critical beats warning', () => {
  const rule = evaluateReading({ systolic: 185, diastolic: 126 }, BP);
  assert.equal(rule.severity, 'critical');
  // A high-reading that is not high on BOTH numbers stays a warning.
  assert.equal(evaluateReading({ systolic: 185, diastolic: 100 }, BP).severity, 'warning');
});

test('SpO2 / heart rate / glucose / temperature defaults', () => {
  assert.equal(evaluateReading({ value: 89 }, SPO2).severity, 'critical');
  assert.equal(evaluateReading({ value: 94 }, SPO2).severity, 'warning');
  assert.equal(evaluateReading({ value: 98 }, SPO2), null);

  assert.equal(evaluateReading({ value: 104 }, HR).severity, 'warning');
  assert.equal(evaluateReading({ value: 48 }, HR).severity, 'low');
  assert.equal(evaluateReading({ value: 72 }, HR), null);

  assert.equal(evaluateReading({ value: 132 }, GLUCOSE).severity, 'warning');
  assert.equal(evaluateReading({ value: 64 }, GLUCOSE).severity, 'low');
  assert.equal(evaluateReading({ value: 100 }, GLUCOSE), null);

  assert.equal(evaluateReading({ value: 100.4 }, TEMP).severity, 'warning');
  assert.equal(evaluateReading({ value: 98.6 }, TEMP), null);
});

test('disabled thresholds are ignored', () => {
  const disabled = BP.map((r) => ({ ...r, enabled: 0 }));
  assert.equal(evaluateReading({ systolic: 190, diastolic: 130 }, disabled), null);
  assert.equal(isAbnormal({ systolic: 190, diastolic: 130 }, disabled), false);
});

test('statusFor maps rules to normal / warning / critical colours', () => {
  assert.equal(statusFor({ systolic: 120, diastolic: 80 }, BP), 'normal');
  assert.equal(statusFor({ systolic: 150, diastolic: 95 }, BP), 'warning');
  assert.equal(statusFor({ systolic: 190, diastolic: 130 }, BP), 'critical');
  assert.equal(statusFor({ value: 94 }, SPO2), 'warning');
});

test('formatReading renders bilingual friendly values', () => {
  assert.equal(formatReading('bp', { systolic: 145, diastolic: 92 }), '145/92 mmHg');
  assert.equal(formatReading('spo2', { value: 96, unit: '%' }), '96 %');
});

test('trend rule: three consecutive rising BP readings', () => {
  const rising = [
    { systolic: 163, diastolic: 108, measured_at: '2026-10-29 08:00:00' }, // newest
    { systolic: 155, diastolic: 102, measured_at: '2026-10-28 08:00:00' },
    { systolic: 148, diastolic: 98, measured_at: '2026-10-27 08:00:00' },
  ];
  const alerts = findTrendAlerts({ code: 'bp', readings: rising, thresholdRows: BP });
  const risingAlert = alerts.find((a) => /Rising blood pressure/.test(a.titleEn));
  assert.ok(risingAlert, 'rising trend alert expected');
  assert.equal(risingAlert.kind, 'trend');
  assert.match(risingAlert.messageEn, /consult a qualified doctor/i);

  const falling = [
    { systolic: 130, diastolic: 86, measured_at: '2026-10-29 08:00:00' },
    { systolic: 140, diastolic: 92, measured_at: '2026-10-28 08:00:00' },
    { systolic: 150, diastolic: 98, measured_at: '2026-10-27 08:00:00' },
  ];
  assert.equal(findTrendAlerts({ code: 'bp', readings: falling, thresholdRows: BP }).length, 0);
});

test('trend rule: abnormal values on three consecutive days', () => {
  const readings = [
    { value: 134, measured_at: '2026-10-29 07:00:00' },
    { value: 131, measured_at: '2026-10-28 07:00:00' },
    { value: 128, measured_at: '2026-10-27 07:00:00' },
  ];
  const alerts = findTrendAlerts({ code: 'glucose', readings, thresholdRows: GLUCOSE });
  assert.equal(alerts.length, 1);
  assert.match(alerts[0].titleEn, /three consecutive days/i);

  const normal = [
    { value: 100, measured_at: '2026-10-29 07:00:00' },
    { value: 102, measured_at: '2026-10-28 07:00:00' },
    { value: 99, measured_at: '2026-10-27 07:00:00' },
  ];
  assert.equal(findTrendAlerts({ code: 'glucose', readings: normal, thresholdRows: GLUCOSE }).length, 0);
});

test('trend alert copy never diagnoses (English and Hindi)', () => {
  const readings = [
    { systolic: 163, diastolic: 108, measured_at: '2026-10-29 08:00:00' },
    { systolic: 155, diastolic: 102, measured_at: '2026-10-28 08:00:00' },
    { systolic: 148, diastolic: 98, measured_at: '2026-10-27 08:00:00' },
  ];
  const [alert] = findTrendAlerts({ code: 'bp', readings, thresholdRows: BP });
  assert.ok(alert);
  assert.match(alert.messageHi, /डॉक्टर से परामर्श/);
  assert.match(alert.messageHi, /चिकित्सकीय सलाह नहीं/);
  assert.doesNotMatch(alert.messageEn, /\b(has|have) (hypertension|diabetes|fever)\b/i);
});
