import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, formatDate } from '../api/client';
import StatCard from '../components/StatCard';
import TrendChart from '../components/TrendChart';
import Disclaimer from '../components/Disclaimer';
import Spinner from '../components/Spinner';
import { useAuth } from '../context/AuthContext';

/** Patient dashboard: latest cards, summary, alerts, reminders, quick chart. */
export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [chart, setChart] = useState({ parameter: 'bp', points: [] });
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/dashboard');
        if (!alive) return;
        setData(res);
        const trends = await api.get('/trends?parameter=bp&days=7');
        if (alive) setChart({ parameter: 'bp', points: trends.points || [] });
      } catch (err) {
        if (alive) setError(err.message || t('common.error'));
      }
    })();
    return () => {
      alive = false;
    };
  }, [t]);

  if (error) return <p className="rounded-lg bg-rose-50 p-4 text-rose-700">{error}</p>;
  if (!data) return <Spinner label={t('common.loading')} />;

  const lang = i18n.language === 'hi' ? 'hi' : 'en';
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t('dashboard.greetingMorning') : hour < 18 ? t('dashboard.greetingAfternoon') : t('dashboard.greetingEvening');

  const alertTotal = (data.alertCounts || []).reduce((sum, r) => sum + Number(r.total), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {greeting}, {user?.fullName}
          </h1>
          <p className="text-sm text-slate-500">{t('common.tagline')}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/readings" className="btn-primary">{t('dashboard.quickAdd')}</Link>
          <Link to="/trends" className="btn-secondary">{t('dashboard.viewTrends')}</Link>
        </div>
      </div>

      <Disclaimer />

      {/* latest reading cards */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-700">{t('dashboard.latestReadings')}</h2>
        {data.cards.length === 0 ? (
          <div className="card text-sm text-slate-500">
            {t('dashboard.noReadings')}{' '}
            <Link to="/readings" className="font-semibold text-brand-600 hover:underline">
              {t('dashboard.addFirst')}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {data.cards.map((c) => (
              <StatCard
                key={c.parameter}
                name={lang === 'hi' ? c.nameHi : c.nameEn}
                value={c.value}
                unit={c.unit}
                status={c.status}
                measuredAt={c.measuredAt}
                isBp={c.valueKind === 'bp'}
                systolic={c.systolic}
                diastolic={c.diastolic}
              />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 7-day chart */}
        <section className="card lg:col-span-2">
          <TrendChart
            title={t('trends.chartTitle', { parameter: t('parameters.bp') })}
            points={chart.points}
            isBp
            unit="mmHg"
          />
        </section>

        {/* summary */}
        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-700">{t('dashboard.summary', { days: data.range.days })}</h2>
            <span className="badge-info">
              {t('dashboard.alertsCount')}: {alertTotal}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
                  <th className="py-2">{t('records.parameter')}</th>
                  <th className="py-2 text-right">{t('common.avg')}</th>
                  <th className="py-2 text-right">{t('common.min')}</th>
                  <th className="py-2 text-right">{t('common.max')}</th>
                </tr>
              </thead>
              <tbody>
                {data.summary.map((s) => {
                  const fmt = (v) =>
                    v && typeof v === 'object' ? `${v.systolic}/${v.diastolic}` : v ?? '—';
                  return (
                    <tr key={s.parameter} className="border-b border-slate-50">
                      <td className="py-2 font-medium text-slate-600">{t(`parameters.${s.parameter}`)}</td>
                      <td className="py-2 text-right">{fmt(s.avg)}</td>
                      <td className="py-2 text-right">{fmt(s.min)}</td>
                      <td className="py-2 text-right">{fmt(s.max)}</td>
                    </tr>
                  );
                })}
                {data.summary.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-400">{t('dashboard.noReadings')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-700">{t('dashboard.recentAlerts')}</h2>
            <Link to="/alerts" className="text-sm text-brand-600 hover:underline">{t('dashboard.viewAll')}</Link>
          </div>
          {data.recentAlerts.length === 0 ? (
            <p className="text-sm text-slate-500">{t('dashboard.noAlerts')}</p>
          ) : (
            <ul className="space-y-3">
              {data.recentAlerts.map((a) => {
                const severity = a.severity === 'critical' ? 'critical' : a.severity === 'warning' ? 'warning' : 'info';
                return (
                  <li key={a.id} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`badge-${severity}`}>{lang === 'hi' ? a.title_hi : a.title_en}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{lang === 'hi' ? a.message_hi : a.message_en}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-400">{formatDate(a.created_at, true)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-700">{t('dashboard.upcomingReminders')}</h2>
            <Link to="/reminders" className="text-sm text-brand-600 hover:underline">{t('dashboard.viewAll')}</Link>
          </div>
          {data.upcomingReminders.length === 0 ? (
            <p className="text-sm text-slate-500">{t('dashboard.noReminders')}</p>
          ) : (
            <ul className="space-y-3">
              {data.upcomingReminders.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                  <div>
                    <div className="text-sm font-medium text-slate-700">{r.title}</div>
                    <div className="text-xs text-slate-500">
                      {t(`reminders.types.${r.type}`)} · {formatDate(r.scheduled_at, true)}
                    </div>
                  </div>
                  <span className={`badge-${r.status === 'snoozed' ? 'warning' : 'info'}`}>
                    {t(`reminders.statuses.${r.status}`)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
