import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROLE_HOME, useAuth } from '../context/AuthContext';

/**
 * Full-page "Select Your Language / अपनी भाषा चुनें" screen.
 * Shown immediately after every login, before the dashboard, with the
 * previously saved language pre-highlighted. Selecting a language saves it
 * to MySQL (users.preferred_language), switches the entire UI instantly and
 * redirects to the role-specific dashboard.
 */
export default function LanguageSelect() {
  const { t } = useTranslation();
  const { user, changeLanguage } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(user?.language === 'hi' ? 'hi' : 'en');
  const [busy, setBusy] = useState(false);

  const commit = async (lang) => {
    if (busy) return;
    setBusy(true);
    try {
      await changeLanguage(lang, true); // persists + switches every label
      navigate(ROLE_HOME[user?.role] || '/', { replace: true });
    } finally {
      setBusy(false);
    }
  };

  const options = [
    { code: 'en', label: t('language.english'), sample: 'Online Health Monitoring & Early Alert System' },
    { code: 'hi', label: t('language.hindi'), sample: 'ऑनलाइन स्वास्थ्य निगरानी और प्रारंभिक चेतावनी प्रणाली' },
  ];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-brand-50 via-white to-sky-50 px-4">
      <div className="w-full max-w-3xl text-center">
        <div className="mb-6 flex items-center justify-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-2xl text-white">🩺</span>
          <span className="text-2xl font-bold text-slate-800">{t('common.appName')}</span>
        </div>

        <h1 className="text-2xl font-bold text-slate-800 sm:text-3xl">{t('language.title')}</h1>
        <p className="mt-2 text-lg font-semibold text-brand-700">{t('language.titleHi')}</p>
        <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500">{t('language.choosePrompt')}</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {options.map((opt) => {
            const active = selected === opt.code;
            return (
              <button
                key={opt.code}
                type="button"
                onClick={() => setSelected(opt.code)}
                onDoubleClick={() => commit(opt.code)}
                aria-pressed={active}
                className={`rounded-2xl border-2 p-8 text-center transition ${
                  active
                    ? 'border-brand-600 bg-brand-50 shadow-lg ring-4 ring-brand-100'
                    : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-slate-50'
                }`}
              >
                <span className="block text-3xl font-bold text-slate-800">{opt.label}</span>
                <span className="mt-3 block text-sm text-slate-500">{opt.sample}</span>
                {active && <span className="mt-4 inline-block badge-normal">✓</span>}
              </button>
            );
          })}
        </div>

        <button type="button" className="btn-primary mt-8 px-10 py-3 text-base" disabled={busy} onClick={() => commit(selected)}>
          {busy ? t('common.loading') : t('language.confirm')}
        </button>

        <p className="mt-6 text-xs text-slate-400">{t('language.subtitle')}</p>
        <p className="text-xs text-slate-400">{t('language.subtitleHi')}</p>
      </div>
    </div>
  );
}
