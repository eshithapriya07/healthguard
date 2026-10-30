import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, formatDate } from '../api/client';
import StatCard from '../components/StatCard';
import TrendChart from '../components/TrendChart';
import Disclaimer from '../components/Disclaimer';
import Spinner from '../components/Spinner';

/**
 * Caregiver / Doctor dashboard: read-only view of ONLY the data the patient
 * has shared with this account (filtered again by the backend).
 */
export default function SharedWithMe() {
  const { t, i18n } = useTranslation();
  const [patients, setPatients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/shared/patients')
      .then((res) => setPatients(res.patients || []))
      .catch(() => setPatients([]))
      .finally(() => setLoading(false));
  }, []);

  const open = async (patient) => {
    setSelected(patient);
    setView(null);
    const summary = await api.get(`/shared/patients/${patient.patientId}/summary`);
    let alerts = { rows: [] };
    if (patient.items.includes('alerts')) alerts = await api.get(`/shared/patients/${patient.patientId}/alerts`);
    let trends = null;
    if (patient.items.includes('bp')) trends = await api.get(`/shared/patients/${patient.patientId}/trends?parameter=bp&days=30`);
    let reports = { reports: [] };
    if (patient.items.includes('report')) reports = await api.get('/shared/reports');
    setView({ summary, alerts, trends, reports: reports.reports || [] });
  };

  const lang = i18n.language === 'hi' ? 'hi' : 'en';

  if (loading) return <Spinner label={t('common.loading')} />;

  if (!patients.length) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">{t('shared.title')}</h1>
        <div className="card text-sm text-slate-500">{t('shared.empty')}</div>
        <Disclaimer />
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">{t('shared.title')}</h1>
        <p className="text-sm text-slate-500">{t('shared.selectPatient')}</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {patients.map((p) => (
            <button key={p.patientId} type="button" onClick={() => open(p)} className="card text-left transition hover:border-brand-300">
              <div className="text-lg font-semibold text-slate-800">{p.name}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.items.map((i) => (
                  <span key={i} className="badge-info">{t(`sharing.itemsList.${i}`)}</span>
                ))}
              </div>
              <div className="mt-2 text-xs text-slate-400">
                {t('sharing.expires')}: {p.expiresAt ? formatDate(p.expiresAt, true) : t('sharing.never')}
              </div>
            </button>
          ))}
        </div>
        <Disclaimer />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{selected.name}</h1>
          <p className="text-sm text-slate-500">{t('shared.readOnly')} · {t('shared.sharedItems')}:</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {selected.items.map((i) => (
              <span key={i} className="badge-info">{t(`sharing.itemsList.${i}`)}</span>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            setSelected(null);
            setView(null);
          }}
        >
          {t('shared.backToList')}
        </button>
      </div>

      <Disclaimer />

      {!view ? (
        <Spinner label={t('common.loading')} />
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-lg font-semibold text-slate-700">{t('dashboard.latestReadings')}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {view.summary.cards.map((c) => (
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
              {view.summary.cards.length === 0 && (
                <div className="card text-sm text-slate-500">{t('shared.notShared')}</div>
              )}
            </div>
          </section>

          {view.trends && (
            <section className="card">
              <TrendChart
                title={t('trends.chartTitle', { parameter: t('parameters.bp') })}
                points={view.trends.points}
                isBp
                unit="mmHg"
              />
            </section>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card">
              <h2 className="mb-3 text-lg font-semibold text-slate-700">{t('dashboard.summary', { days: 30 })}</h2>
              <table className="w-full text-sm">
                <tbody>
                  {view.summary.summary.map((s) => (
                    <tr key={s.parameter} className="border-b border-slate-50">
                      <td className="py-2 font-medium text-slate-600">{t(`parameters.${s.parameter}`)}</td>
                      <td className="py-2 text-right text-slate-500">
                        {s.valueKind === 'bp'
                          ? `${s.avg?.systolic}/${s.avg?.diastolic}`
                          : s.avg ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="card">
              <h2 className="mb-3 text-lg font-semibold text-slate-700">{t('nav.alerts')}</h2>
              {view.alerts.rows?.length ? (
                <ul className="space-y-2">
                  {view.alerts.rows.slice(0, 8).map((a) => (
                    <li key={a.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <div className="font-medium text-slate-700">{lang === 'hi' ? a.title_hi : a.title_en}</div>
                      <div className="text-xs text-slate-500">{formatDate(a.created_at, true)}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">{view.reports.length ? t('shared.notShared') : t('alerts.empty')}</p>
              )}
            </section>
          </div>

          {selected.items.includes('report') && (
            <section className="card">
              <h2 className="mb-3 text-lg font-semibold text-slate-700">{t('reports.title')}</h2>
              {view.reports.length ? (
                <ul className="divide-y divide-slate-100 text-sm">
                  {view.reports.map((r) => (
                    <li key={r.id} className="flex items-center justify-between py-2">
                      <span className="font-medium text-slate-700">{r.title}</span>
                      <span className="text-xs text-slate-500">
                        {formatDate(r.date_from)} → {formatDate(r.date_to)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">{t('reports.empty')}</p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
