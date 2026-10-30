import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { useTranslation } from 'react-i18next';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const STATUS_COLOR = {
  normal: '#10b981',
  warning: '#f59e0b',
  critical: '#e11d48',
};

/**
 * Line chart for 7-day / 30-day / custom ranges.
 * Accepts points: [{t, value}] or [{t, systolic, diastolic}].
 * All axis/legend text comes from the translation files.
 */
export default function TrendChart({ title, points = [], isBp = false, unit = '' }) {
  const { t, i18n } = useTranslation();

  const data = useMemo(() => {
    const labels = points.map((p) =>
      new Date(String(p.t).replace(' ', 'T')).toLocaleDateString(i18n.language === 'hi' ? 'hi-IN' : 'en-GB', {
        day: '2-digit',
        month: 'short',
      })
    );

    if (isBp) {
      return {
        labels,
        datasets: [
          {
            label: t('records.systolic'),
            data: points.map((p) => (p.systolic == null ? null : Number(p.systolic))),
            borderColor: '#1b6ff5',
            backgroundColor: 'rgba(27,111,245,0.12)',
            tension: 0.3,
            fill: false,
            pointRadius: 3,
          },
          {
            label: t('records.diastolic'),
            data: points.map((p) => (p.diastolic == null ? null : Number(p.diastolic))),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16,185,129,0.12)',
            tension: 0.3,
            fill: false,
            pointRadius: 3,
          },
        ],
      };
    }
    return {
      labels,
      datasets: [
        {
          label: unit ? `${title} (${unit})` : title,
          data: points.map((p) => (p.value == null ? null : Number(p.value))),
          borderColor: '#1b6ff5',
          backgroundColor: 'rgba(27,111,245,0.14)',
          tension: 0.3,
          fill: true,
          pointRadius: 3,
          pointBackgroundColor: points.map((p) => STATUS_COLOR[p.status] || '#1b6ff5'),
        },
      ],
    };
  }, [points, isBp, title, unit, t, i18n.language]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 14 } },
      title: { display: !!title, text: title, font: { size: 14, weight: '600' } },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}${unit ? ` ${unit}` : ''}`,
        },
      },
    },
    scales: {
      y: { beginAtZero: false, title: { display: !!unit, text: unit } },
    },
  };

  if (!points.length) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500">
        {t('trends.noData')}
      </div>
    );
  }

  return (
    <div className="h-64 sm:h-72">
      <Line data={data} options={options} />
    </div>
  );
}
