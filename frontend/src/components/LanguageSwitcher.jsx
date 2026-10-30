import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

/** EN | हिं switcher kept in the navbar so the language can change at any time. */
export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const { changeLanguage, user } = useAuth();

  const current = i18n.language === 'hi' ? 'hi' : 'en';
  const pick = async (lang) => {
    if (lang === current) return;
    await changeLanguage(lang, !!user); // persisted to MySQL when signed in
  };

  return (
    <div
      className="flex items-center rounded-lg border border-slate-300 bg-white text-sm font-semibold"
      role="group"
      aria-label={t('language.title')}
    >
      <button
        type="button"
        onClick={() => pick('en')}
        aria-pressed={current === 'en'}
        className={`px-3 py-1.5 rounded-l-lg transition ${current === 'en' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => pick('hi')}
        aria-pressed={current === 'hi'}
        className={`px-3 py-1.5 rounded-r-lg transition ${current === 'hi' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
      >
        हिं
      </button>
    </div>
  );
}
