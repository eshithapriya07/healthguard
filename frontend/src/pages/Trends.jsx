import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import TrendChart from '../components/TrendChart';
import Disclaimer from '../components/Disclaimer';
import Spinner from '../components/Spinner';

const dayISO = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);

/** Trend page: line chart with 7-day / 30-day / custom ranges and summary. */
export default function Trends() {
  const { t } = useTranslation();
  const [params, setParams] = useState([]);
  const [parameter, setParameter] = useState('bp');
  const [rangeMode, setRangeMode] = useState('7');
  const [from, setFrom] = useState(dayISO(-7));
  const [to, setTo] = useState(dayISO(0));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/parameters').then((r) => setParams(r.parameters || [])).catch(() => setParams([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let qs = `/trends?parameter=${parameter}`;
      if (rangeMode === 'custom') qs += `&from=${from}&to=${to}`;
      else qs += `&days=${rangeMode}`;
      const res = await api.get(qs);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [parameter, rangeMode, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const current = params.find((p) => p.code === parameter);
  const isBp = current?.value_kind === 'bp';

  const fmt = (v) =>
    v == null ? '—' : typeof v === 'object' ? `${v.systolic}/${v.diastolic}` : v;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">{t('trends.title')}</h1>
      <Disclaimer />

      <div className="card flex flex-wrap items-end gap-4">
        <div>
          <label className="label" htmlFor="parameter">{t('records.parameter')}</label>
          <select id="parameter" className="input w-56" value={parameter} onChange={(e) => setParameter(e.target.value)}>
            {params.map((p) => (
              <option key={p.code} value={p.code}>{t(`parameters.${p.code}`)}</option>
            ))}
          </select>
        </div>

        <div>
          <span className="label">{t('trends.range')}</span>
          <div className="flex gap-2">
            {['7', '30', 'custom'].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setRangeMode(mode)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  rangeMode === mode ? 'bg-brand-600 text-white' : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {mode === '7' ? t('trends.range7') : mode === '30' ? t('trends.range30') : t('trends.custom')}
              </button>
            ))}
          </div>
        </div>

        {rangeMode === 'custom' && (
          <>
            <div>
              <label className="label" htmlFor="from">{t('common.from')}</label>
              <input id="from" type="date" className="input" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="to">{t('common.to')}</label>
              <input id="to" type="date" className="input" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </div>
          </>
        )}
      </div>

      <section className="card">
        {loading ? (
          <Spinner label={t('common.loading')} />
        ) : (
          <TrendChart
            title={t('trends.chartTitle', { parameter: t(`parameters.${parameter}`) })}
            points={data?.points || []}
            isBp={isBp}
            unit={current?.unit}
          />
        )}
      </section>

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold text-slate-700">{t('trends.summary')}</h2>
        {data?.summary ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <div className="text-xs uppercase text-slate-400">{t('common.avg')}</div>
              <div className="text-xl font-bold text-slate-800">{fmt(data.summary.avg)}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-400">{t('common.min')}</div>
              <div className="text-xl font-bold text-slate-800">{fmt(data.summary.min)}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-400">{t('common.max')}</div>
              <div className="text-xl font-bold text-slate-800">{fmt(data.summary.max)}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-400">{t('common.count')}</div>
              <div className="text-xl font-bold text-slate-800">{data.summary.count}</div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">{t('trends.noData')}</p>
        )}
        <p className="mt-4 text-xs text-slate-400">{t('trends.exportHint')}</p>
      </section>
    </div>
  );
}
