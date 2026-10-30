import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

export default function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [token, setToken] = useState(params.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
      setError(t('auth.weakPassword'));
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      navigate('/login');
    } catch (err) {
      setError(err.status === 400 ? err.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-sky-50 px-4">
      <div className="card w-full max-w-md">
        <h1 className="mb-4 text-xl font-bold text-slate-800">{t('auth.newPassword')}</h1>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label" htmlFor="token">{t('auth.resetToken')}</label>
            <input id="token" className="input font-mono text-xs" required value={token} onChange={(e) => setToken(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="password">{t('auth.newPassword')}</label>
            <input id="password" type="password" className="input" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="confirm">{t('auth.confirmPassword')}</label>
            <input id="confirm" type="password" className="input" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {t('common.save')}
          </button>
        </form>
        <p className="mt-4 text-center text-sm">
          <Link to="/login" className="font-semibold text-brand-600 hover:underline">
            {t('auth.goToLogin')}
          </Link>
        </p>
      </div>
    </div>
  );
}
