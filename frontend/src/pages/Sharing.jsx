import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, formatDate } from '../api/client';
import Disclaimer from '../components/Disclaimer';
import Spinner from '../components/Spinner';

const ITEMS = ['bp', 'spo2', 'heart_rate', 'glucose', 'temperature', 'weight', 'report', 'alerts'];

/** Controlled sharing: the patient picks exactly what to share, with whom and for how long. */
export default function Sharing() {
  const { t } = useTranslation();
  const [shares, setShares] = useState([]);
  const [form, setForm] = useState({ email: '', items: ['bp'], expiresInDays: '', note: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/shares');
      setShares(res.shares || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (item) =>
    setForm((f) => ({
      ...f,
      items: f.items.includes(item) ? f.items.filter((x) => x !== item) : [...f.items, item],
    }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) return setError(t('sharing.validation.email'));
    if (!form.items.length) return setError(t('sharing.validation.items'));
    setBusy(true);
    try {
      await api.post('/shares', {
        email: form.email,
        items: form.items,
        expiresInDays: form.expiresInDays ? Number(form.expiresInDays) : null,
        note: form.note || null,
      });
      setNotice(t('sharing.shared'));
      setForm({ email: '', items: ['bp'], expiresInDays: '', note: '' });
      await load();
    } catch (err) {
      if (err.status === 404) setError(t('sharing.notFound'));
      else if (err.status === 400 && err.code === 'invalid_role') setError(t('sharing.validation.role'));
      else setError(err.message || t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id) => {
    if (!window.confirm(t('sharing.revokeConfirm'))) return;
    try {
      await api.delete(`/shares/${id}`);
      setNotice(t('sharing.revoked'));
      await load();
    } catch {
      setError(t('common.error'));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{t('sharing.title')}</h1>
        <p className="text-sm text-slate-500">{t('sharing.subtitle')}</p>
      </div>

      <Disclaimer />

      {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p>}

      <form onSubmit={submit} className="card space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="email">{t('sharing.email')}</label>
            <input
              id="email"
              type="email"
              className="input"
              required
              placeholder="caregiver@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="expires">{t('sharing.expiresInDays')}</label>
            <input
              id="expires"
              type="number"
              min="1"
              max="3650"
              className="input"
              placeholder={t('sharing.noExpiry')}
              value={form.expiresInDays}
              onChange={(e) => setForm({ ...form, expiresInDays: e.target.value })}
            />
          </div>
        </div>

        <div>
          <span className="label">{t('sharing.items')}</span>
          <div className="flex flex-wrap gap-3">
            {ITEMS.map((item) => (
              <label key={item} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <input type="checkbox" checked={form.items.includes(item)} onChange={() => toggle(item)} />
                {t(`sharing.itemsList.${item}`)}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="note">{t('sharing.note')}</label>
          <input id="note" className="input" maxLength={255} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </div>

        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? t('common.loading') : t('sharing.shareBtn')}
        </button>
      </form>

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold text-slate-700">{t('sharing.activeShares')}</h2>
        {loading ? (
          <Spinner label={t('common.loading')} />
        ) : shares.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">{t('sharing.empty')}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {shares.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">{s.granteeName}</span>
                    <span className="badge-info">{t(`admin.roles.${s.granteeRole}`)}</span>
                    <span className={`badge-${s.status === 'active' ? 'normal' : s.status === 'expired' ? 'warning' : 'critical'}`}>
                      {t(`sharing.statuses.${s.status}`)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {s.granteeEmail} · {s.items.map((i) => t(`sharing.itemsList.${i}`)).join(', ')}
                  </div>
                  <div className="text-xs text-slate-400">
                    {t('sharing.expires')}: {s.expiresAt ? formatDate(s.expiresAt, true) : t('sharing.never')}
                  </div>
                </div>
                {s.status === 'active' && (
                  <button type="button" className="btn-danger" onClick={() => revoke(s.id)}>
                    {t('common.revoke')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
