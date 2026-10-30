const ReadingModel = require('../models/reading.model');
const AlertModel = require('../models/alert.model');
const ReportModel = require('../models/report.model');
const { statusFor } = require('./alertEngine');

/**
 * Builds the data behind a health report:
 * date range + selected parameters + trend series + summary statistics +
 * alerts summary. The report row is stored in MySQL and rendered by the
 * frontend (which can download it as a PDF).
 */
async function buildReport({ userId, dateFrom, dateTo, parameters, language = 'en' }) {
  const codes = parameters && parameters.length ? parameters : null;

  const summaryRows = await ReadingModel.summary({ userId, from: dateFrom, to: `${dateTo} 23:59:59` });
  const thresholds = await AlertModel.getEnabledThresholds();

  const selected = codes ? summaryRows.filter((r) => codes.includes(r.code)) : summaryRows;

  const stats = {};
  selected.forEach((r) => {
    stats[r.code] =
      r.value_kind === 'bp'
        ? { avg: `${r.avg_sys}/${r.avg_dia}`, min: `${r.min_sys}/${r.min_dia}`, max: `${r.max_sys}/${r.max_dia}`, count: Number(r.count), unit: 'mmHg' }
        : { avg: r.avg_value, min: r.min_value, max: r.max_value, count: Number(r.count), unit: r.unit };
  });

  const series = {};
  for (const row of selected) {
    const points = await ReadingModel.series({
      userId,
      code: row.code,
      from: dateFrom,
      to: `${dateTo} 23:59:59`,
    });
    series[row.code] = points.map((p) => ({
      t: p.measured_at,
      v: row.value_kind === 'bp' ? [Number(p.systolic), Number(p.diastolic)] : Number(p.value),
      status: statusFor(row.value_kind === 'bp' ? { systolic: p.systolic, diastolic: p.diastolic } : { value: p.value }, thresholds[row.code] || []),
    }));
  }

  const alertRows = await AlertModel.listAlerts({ userId, limit: 100 });
  const inRange = alertRows.rows.filter((a) => {
    const d = new Date(a.created_at);
    return d >= new Date(dateFrom) && d <= new Date(`${dateTo} 23:59:59`);
  });

  const disclaimer =
    language === 'hi'
      ? 'यह रिपोर्ट आपके दर्ज आँकड़ों का सारांश है। यह चिकित्सकीय सलाह नहीं है। कृपया किसी योग्य डॉक्टर से परामर्श लें।'
      : 'This report summarises the values you recorded. This is not medical advice. Consult a qualified doctor.';

  const summaryText =
    language === 'hi'
      ? `${dateFrom} से ${dateTo} तक ${selected.length} पैरामीटर, कुल ${selected.reduce((s, r) => s + Number(r.count), 0)} रीडिंग और ${inRange.length} अलर्ट। ${disclaimer}`
      : `${selected.length} parameters, ${selected.reduce((s, r) => s + Number(r.count), 0)} readings and ${inRange.length} alerts between ${dateFrom} and ${dateTo}. ${disclaimer}`;

  return { stats, series, alerts: inRange, alertCount: inRange.length, summaryText, disclaimer };
}

/** Persist the built report and return the stored row. */
async function generateAndStore({ userId, title, dateFrom, dateTo, parameters, language }) {
  const data = await buildReport({ userId, dateFrom, dateTo, parameters, language });
  const id = await ReportModel.create({
    userId,
    title,
    dateFrom,
    dateTo,
    parameters: parameters && parameters.length ? parameters : Object.keys(data.stats),
    avgValues: data.stats,
    alertCount: data.alertCount,
    summaryText: data.summaryText,
  });
  return { id, ...data, title, dateFrom, dateTo, parameters: parameters || Object.keys(data.stats) };
}

module.exports = { buildReport, generateAndStore };
