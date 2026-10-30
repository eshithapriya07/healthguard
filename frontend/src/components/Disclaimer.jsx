import { useTranslation } from 'react-i18next';

/**
 * The mandatory medical safety notice, shown on the dashboard, alerts,
 * reports and in the chat widget.
 */
export default function Disclaimer({ className = '' }) {
  const { t } = useTranslation();
  return (
    <p
      className={`rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ${className}`}
      role="note"
    >
      ⚠ {t('common.disclaimer')}
    </p>
  );
}
