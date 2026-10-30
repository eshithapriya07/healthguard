const AlertModel = require('../models/alert.model');
const ReadingModel = require('../models/reading.model');

/**
 * =====================================================================
 *  Rule-based early alert engine
 *  ------------------------------------------------------------------
 *  The pure functions below (matchThreshold, evaluateReading, isAbnormal,
 *  findTrendAlerts, formatReading) have no database access so they can be
 *  unit-tested in isolation. `processReading()` wraps them and persists
 *  the resulting alert + in-app notification.
 * =====================================================================
 */

const SEVERITY_ORDER = { critical: 0, warning: 1, low: 2 };

/** Evaluate one threshold row against one reading. */
function matchThreshold(rule, reading) {
  const p = Number(rule.value_primary);
  const s = rule.value_secondary == null ? null : Number(rule.value_secondary);
  switch (rule.operator) {
    case 'gte':
      return reading.value != null && Number(reading.value) >= p;
    case 'gt':
      return reading.value != null && Number(reading.value) > p;
    case 'lte':
      return reading.value != null && Number(reading.value) <= p;
    case 'lt':
      return reading.value != null && Number(reading.value) < p;
    case 'bp_or_gte':
      return reading.systolic != null && (Number(reading.systolic) >= p || Number(reading.diastolic) >= s);
    case 'bp_and_gte':
      return reading.systolic != null && Number(reading.systolic) >= p && Number(reading.diastolic) >= s;
    case 'bp_or_lte':
      return reading.systolic != null && (Number(reading.systolic) <= p || Number(reading.diastolic) <= s);
    default:
      return false;
  }
}

/**
 * Return the first matching threshold for a reading, ordered
 * critical -> warning -> low so the most severe rule wins.
 */
function evaluateReading(reading, thresholdRows = []) {
  const ordered = [...thresholdRows]
    .filter((r) => r.enabled !== 0 && r.enabled !== false)
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));
  for (const rule of ordered) {
    if (matchThreshold(rule, reading)) return rule;
  }
  return null;
}

/** True when the reading breaches any enabled rule for its parameter. */
function isAbnormal(reading, thresholdRows = []) {
  return evaluateReading(reading, thresholdRows) !== null;
}

/** Human readable value used inside alert messages, e.g. "145/92 mmHg". */
function formatReading(code, reading) {
  if (code === 'bp') return `${reading.systolic}/${reading.diastolic} mmHg`;
  const unit = reading.unit ? ` ${reading.unit}` : '';
  return `${reading.value}${unit}`;
}

/** Bilingual, deliberately cautious alert copy — never a diagnosis. */
function buildMessages({ code, nameEn, nameHi, severity, formatted }) {
  const consultEn = 'Please consult a qualified doctor.';
  const consultHi = 'कृपया किसी योग्य डॉक्टर से परामर्श लें।';

  const copy = {
    bp: {
      critical: {
        en: `Your blood pressure reading (${formatted}) is significantly outside the usual range. ${consultEn} This is not medical advice.`,
        hi: `आपका रक्तचाप (${formatted}) सामान्य सीमा से काफ़ बाहर है। ${consultHi} यह चिकित्सकीय सलाह नहीं है।`,
      },
      warning: {
        en: `Your blood pressure reading (${formatted}) is higher than the usual range. ${consultEn}`,
        hi: `आपका रक्तचाप (${formatted}) सामान्य सीमा से अधिक है। ${consultHi}`,
      },
      low: {
        en: `Your blood pressure reading (${formatted}) is lower than the usual range. ${consultEn}`,
        hi: `आपका रक्तचाप (${formatted}) सामान्य सीमा से कम है। ${consultHi}`,
      },
    },
    spo2: {
      critical: {
        en: `Your SpO2 reading (${formatted}) is below the usual range. ${consultEn} Seek urgent medical help if you feel unwell.`,
        hi: `आपका SpO2 (${formatted}) सामान्य सीमा से नीचे है। ${consultHi} तबीयत बिगड़ने पर तुरंत चिकित्सकीय सहायता लें।`,
      },
      warning: {
        en: `Your SpO2 reading (${formatted}) is slightly below the usual range. ${consultEn}`,
        hi: `आपका SpO2 (${formatted}) सामान्य सीमा से थोड़ा नीचे है। ${consultHi}`,
      },
      low: {
        en: `Your SpO2 reading (${formatted}) is below the usual range. ${consultEn}`,
        hi: `आपका SpO2 (${formatted}) सामान्य सीमा से नीचे है। ${consultHi}`,
      },
    },
    heart_rate: {
      warning: {
        en: `Your heart rate reading (${formatted}) is outside the usual resting range. ${consultEn}`,
        hi: `आपकी हृदय गति (${formatted}) सामान्य आराम की सीमा से बाहर है। ${consultHi}`,
      },
      critical: {
        en: `Your heart rate reading (${formatted}) is far outside the usual resting range. ${consultEn}`,
        hi: `आपकी हृदय गति (${formatted}) सामान्य सीमा से काफ़ बाहर है। ${consultHi}`,
      },
      low: {
        en: `Your heart rate reading (${formatted}) is lower than the usual resting range. ${consultEn}`,
        hi: `आपकी हृदय गति (${formatted}) सामान्य सीमा से कम है। ${consultHi}`,
      },
    },
    glucose: {
      warning: {
        en: `Your blood glucose reading (${formatted}) is higher than the usual range. ${consultEn}`,
        hi: `आपका रक्त शर्करा (${formatted}) सामान्य सीमा से अधिक है। ${consultHi}`,
      },
      low: {
        en: `Your blood glucose reading (${formatted}) is lower than the usual range. ${consultEn}`,
        hi: `आपका रक्त शर्करा (${formatted}) सामान्य सीमा से कम है। ${consultHi}`,
      },
      critical: {
        en: `Your blood glucose reading (${formatted}) is far outside the usual range. ${consultEn}`,
        hi: `आपका रक्त शर्करा (${formatted}) सामान्य सीमा से काफ़ बाहर है। ${consultHi}`,
      },
    },
    temperature: {
      warning: {
        en: `Your body temperature reading (${formatted}) is higher than usual. ${consultEn}`,
        hi: `आपका शरीर का तापमान (${formatted}) सामान्य से अधिक है। ${consultHi}`,
      },
      critical: {
        en: `Your body temperature reading (${formatted}) is significantly higher than usual. ${consultEn}`,
        hi: `आपका शरीर का तापमान (${formatted}) सामान्य से काफ़ अधिक है। ${consultHi}`,
      },
      low: {
        en: `Your body temperature reading (${formatted}) is lower than usual. ${consultEn}`,
        hi: `आपका शरीर का तापमान (${formatted}) सामान्य से कम है। ${consultHi}`,
      },
    },
    weight: {
      warning: {
        en: `Your weight reading (${formatted}) changed more than expected. ${consultEn}`,
        hi: `आपके वज़न (${formatted}) में अपेक्षा से अधिक बदलाव हुआ है। ${consultHi}`,
      },
      critical: { en: '', hi: '' },
      low: { en: '', hi: '' },
    },
  };

  const entry = (copy[code] && copy[code][severity]) || null;
  const name = `${nameEn}/${nameHi}`;
  const fallback = {
    en: `Your ${name} reading (${formatted}) is outside the usual range. ${consultEn}`,
    hi: `${nameHi} रीडिंग (${formatted}) सामान्य सीमा से बाहर है। ${consultHi}`,
  };
  const title = {
    en: `${nameEn} ${severity === 'low' ? 'below' : 'outside'} usual range`,
    hi: `${nameHi} सामान्य सीमा से बाहर`,
  };
  return {
    messageEn: (entry && entry.en) || fallback.en,
    messageHi: (entry && entry.hi) || fallback.hi,
    titleEn: title.en,
    titleHi: title.hi,
    nameEn,
    nameHi,
  };
}

/**
 * Trend rules (early warning):
 *  1. three consecutive rising BP readings
 *  2. three consecutive calendar days with at least one abnormal value
 * `readings` must be newest-first.
 */
function findTrendAlerts({ code, readings = [], thresholdRows = [] }) {
  const found = [];

  if (code === 'bp') {
    const last3 = readings.slice(0, 3);
    if (last3.length === 3) {
      const [r1, r2, r3] = last3; // newest first
      const rising =
        Number(r3.systolic) < Number(r2.systolic) &&
        Number(r2.systolic) < Number(r1.systolic) &&
        Number(r3.diastolic) < Number(r2.diastolic) &&
        Number(r2.diastolic) < Number(r1.diastolic);
      if (rising) {
        found.push({
          kind: 'trend',
          severity: 'trend',
          titleEn: 'Rising blood pressure trend detected',
          titleHi: 'बढ़ते रक्तचाप का रुझान मिला',
          messageEn:
            'Your last three blood pressure readings have been rising steadily. Please review your readings and consult a qualified doctor. This is not medical advice.',
          messageHi:
            'आपकी पिछली तीन रक्तचाप रीडिंग लगातार बढ़ रही हैं। कृपया अपनी रीडिंग देखें और किसी योग्य डॉक्टर से परामर्श लें। यह चिकित्सकीय सलाह नहीं है।',
        });
      }
    }
  }

  // three consecutive days with an abnormal value
  const byDay = new Map();
  readings.forEach((r) => {
    const day = new Date(r.measured_at).toISOString().slice(0, 10);
    const abnormal = isAbnormal(r, thresholdRows);
    if (abnormal) byDay.set(day, true);
  });
  const days = [...byDay.keys()].sort().reverse();
  if (days.length >= 3) {
    const d0 = new Date(days[0]);
    const d1 = new Date(days[0]);
    d1.setDate(d1.getDate() - 1);
    const d2 = new Date(days[0]);
    d2.setDate(d2.getDate() - 2);
    const iso = (d) => d.toISOString().slice(0, 10);
    if (byDay.get(iso(d1)) && byDay.get(iso(d2))) {
      found.push({
        kind: 'trend',
        severity: 'trend',
        titleEn: 'Abnormal values on three consecutive days',
        titleHi: 'लगातार तीन दिन असामान्य मान',
        messageEn:
          'At least one of your readings was outside the usual range on three consecutive days. Please keep monitoring and consult a qualified doctor. This is not medical advice.',
        messageHi:
          'पिछले तीन दिनों से आपकी कम से कम एक रीडिंग सामान्य सीमा से बाहर है। कृपया निगरानी जारी रखें और किसी योग्य डॉक्टर से परामर्श लें। यह चिकित्सकीय सलाह नहीं है।',
      });
    }
  }
  return found;
}

/** Status colour for the dashboard cards: normal / warning / critical. */
function statusFor(reading, thresholdRows = []) {
  const rule = evaluateReading(reading, thresholdRows);
  if (!rule) return 'normal';
  if (rule.severity === 'critical') return 'critical';
  return 'warning';
}

/**
 * Persist alerts for a freshly saved reading (threshold rule + trend rules)
 * and mirror them into the notification bell.
 */
async function processReading({ user, reading, parameter }) {
  const thresholdsByCode = await AlertModel.getEnabledThresholds();
  const rows = thresholdsByCode[parameter.code] || [];
  const created = [];

  const matched = evaluateReading(reading, rows);
  if (matched) {
    const formatted = formatReading(parameter.code, { ...reading, unit: parameter.unit });
    const copy = buildMessages({
      code: parameter.code,
      nameEn: parameter.name_en,
      nameHi: parameter.name_hi,
      severity: matched.severity,
      formatted,
    });
    const id = await AlertModel.insertAlert({
      userId: user.id,
      readingId: reading.id,
      parameterId: parameter.id,
      severity: matched.severity === 'low' ? 'low' : matched.severity,
      kind: 'threshold',
      ...copy,
    });
    await AlertModel.insertNotification({
      userId: user.id,
      type: 'alert',
      refId: id,
      titleEn: copy.titleEn,
      titleHi: copy.titleHi,
      bodyEn: copy.messageEn,
      bodyHi: copy.messageHi,
    });
    created.push({ id, severity: matched.severity, ...copy });
  }

  if (parameter.has_trend) {
    const recent = await ReadingModel.recentForTrend(user.id, parameter.code, 10);
    const trendCopy = findTrendAlerts({ code: parameter.code, readings: recent, thresholdRows: rows });
    for (const t of trendCopy) {
      const id = await AlertModel.insertAlert({
        userId: user.id,
        readingId: reading.id,
        parameterId: parameter.id,
        severity: t.severity,
        kind: t.kind,
        titleEn: t.titleEn,
        titleHi: t.titleHi,
        messageEn: t.messageEn,
        messageHi: t.messageHi,
      });
      await AlertModel.insertNotification({
        userId: user.id,
        type: 'alert',
        refId: id,
        titleEn: t.titleEn,
        titleHi: t.titleHi,
        bodyEn: t.messageEn,
        bodyHi: t.messageHi,
      });
      created.push({ id, severity: t.severity, titleEn: t.titleEn, titleHi: t.titleHi });
    }
  }

  return created;
}

module.exports = {
  matchThreshold,
  evaluateReading,
  isAbnormal,
  formatReading,
  buildMessages,
  findTrendAlerts,
  statusFor,
  processReading,
};
