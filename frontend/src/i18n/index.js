import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import hi from './locales/hi.json';

const STORAGE_KEY = 'healthguard.language';

/**
 * Complete English / Hindi resources. There are no hardcoded UI strings:
 * every label, message, chart caption and disclaimer comes from these files.
 */
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
  },
  lng: localStorage.getItem(STORAGE_KEY) || 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnEmptyString: false,
});

export function setAppLanguage(lang) {
  const next = lang === 'hi' ? 'hi' : 'en';
  localStorage.setItem(STORAGE_KEY, next);
  document.documentElement.lang = next === 'hi' ? 'hi' : 'en';
  return i18n.changeLanguage(next);
}

document.documentElement.lang = i18n.language === 'hi' ? 'hi' : 'en';

export default i18n;
