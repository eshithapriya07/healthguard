import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

const DEMO = [
  { role: 'admin.roles.patient', email: 'priya.sharma@example.com', password: 'Patient@123' },
  { role: 'admin.roles.caregiver', email: 'ramesh.family@example.com', password: 'Caregiver@123' },
  { role: 'admin.roles.doctor', email: 'dr.mehta@example.com', password: 'Doctor@123' },
  { role: 'admin.roles.admin', email: 'admin@healthguard.local', password: 'Admin@123' },
];

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      // Mandatory full-screen language selection before the dashboard.
      navigate('/language', { replace: true });
    } catch (err) {
      if (err.status === 401) setError(t('auth.invalidCredentials'));
      else if (err.status === 403) setError(t('auth.accountInactive'));
      else if (err.status === 429) setError(t('auth.tooManyAttempts'));
      else setError(t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-sky-50">
      <div className="mx-auto flex max-w-md flex-col px-4 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-xl text-white">🩺</span>
            <div>
              <div className="text-lg font-bold text-slate-800">{t('common.appName')}</div>
              <div className="text-xs text-slate-500">{t('common.tagline')}</div>
            </div>
          </div>
          <LanguageSwitcher />
        </div>

        <div className="card">
          <h1 className="mb-1 text-xl font-bold text-slate-800">{t('auth.loginTitle')}</h1>
          <p className="mb-5 text-sm text-slate-500">{t('auth.tagline')}</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">{t('auth.email')}</label>
              <input
                id="email"
                type="email"
                className="input"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="label" htmlFor="password">{t('auth.password')}</label>
                <Link to="/forgot" className="mb-1 text-xs text-brand-600 hover:underline">
                  {t('auth.forgotPassword')}
                </Link>
              </div>
              <input
                id="password"
                type="password"
                className="input"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? t('common.loading') : t('auth.signIn')}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="font-semibold text-brand-600 hover:underline">
              {t('auth.signUp')}
            </Link>
          </p>
        </div>

        <div className="card mt-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-600">{t('auth.demoAccounts')}</h2>
          <ul className="space-y-1 text-xs text-slate-500">
            {DEMO.map((d) => (
              <li key={d.email} className="flex items-center justify-between gap-2">
                <span>{t(d.role)}</span>
                <button
                  type="button"
                  className="font-mono text-brand-600 hover:underline"
                  onClick={() => {
                    setEmail(d.email);
                    setPassword(d.password);
                  }}
                >
                  {d.email}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
