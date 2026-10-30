import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setResult(res);
    } catch {
      setResult({ message: t('common.error') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-sky-50 px-4">
      <div className="card w-full max-w-md">
        <h1 className="mb-4 text-xl font-bold text-slate-800">{t('auth.forgotPassword')}</h1>

        {!result ? (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">{t('auth.email')}</label>
              <input id="email" type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? t('common.loading') : t('auth.forgotPassword')}
            </button>
          </form>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700">{result.message}</p>
            {result.resetToken && (
              <>
                <p className="text-xs text-slate-500">{t('auth.resetTokenHelp')}</p>
                <code className="block break-all rounded bg-slate-100 p-2 text-xs">{result.resetToken}</code>
                <Link to={`/reset?token=${result.resetToken}`} className="btn-primary w-full">
                  {t('auth.newPassword')}
                </Link>
              </>
            )}
          </div>
        )}

        <p className="mt-4 text-center text-sm">
          <Link to="/login" className="font-semibold text-brand-600 hover:underline">
            {t('auth.goToLogin')}
          </Link>
        </p>
      </div>
    </div>
  );
}
