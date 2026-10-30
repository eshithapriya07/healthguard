import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from '../api/client';
import { setAppLanguage } from '../i18n';

const AuthContext = createContext(null);

/**
 * Holds the signed-in user, the JWT and the role used by the route guards.
 * On boot it restores the session from localStorage and refreshes /me.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(!!getToken());

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const refreshMe = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      return null;
    }
    try {
      const { user: me } = await api.get('/auth/me');
      setUser(me);
      return me;
    } catch {
      setToken(null);
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      await refreshMe();
      if (alive) setBooting(false);
    })();
    return () => {
      alive = false;
    };
  }, [refreshMe]);

  useEffect(() => {
    const onUnauthorized = () => logout();
    window.addEventListener('healthguard:unauthorized', onUnauthorized);
    return () => window.removeEventListener('healthguard:unauthorized', onUnauthorized);
  }, [logout]);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    setToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (payload) => {
    const res = await api.post('/auth/register', payload);
    setToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  /** Persists the choice (MySQL users.preferred_language) and switches the UI. */
  const changeLanguage = useCallback(
    async (language, persist = true) => {
      await setAppLanguage(language);
      if (persist && getToken()) {
        try {
          await api.put('/profile/language', { language });
          setUser((prev) => (prev ? { ...prev, language } : prev));
        } catch {
          /* language still applied locally even if the API call fails */
        }
      } else {
        setUser((prev) => (prev ? { ...prev, language } : prev));
      }
    },
    []
  );

  const value = useMemo(
    () => ({ user, booting, login, register, logout, refreshMe, setUser, changeLanguage }),
    [user, booting, login, register, logout, refreshMe, changeLanguage]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export const ROLE_HOME = {
  patient: '/',
  caregiver: '/shared',
  doctor: '/shared',
  admin: '/admin',
};
