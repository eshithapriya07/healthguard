import { useTranslation } from 'react-i18next';

/**
 * Dashboard "latest reading" card with a normal / warning / critical colour.
 */
export default function StatCard({ name, value, unit, status = 'normal', measuredAt, isBp, systolic, diastolic }) {
  const { t } = useTranslation();

  const display = isBp ? `${systolic}/${diastolic}` : value;
  const badgeClass =
    status === 'critical' ? 'badge-critical' : status === 'warning' ? 'badge-warning' : 'badge-normal';
  const statusLabel = t(`common.${status}`);

  return (
    <div className="card flex flex-col justify-between gap-2">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-slate-500">{name}</span>
        <span className={badgeClass}>{statusLabel}</span>
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-800">
          {display ?? '—'}
          {display != null && unit ? <span className="ml-1 text-sm font-medium text-slate-400">{unit}</span> : null}
        </div>
        {measuredAt ? (
          <div className="mt-1 text-xs text-slate-400">
            {new Date(String(measuredAt).replace(' ', 'T')).toLocaleString()}
          </div>
        ) : null}
      </div>
    </div>
  );
}
