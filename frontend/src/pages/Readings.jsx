import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, formatDate, toLocalInput } from '../api/client';
import Disclaimer from '../components/Disclaimer';
import Spinner from '../components/Spinner';

const EMPTY = { parameter: 'bp', measuredAt: toLocalInput(), systolic: '', diastolic: '', pulse: '', value: '', notes: '' };

/** Health records: add / edit / delete / list readings with range validation. */
export default function Readings() {
  const { t } = useTranslation();
  const [params, setParams] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const limit = 15;

  const load = useCallback(async () => {
    const qs = `?page=${page}&limit=${limit}${filter ? `&parameter=${filter}` : ''}`;
    const res = await api.get(`/readings${qs}`);
    setRows(res.readings);
    setTotal(res.total);
  }, [page, filter]);

  useEffect(() => {
    api.get('/parameters').then((r) => setParams(r.parameters || [])).catch(() => setParams([]));
  }, []);

  useEffect(() => {
    load().catch(() => setError(t('common.networkError')));
  }, [load, t]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const current = params.find((p) => p.code === form.parameter);

  const reset = () => {
    setForm(EMPTY);
    setEditingId(null);
    setError('');
  };

  const validate = () => {
    if (!form.parameter) return t('records.validation.parameter');
    if (!form.measuredAt) return t('records.validation.date');
    if (current?.value_kind === 'bp') {
      const s = Number(form.systolic);
      const d = Number(form.diastolic);
      if (!form.systolic || !form.diastolic) return t('records.validation.value');
      if (s < 50 || s > 300) return t('records.validation.systolic');
      if (d < 30 || d > 200) return t('records.validation.diastolic');
      if (d >= s) return t('records.validation.bpOrder');
    } else {
      if (form.value === '') return t('records.validation.value');
      const v = Number(form.value);
      const min = current?.min_valid == null ? -Infinity : Number(current.min_valid);
      const max = current?.max_valid == null ? Infinity : Number(current.max_valid);
      if (Number.isNaN(v) || v < min || v > max) return t('records.validation.range');
    }
    return '';
  };

  const submit = async (e) => {
    e.preventDefault();
    setNotice('');
    const problem = validate();
    if (problem) return setError(problem);
    setError('');
    setBusy(true);

    const payload = {
      parameter: form.parameter,
      measuredAt: form.measuredAt,
      notes: form.notes || null,
      systolic: current?.value_kind === 'bp' ? Number(form.systolic) : null,
      diastolic: current?.value_kind === 'bp' ? Number(form.diastolic) : null,
      pulse: form.pulse ? Number(form.pulse) : null,
      value: current?.value_kind === 'bp' ? null : Number(form.value),
    };

    try {
      if (editingId) {
        await api.put(`/readings/${editingId}`, payload);
        setNotice(t('records.readingUpdated'));
      } else {
        const res = await api.post('/readings', payload);
        setNotice(
          res.alerts?.length
            ? `${t('records.readingSaved')} ${t('records.newAlerts', { count: res.alerts.length })}`
            : t('records.readingSaved')
        );
      }
      reset();
      setPage(1);
      await load();
    } catch (err) {
      setError(err.message || t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const edit = (row) => {
    setEditingId(row.id);
    setError('');
    setNotice('');
    setForm({
      parameter: row.parameter,
      measuredAt: toLocalInput(row.measuredAt),
      systolic: row.systolic ?? '',
      diastolic: row.diastolic ?? '',
      pulse: row.pulse ?? '',
      value: row.value ?? '',
      notes: row.notes ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (id) => {
    if (!window.confirm(t('records.confirmDelete'))) return;
    try {
      await api.delete(`/readings/${id}`);
      setNotice(t('records.readingDeleted'));
      await load();
    } catch {
      setError(t('common.error'));
    }
  };

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800">{t('records.title')}</h1>
        <select className="input w-auto" value={filter} onChange={(e) => { setPage(1); setFilter(e.target.value); }}>
          <option value="">{t('common.all')}</option>
          {params.map((p) => (
            <option key={p.code} value={p.code}>{t(`parameters.${p.code}`)}</option>
          ))}
        </select>
      </div>

      <Disclaimer />

      {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p>}

      <form onSubmit={submit} className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <label className="label" htmlFor="parameter">{t('records.parameter')}</label>
          <select id="parameter" className="input" value={form.parameter} onChange={set('parameter')}>
            {params.map((p) => (
              <option key={p.code} value={p.code}>{t(`parameters.${p.code}`)} ({p.unit})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="measuredAt">{t('records.when')}</label>
          <input id="measuredAt" type="datetime-local" className="input" value={form.measuredAt} onChange={set('measuredAt')} />
        </div>

        {current?.value_kind === 'bp' ? (
          <>
            <div>
              <label className="label" htmlFor="systolic">{t('records.systolic')}</label>
              <input id="systolic" type="number" className="input" placeholder="120" value={form.systolic} onChange={set('systolic')} />
            </div>
            <div>
              <label className="label" htmlFor="diastolic">{t('records.diastolic')}</label>
              <input id="diastolic" type="number" className="input" placeholder="80" value={form.diastolic} onChange={set('diastolic')} />
            </div>
          </>
        ) : (
          <div>
            <label className="label" htmlFor="value">
              {t('records.readingValue')} ({current?.unit})
            </label>
            <input
              id="value"
              type="number"
              step="0.1"
              className="input"
              value={form.value}
              onChange={set('value')}
              min={current?.min_valid ?? undefined}
              max={current?.max_valid ?? undefined}
            />
          </div>
        )}

        <div>
          <label className="label" htmlFor="pulse">{t('records.pulse')}</label>
          <input id="pulse" type="number" className="input" value={form.pulse} onChange={set('pulse')} />
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="notes">{t('common.notes')}</label>
          <input id="notes" className="input" maxLength={500} value={form.notes} onChange={set('notes')} />
        </div>

        <div className="flex items-end gap-2">
          <button type="submit" className="btn-primary" disabled={busy}>
            {editingId ? t('common.save') : t('records.saveReading')}
          </button>
          {editingId && (
            <button type="button" className="btn-secondary" onClick={reset}>
              {t('common.cancel')}
            </button>
          )}
        </div>
      </form>

      <section className="card overflow-x-auto">
        {!params.length ? (
          <Spinner label={t('common.loading')} />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">{t('records.empty')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
                <th className="py-2">{t('records.when')}</th>
                <th className="py-2">{t('records.parameter')}</th>
                <th className="py-2">{t('common.value')}</th>
                <th className="py-2">{t('common.notes')}</th>
                <th className="py-2 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-2.5 whitespace-nowrap">{formatDate(r.measuredAt, true)}</td>
                  <td className="py-2.5 font-medium text-slate-600">{t(`parameters.${r.parameter}`)}</td>
                  <td className="py-2.5">
                    {r.valueKind === 'bp' ? `${r.systolic}/${r.diastolic}` : r.value}{' '}
                    <span className="text-xs text-slate-400">{r.unit}</span>
                  </td>
                  <td className="py-2.5 max-w-[16rem] truncate text-slate-500">{r.notes || '—'}</td>
                  <td className="py-2.5 text-right">
                    <button type="button" className="mr-3 text-brand-600 hover:underline" onClick={() => edit(r)}>
                      {t('common.edit')}
                    </button>
                    <button type="button" className="text-rose-600 hover:underline" onClick={() => remove(r.id)}>
                      {t('common.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {pages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ←
            </button>
            <span className="text-slate-500">{page} / {pages}</span>
            <button type="button" className="btn-secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
