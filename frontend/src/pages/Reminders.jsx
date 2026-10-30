import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, formatDate, toLocalInput } from '../api/client';
import Spinner from '../components/Spinner';

const EMPTY = { type: 'medication', title: '', notes: '', scheduledAt: toLocalInput(), recurrence: 'once' };

/** Reminders: medication / appointment / measurement with done & snooze. */
export default function Reminders() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/reminders');
      setRows(res.reminders || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) return setError(t('reminders.validation.title'));
    if (!form.scheduledAt) return setError(t('reminders.validation.date'));
    setBusy(true);
    try {
      await api.post('/reminders', { ...form, notes: form.notes || null });
      setNotice(t('common.saved'));
      setForm(EMPTY);
      await load();
    } catch (err) {
      setError(err.message || t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const act = async (id, action) => {
    if (action === 'delete' && !window.confirm(t('records.confirmDelete'))) return;
    try {
      if (action === 'delete') await api.delete(`/reminders/${id}`);
      else await api.post(`/reminders/${id}/${action}`, {});
      await load();
    } catch {
      setError(t('common.error'));
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">{t('reminders.title')}</h1>

      {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p>}

      <form onSubmit={submit} className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="label" htmlFor="type">{t('reminders.type')}</label>
          <select id="type" className="input" value={form.type} onChange={set('type')}>
            {['medication', 'appointment', 'measurement', 'other'].map((v) => (
              <option key={v} value={v}>{t(`reminders.types.${v}`)}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-1 lg:col-span-2">
          <label className="label" htmlFor="title">{t('reminders.reminderTitle')}</label>
          <input id="title" className="input" maxLength={160} value={form.title} onChange={set('title')} />
        </div>
        <div>
          <label className="label" htmlFor="scheduledAt">{t('reminders.scheduledAt')}</label>
          <input id="scheduledAt" type="datetime-local" className="input" value={form.scheduledAt} onChange={set('scheduledAt')} />
        </div>
        <div>
          <label className="label" htmlFor="recurrence">{t('reminders.recurrence')}</label>
          <select id="recurrence" className="input" value={form.recurrence} onChange={set('recurrence')}>
            {['once', 'daily', 'weekly'].map((v) => (
              <option key={v} value={v}>{t(`reminders.recurrences.${v}`)}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <label className="label" htmlFor="notes">{t('common.notes')}</label>
          <input id="notes" className="input" maxLength={500} value={form.notes} onChange={set('notes')} />
        </div>
        <div className="flex items-end">
          <button type="submit" className="btn-primary w-full" disabled={busy}>{t('reminders.save')}</button>
        </div>
      </form>

      <section className="card">
        {loading ? (
          <Spinner label={t('common.loading')} />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">{t('reminders.empty')}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">{r.title}</span>
                    <span className={`badge-${r.status === 'done' ? 'normal' : r.status === 'snoozed' ? 'warning' : 'info'}`}>
                      {t(`reminders.statuses.${r.status}`)}
                    </span>
                    <span className="badge-info">{t(`reminders.recurrences.${r.recurrence}`)}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {t(`reminders.types.${r.type}`)} · {formatDate(r.scheduled_at, true)} · {r.notes || t('common.none')}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.status !== 'done' && (
                    <button type="button" className="btn-secondary" onClick={() => act(r.id, 'done')}>{t('reminders.done')}</button>
                  )}
                  {(r.status === 'scheduled' || r.status === 'triggered' || r.status === 'snoozed') && (
                    <button type="button" className="btn-secondary" onClick={() => act(r.id, 'snooze')}>{t('reminders.snooze')}</button>
                  )}
                  <button type="button" className="btn-danger" onClick={() => act(r.id, 'delete')}>{t('common.delete')}</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
