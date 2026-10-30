import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROLE_HOME, useAuth } from '../context/AuthContext';
import LanguageSwitcher from './LanguageSwitcher';
import AlertBell from './AlertBell';
import ChatWidget from './ChatWidget';
import Disclaimer from './Disclaimer';

const NAV = {
  patient: [
    { to: '/', key: 'nav.dashboard', end: true },
    { to: '/readings', key: 'nav.records' },
    { to: '/trends', key: 'nav.trends' },
    { to: '/alerts', key: 'nav.alerts' },
    { to: '/reminders', key: 'nav.reminders' },
    { to: '/reports', key: 'nav.reports' },
    { to: '/sharing', key: 'nav.sharing' },
  ],
  caregiver: [{ to: '/shared', key: 'nav.shared', end: true }],
  doctor: [{ to: '/shared', key: 'nav.shared', end: true }],
  admin: [{ to: '/admin', key: 'nav.admin', end: true }],
};

/** App shell: navbar (language switcher, notification bell), side menu, footer. */
export default function Layout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const items = [...(NAV[user?.role] || []), { to: '/profile', key: 'nav.profile' }];

  useEffect(() => setMenuOpen(false), []);

  const signOut = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur no-print">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-lg lg:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={t('nav.menu')}
          >
            ☰
          </button>

          <NavLink to={ROLE_HOME[user?.role] || '/'} className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-lg text-white">🩺</span>
            <span className="hidden text-lg font-bold text-slate-800 sm:block">{t('common.appName')}</span>
          </NavLink>

          <nav className="ml-4 hidden items-center gap-1 lg:flex">
            {items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                {t(it.key)}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitcher />
            {user?.role === 'patient' && <AlertBell />}
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold leading-tight text-slate-700">{user?.fullName}</div>
              <div className="text-[11px] leading-tight text-slate-400">
                {t(`admin.roles.${user?.role}`)}
              </div>
            </div>
            <button type="button" onClick={signOut} className="btn-secondary">
              {t('common.logout')}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="border-t border-slate-100 bg-white px-3 py-2 lg:hidden">
            {items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2.5 text-sm font-medium ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                  }`
                }
              >
                {t(it.key)}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-24 pt-4 no-print">
        <Disclaimer />
      </footer>

      <ChatWidget />
    </div>
  );
}
