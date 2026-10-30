import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Register() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError(t('auth.weakPassword'));
      return;
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(form.password)) {
      setError(t('auth.weakPassword'));
      return;
    }
    setBusy(true);
    try {
      await register({ fullName: form.fullName, email: form.email, password: form.password, language: 'en' });
      navigate('/language', { replace: true });
    } catch (err) {
      if (err.status === 409) setError(t('auth.emailTaken'));
      else if (err.status === 400) setError(err.message || t('auth.weakPassword'));
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
            <span className="text-lg font-bold text-slate-800">{t('common.appName')}</span>
          </div>
          <LanguageSwitcher />
        </div>

        <div className="card">
          <h1 className="mb-4 text-xl font-bold text-slate-800">{t('auth.registerTitle')}</h1>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label" htmlFor="fullName">{t('auth.fullName')}</label>
              <input id="fullName" className="input" required value={form.fullName} onChange={set('fullName')} />
            </div>
            <div>
              <label className="label" htmlFor="email">{t('auth.email')}</label>
              <input id="email" type="email" className="input" required value={form.email} onChange={set('email')} />
            </div>
            <div>
              <label className="label" htmlFor="password">{t('auth.password')}</label>
              <input id="password" type="password" className="input" required value={form.password} onChange={set('password')} />
              <p className="mt-1 text-xs text-slate-400">{t('auth.weakPassword')}</p>
            </div>
            <div>
              <label className="label" htmlFor="confirm">{t('auth.confirmPassword')}</label>
              <input id="confirm" type="password" className="input" required value={form.confirm} onChange={set('confirm')} />
            </div>

            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? t('common.loading') : t('auth.signUp')}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">
            {t('auth.haveAccount')}{' '}
            <Link to="/login" className="font-semibold text-brand-600 hover:underline">
              {t('auth.signIn')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
