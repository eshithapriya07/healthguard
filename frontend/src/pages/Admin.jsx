import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, formatDate } from '../api/client';
import Spinner from '../components/Spinner';

const OPERATORS = ['gte', 'gt', 'lte', 'lt', 'bp_or_gte', 'bp_and_gte', 'bp_or_lte'];
const ROLES = ['patient', 'caregiver', 'doctor', 'admin'];

/** Administration: user management, alert thresholds, monitoring and audit logs. */
export default function Admin() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('users');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">{t('admin.title')}</h1>

      {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {['users', 'thresholds', 'monitoring', 'logs'].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === key ? 'bg-brand-600 text-white' : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t(`admin.tabs.${key}`)}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersTab onNotice={setNotice} onError={setError} />}
      {tab === 'thresholds' && <ThresholdsTab onNotice={setNotice} onError={setError} />}
      {tab === 'monitoring' && <MonitoringTab />}
      {tab === 'logs' && <LogsTab />}
    </div>
  );
}

function UsersTab({ onNotice, onError }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/users?search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`);
      setRows(res.rows || []);
      setTotal(res.total || 0);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (id, path, body) => {
    onError('');
    try {
      await api.patch(`/admin/users/${id}/${path}`, body);
      onNotice(t('admin.updated'));
      await load();
    } catch (err) {
      onError(err.message || t('common.error'));
    }
  };

  const remove = async (id) => {
    if (!window.confirm(t('admin.deleteConfirm'))) return;
    try {
      await api.delete(`/admin/users/${id}`);
      onNotice(t('admin.updated'));
      await load();
    } catch (err) {
      onError(err.message || t('common.error'));
    }
  };

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-700">{t('admin.usersTitle')}</h2>
        <input
          className="input w-64"
          placeholder={t('admin.search')}
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
      </div>

      {loading ? (
        <Spinner label={t('common.loading')} />
      ) : rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">{t('admin.noUsers')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
                <th className="py-2">{t('auth.fullName')}</th>
                <th className="py-2">{t('auth.email')}</th>
                <th className="py-2">{t('admin.role')}</th>
                <th className="py-2">{t('admin.status')}</th>
                <th className="py-2">{t('admin.lastLogin')}</th>
                <th className="py-2 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-b border-slate-50">
                  <td className="py-2.5 font-medium text-slate-700">{u.full_name}</td>
                  <td className="py-2.5 text-slate-500">{u.email}</td>
                  <td className="py-2.5">
                    <select
                      className="input py-1 text-xs"
                      value={u.role}
                      onChange={(e) => patch(u.id, 'role', { role: e.target.value })}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{t(`admin.roles.${r}`)}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2.5">
                    <span className={u.status === 'active' ? 'badge-normal' : 'badge-critical'}>
                      {u.status === 'active' ? t('common.yes') : t('common.no')}
                    </span>
                  </td>
                  <td className="py-2.5 text-xs text-slate-400">{u.last_login_at ? formatDate(u.last_login_at, true) : '—'}</td>
                  <td className="py-2.5 text-right">
                    <button
                      type="button"
                      className="mr-3 text-brand-600 hover:underline"
                      onClick={() => patch(u.id, 'status', { status: u.status === 'active' ? 'inactive' : 'active' })}
                    >
                      {u.status === 'active' ? t('admin.deactivate') : t('admin.activate')}
                    </button>
                    <button type="button" className="text-rose-600 hover:underline" onClick={() => remove(u.id)}>
                      {t('common.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>←</button>
          <span className="text-slate-500">{page} / {pages}</span>
          <button type="button" className="btn-secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>→</button>
        </div>
      )}
    </section>
  );
}

function ThresholdsTab({ onNotice, onError }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/thresholds');
      setRows(res.thresholds || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (row) => {
    onError('');
    try {
      await api.put(`/admin/thresholds/${row.id}`, {
        operator: row.operator,
        valuePrimary: Number(row.value_primary),
        valueSecondary: row.value_secondary == null ? null : Number(row.value_secondary),
        enabled: !!row.enabled,
      });
      onNotice(t('admin.thresholdSaved'));
      await load();
    } catch (err) {
      onError(err.message || t('common.error'));
    }
  };

  const patchRow = (id, key, value) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: value } : r)));

  if (loading) return <Spinner label={t('common.loading')} />;

  return (
    <section className="card overflow-x-auto">
      <h2 className="mb-4 text-lg font-semibold text-slate-700">{t('admin.thresholdsTitle')}</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
            <th className="py-2">{t('records.parameter')}</th>
            <th className="py-2">{t('alerts.severity')}</th>
            <th className="py-2">{t('admin.operator')}</th>
            <th className="py-2">{t('admin.primary')}</th>
            <th className="py-2">{t('admin.secondary')}</th>
            <th className="py-2">{t('admin.enabled')}</th>
            <th className="py-2 text-right">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-50">
              <td className="py-2 font-medium text-slate-600">{t(`parameters.${r.parameter_code}`)}</td>
              <td className="py-2">
                <span className={r.severity === 'critical' ? 'badge-critical' : r.severity === 'warning' ? 'badge-warning' : 'badge-info'}>
                  {t(`common.${r.severity}`)}
                </span>
              </td>
              <td className="py-2">
                <select className="input py-1 text-xs" value={r.operator} onChange={(e) => patchRow(r.id, 'operator', e.target.value)}>
                  {OPERATORS.map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
              </td>
              <td className="py-2">
                <input
                  type="number"
                  step="0.1"
                  className="input w-24 py-1 text-xs"
                  value={r.value_primary}
                  onChange={(e) => patchRow(r.id, 'value_primary', e.target.value)}
                />
              </td>
              <td className="py-2">
                <input
                  type="number"
                  step="0.1"
                  className="input w-24 py-1 text-xs"
                  value={r.value_secondary ?? ''}
                  disabled={r.value_secondary == null}
                  onChange={(e) => patchRow(r.id, 'value_secondary', e.target.value)}
                />
              </td>
              <td className="py-2">
                <input
                  type="checkbox"
                  checked={!!r.enabled}
                  onChange={(e) => patchRow(r.id, 'enabled', e.target.checked)}
                />
              </td>
              <td className="py-2 text-right">
                <button type="button" className="btn-secondary px-3 py-1 text-xs" onClick={() => update(r)}>
                  {t('admin.saveThreshold')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function MonitoringTab() {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setFailed(false);
    api
      .get('/admin/stats')
      .then((r) => setStats(r.stats || null))
      .catch(() => setFailed(true));
  }, [attempt]);

  if (failed) {
    return (
      <div className="card text-center">
        <p className="mb-4 text-sm text-slate-500">{t('common.error')}</p>
        <button type="button" className="btn-secondary" onClick={() => setAttempt((a) => a + 1)}>
          {t('common.retry')}
        </button>
      </div>
    );
  }

  if (!stats) return <Spinner label={t('common.loading')} />;

  const daily = Array.isArray(stats.readingsLast7Days) ? stats.readingsLast7Days : [];
  const byRole = Array.isArray(stats.usersByRole) ? stats.usersByRole : [];

  const cards = [
    { label: t('admin.totalUsers'), value: stats.users?.total },
    { label: t('admin.totalReadings'), value: stats.readings?.total },
    { label: t('admin.totalAlerts'), value: stats.alerts?.total },
    { label: t('admin.activeShares'), value: stats.shares?.active },
  ];
  const max = Math.max(1, ...daily.map((d) => Number(d.total)));

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card">
            <div className="text-xs uppercase text-slate-400">{c.label}</div>
            <div className="text-3xl font-bold text-slate-800">{c.value ?? 0}</div>
          </div>
        ))}
      </section>

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold text-slate-700">{t('admin.recentReadings')}</h2>
        <div className="flex h-40 items-end gap-2">
          {daily.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-brand-500"
                style={{ height: `${(Number(d.total) / max) * 100}%` }}
                title={`${d.day}: ${d.total}`}
              />
              <span className="text-[10px] text-slate-400">{String(d.day).slice(5)}</span>
            </div>
          ))}
          {daily.length === 0 && <p className="text-sm text-slate-500">{t('dashboard.noReadings')}</p>}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold text-slate-700">{t('admin.tabs.users')}</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          {byRole.map((r) => (
            <span key={r.code} className="badge-info">
              {t(`admin.roles.${r.code}`)}: {r.total}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

function LogsTab() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 25;

  useEffect(() => {
    setLoading(true);
    api
      .get(`/admin/audit-logs?page=${page}&limit=${limit}`)
      .then((r) => {
        setRows(r.rows || []);
        setTotal(r.total || 0);
      })
      .finally(() => setLoading(false));
  }, [page]);

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <section className="card overflow-x-auto">
      <h2 className="mb-4 text-lg font-semibold text-slate-700">{t('admin.logsTitle')}</h2>
      {loading ? (
        <Spinner label={t('common.loading')} />
      ) : rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">{t('admin.emptyLogs')}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
              <th className="py-2">{t('common.date')}</th>
              <th className="py-2">{t('auth.email')}</th>
              <th className="py-2">{t('admin.tabs.logs')}</th>
              <th className="py-2">{t('common.notes')}</th>
              <th className="py-2">IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} className="border-b border-slate-50">
                <td className="py-2 text-xs text-slate-500">{formatDate(l.created_at, true)}</td>
                <td className="py-2 text-xs text-slate-600">{l.user_email || '—'}</td>
                <td className="py-2 text-xs font-medium text-slate-700">{l.action}</td>
                <td className="py-2 max-w-xs truncate text-xs text-slate-500">{l.detail || '—'}</td>
                <td className="py-2 text-xs text-slate-400">{l.ip_address || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>←</button>
          <span className="text-slate-500">{page} / {pages}</span>
          <button type="button" className="btn-secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>→</button>
        </div>
      )}
    </section>
  );
}
