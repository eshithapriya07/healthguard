import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, formatDate } from '../api/client';
import Disclaimer from '../components/Disclaimer';
import Spinner from '../components/Spinner';

const dayISO = (offset = 0) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

/**
 * Reports: generate a date-range health report (statistics + trend series +
 * alert summary) and download it as a PDF (browser print is the fallback).
 * Also manages optional medical document metadata.
 */
export default function Reports() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useState([]);
  const [reports, setReports] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({
    title: '',
    dateFrom: dayISO(-30),
    dateTo: dayISO(0),
    parameters: ['bp', 'spo2', 'heart_rate', 'glucose', 'temperature', 'weight'],
  });
  const [docForm, setDocForm] = useState({ title: '', documentDate: dayISO(0), filePath: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const printRef = useRef(null);

  const load = useCallback(async () => {
    const [p, r, d] = await Promise.all([api.get('/parameters'), api.get('/reports'), api.get('/documents')]);
    setParams(p.parameters || []);
    setReports(r.reports || []);
    setDocuments(d.documents || []);
  }, []);

  useEffect(() => {
    load().catch(() => setError(t('common.networkError')));
  }, [load, t]);

  const toggleParam = (code) =>
    setForm((f) => ({
      ...f,
      parameters: f.parameters.includes(code) ? f.parameters.filter((x) => x !== code) : [...f.parameters, code],
    }));

  const generate = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!form.dateFrom || !form.dateTo || form.dateFrom > form.dateTo) return setError(t('reports.validation.dates'));
    if (!form.parameters.length) return setError(t('reports.validation.parameters'));
    setBusy(true);
    try {
      const res = await api.post('/reports/generate', { ...form, title: form.title || undefined, language: i18n.language });
      setNotice(t('reports.generated'));
      await load();
      openReport(res.reportId);
    } catch (err) {
      setError(err.message || t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const openReport = async (id) => {
    const res = await api.get(`/reports/${id}`);
    setDetail(res);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (id) => {
    if (!window.confirm(t('records.confirmDelete'))) return;
    await api.delete(`/reports/${id}`);
    if (detail?.report?.id === id) setDetail(null);
    await load();
  };

  /** Real PDF download (html2canvas keeps Hindi text intact); print fallback. */
  const downloadPdf = async () => {
    const el = printRef.current;
    if (!el) return;
    setDownloading(true);
    try {
      const mod = await import('html2pdf.js');
      const html2pdf = mod.default || mod;
      await html2pdf()
        .set({
          margin: 8,
          filename: `healthguard-report-${detail.report.id}.pdf`,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(el)
        .save();
    } catch {
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  const addDocument = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/documents', docForm);
      setNotice(t('reports.docAdded'));
      setDocForm({ title: '', documentDate: dayISO(0), filePath: '' });
      await load();
    } catch (err) {
      setError(err.message || t('common.error'));
    }
  };

  const lang = i18n.language === 'hi' ? 'hi' : 'en';
  const fmt = (v) => (v == null ? '—' : typeof v === 'object' ? `${v.systolic}/${v.diastolic}` : v);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">{t('reports.title')}</h1>

      {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p>}

      <form onSubmit={generate} className="card space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <label className="label" htmlFor="title">{t('reports.reportTitle')}</label>
            <input id="title" className="input" maxLength={160} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="dateFrom">{t('reports.dateFrom')}</label>
            <input id="dateFrom" type="date" className="input" value={form.dateFrom} onChange={(e) => setForm({ ...form, dateFrom: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="dateTo">{t('reports.dateTo')}</label>
            <input id="dateTo" type="date" className="input" value={form.dateTo} onChange={(e) => setForm({ ...form, dateTo: e.target.value })} />
          </div>
        </div>

        <div>
          <span className="label">{t('reports.parameters')}</span>
          <div className="flex flex-wrap gap-3">
            {params.map((p) => (
              <label key={p.code} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <input type="checkbox" checked={form.parameters.includes(p.code)} onChange={() => toggleParam(p.code)} />
                {t(`parameters.${p.code}`)}
              </label>
            ))}
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? t('common.loading') : t('reports.generate')}
        </button>
      </form>

      {/* report detail / printable area */}
      {detail && (
        <section ref={printRef} className="print-area card space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-800">{detail.report.title}</h2>
              <p className="text-xs text-slate-500">
                {formatDate(detail.report.date_from)} → {formatDate(detail.report.date_to)} · {t('common.appName')}
              </p>
            </div>
            <div className="no-print flex gap-2">
              <button type="button" className="btn-primary" onClick={downloadPdf} disabled={downloading}>
                {downloading ? t('common.loading') : t('reports.downloadPdf')}
              </button>
              <button type="button" className="btn-secondary" onClick={() => window.print()}>{t('reports.print')}</button>
              <button type="button" className="btn-secondary" onClick={() => setDetail(null)}>{t('common.close')}</button>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-600">{t('reports.summary')}</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
                  <th className="py-2">{t('records.parameter')}</th>
                  <th className="py-2 text-right">{t('common.avg')}</th>
                  <th className="py-2 text-right">{t('common.min')}</th>
                  <th className="py-2 text-right">{t('common.max')}</th>
                  <th className="py-2 text-right">{t('common.count')}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(detail.stats || {}).map(([code, s]) => (
                  <tr key={code} className="border-b border-slate-50">
                    <td className="py-2 font-medium text-slate-600">{t(`parameters.${code}`)}</td>
                    <td className="py-2 text-right">{fmt(s.avg)}</td>
                    <td className="py-2 text-right">{fmt(s.min)}</td>
                    <td className="py-2 text-right">{fmt(s.max)}</td>
                    <td className="py-2 text-right">{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-600">
              {t('reports.alertsIncluded')} ({detail.alerts.length})
            </h3>
            {detail.alerts.length === 0 ? (
              <p className="text-sm text-slate-500">{t('dashboard.noAlerts')}</p>
            ) : (
              <ul className="space-y-2">
                {detail.alerts.map((a) => (
                  <li key={a.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span className="mr-2 font-semibold text-slate-700">{lang === 'hi' ? a.title_hi : a.title_en}</span>
                    <span className="text-slate-500">{lang === 'hi' ? a.message_hi : a.message_en}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-xs italic text-slate-500">{detail.summaryText}</p>
          <Disclaimer />
        </section>
      )}

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold text-slate-700">{t('reports.title')}</h2>
        {reports.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">{t('reports.empty')}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {reports.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <div className="text-sm font-semibold text-slate-700">{r.title}</div>
                  <div className="text-xs text-slate-500">
                    {formatDate(r.date_from)} → {formatDate(r.date_to)} · {r.alert_count} {t('nav.alerts')}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn-secondary" onClick={() => openReport(r.id)}>{t('common.view')}</button>
                  <button type="button" className="btn-danger" onClick={() => remove(r.id)}>{t('common.delete')}</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold text-slate-700">{t('reports.documents')}</h2>
        <form onSubmit={addDocument} className="grid gap-3 sm:grid-cols-4">
          <input
            className="input"
            placeholder={t('reports.docTitle')}
            required
            value={docForm.title}
            onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
          />
          <input
            className="input"
            type="date"
            value={docForm.documentDate}
            onChange={(e) => setDocForm({ ...docForm, documentDate: e.target.value })}
          />
          <input
            className="input"
            placeholder={t('reports.docPath')}
            required
            value={docForm.filePath}
            onChange={(e) => setDocForm({ ...docForm, filePath: e.target.value })}
          />
          <button type="submit" className="btn-secondary">{t('common.add')}</button>
        </form>

        {documents.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">{t('reports.docEmpty')}</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-2">
                <span className="font-medium text-slate-700">{d.title}</span>
                <span className="text-xs text-slate-500">{formatDate(d.document_date)} · {d.file_path}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
