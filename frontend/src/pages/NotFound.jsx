import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { ROLE_HOME } from '../context/AuthContext';

export default function NotFound() {
  const { t } = useTranslation();
  const { user } = useAuth();
  return (
    <div className="card mx-auto max-w-lg text-center">
      <div className="text-5xl">🧭</div>
      <h1 className="mt-3 text-xl font-bold text-slate-800">{t('errors.notFound')}</h1>
      <p className="mt-2 text-sm text-slate-500">{t('errors.pageNotFoundText')}</p>
      <Link to={ROLE_HOME[user?.role] || '/'} className="btn-primary mt-5 inline-flex">
        {t('nav.dashboard')}
      </Link>
    </div>
  );
}
