const ReportModel = require('../models/report.model');
const SharingModel = require('../models/sharing.model');
const reportService = require('../services/reportService');
const { asyncHandler } = require('../middleware/auth');
const { audit } = require('../services/auditService');

/** POST /api/reports/generate — builds and stores a health report. */
const generate = asyncHandler(async (req, res) => {
  const { title, dateFrom, dateTo, parameters, language } = req.body;
  const generated = await reportService.generateAndStore({
    userId: req.user.id,
    title: title || `Health report ${dateFrom} – ${dateTo}`,
    dateFrom,
    dateTo,
    parameters,
    language: language === 'hi' ? 'hi' : 'en',
  });
  await audit(req, 'report.create', 'reports', generated.id, `${dateFrom}..${dateTo}`);
  res.status(201).json({ reportId: generated.id, ...generated });
});

/** GET /api/reports — my generated reports. */
const list = asyncHandler(async (req, res) => {
  const reports = await ReportModel.list(req.user.id);
  res.json({ reports });
});

/** GET /api/reports/:id — full data for rendering / PDF download. */
const detail = asyncHandler(async (req, res) => {
  const report = await ReportModel.find(req.params.id, req.user.id);
  if (!report) return res.status(404).json({ error: 'not_found', message: 'Report not found.' });
  const data = await reportService.buildReport({
    userId: req.user.id,
    dateFrom: report.date_from,
    dateTo: report.date_to,
    parameters: report.parameters,
    language: 'en',
  });
  res.json({ report, ...data });
});

/** DELETE /api/reports/:id */
const remove = asyncHandler(async (req, res) => {
  const affected = await ReportModel.remove(req.params.id, req.user.id);
  if (!affected) return res.status(404).json({ error: 'not_found', message: 'Report not found.' });
  await audit(req, 'report.delete', 'reports', req.params.id, 'report deleted');
  res.json({ message: 'Report deleted.' });
});

// --------------------------------------------------- medical document meta
const listDocuments = asyncHandler(async (req, res) => {
  const documents = await ReportModel.listDocuments(req.user.id);
  res.json({ documents });
});

const addDocument = asyncHandler(async (req, res) => {
  const { title, documentDate, filePath, mimeType, sizeBytes } = req.body;
  const id = await ReportModel.addDocument({
    userId: req.user.id,
    title,
    documentDate: documentDate ? documentDate.slice(0, 10) : null,
    filePath,
    mimeType,
    sizeBytes,
  });
  await audit(req, 'document.create', 'medical_documents', id, title);
  res.status(201).json({ id });
});

const removeDocument = asyncHandler(async (req, res) => {
  const affected = await ReportModel.removeDocument(req.params.id, req.user.id);
  if (!affected) return res.status(404).json({ error: 'not_found', message: 'Document not found.' });
  res.json({ message: 'Document deleted.' });
});

/**
 * GET /api/shared/reports/:id — caregiver/doctor view of a report that the
 * patient shared with the "report" permission.
 */
const sharedReport = asyncHandler(async (req, res) => {
  const report = await ReportModel.findAny(req.params.id);
  if (!report) return res.status(404).json({ error: 'not_found', message: 'Report not found.' });
  const permission = await SharingModel.activePermission(report.user_id, req.user.id, 'report');
  if (!permission) {
    return res.status(403).json({ error: 'forbidden', message: 'The patient has not shared this report with you.' });
  }
  const data = await reportService.buildReport({
    userId: report.user_id,
    dateFrom: report.date_from,
    dateTo: report.date_to,
    parameters: report.parameters,
    language: 'en',
  });
  res.json({ report, ...data });
});

module.exports = { generate, list, detail, remove, listDocuments, addDocument, removeDocument, sharedReport };
