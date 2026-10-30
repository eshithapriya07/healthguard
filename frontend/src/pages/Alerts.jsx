import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, formatDate } from '../api/client';
import Disclaimer from '../components/Disclaimer';
import Spinner from '../components/Spinner';

const FILTERS = ['unread', 'read', 'resolved', ''];

/** Alerts page: rule-based early alerts with severity, status and actions. */
export default function Alerts() {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState('unread');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = `?page=${page}&limit=${limit}${filter ? `&status=${filter}` : ''}`;
      const res = await api.get(`/alerts${qs}`);
      setRows(res.rows || []);
      setTotal(res.total || 0);
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id, status) => {
    await api.patch(`/alerts/${id}/status`, { status });
    await load();
  };

  const lang = i18n.language === 'hi' ? 'hi' : 'en';
  const pages = Math.max(1, Math.ceil(total / limit));

  const severityBadge = (severity) => {
    if (severity === 'critical') return 'badge-critical';
    if (severity === 'warning') return 'badge-warning';
    if (severity === 'low') return 'badge-info';
    return 'badge-info';
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">{t('alerts.title')}</h1>
      <Disclaimer />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const key = f === '' ? 'filterAll' : f === 'unread' ? 'filterUnread' : f === 'read' ? 'filterRead' : 'filterResolved';
          return (
            <button
              key={f || 'all'}
              type="button"
              onClick={() => {
                setPage(1);
                setFilter(f);
              }}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                filter === f ? 'bg-brand-600 text-white' : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t(`alerts.${key}`)}
            </button>
          );
        })}
      </div>

      {loading ? (
        <Spinner label={t('common.loading')} />
      ) : rows.length === 0 ? (
        <div className="card text-sm text-slate-500">{t('alerts.empty')}</div>
      ) : (
        <ul className="space-y-3">
          {rows.map((a) => (
            <li key={a.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={severityBadge(a.severity)}>{lang === 'hi' ? a.title_hi : a.title_en}</span>
                    <span className="badge-info">{t(`common.${a.status === 'unread' ? 'unread' : a.status}`)}</span>
                    {a.parameter_en && (
                      <span className="text-xs text-slate-400">{lang === 'hi' ? a.parameter_hi : a.parameter_en}</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{lang === 'hi' ? a.message_hi : a.message_en}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {t('alerts.generatedAt')}: {formatDate(a.created_at, true)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  {a.status === 'unread' && (
                    <button type="button" className="btn-secondary" onClick={() => setStatus(a.id, 'read')}>
                      {t('alerts.markRead')}
                    </button>
                  )}
                  {a.status !== 'resolved' && (
                    <button type="button" className="btn-secondary" onClick={() => setStatus(a.id, 'resolved')}>
                      {t('alerts.markResolved')}
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>←</button>
          <span className="text-slate-500">{page} / {pages}</span>
          <button type="button" className="btn-secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>→</button>
        </div>
      )}
    </div>
  );
}
