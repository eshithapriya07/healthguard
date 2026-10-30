/**
 * Tiny fetch wrapper for the HealthGuard API.
 * - attaches the JWT from localStorage
 * - always parses JSON errors
 * - broadcasts a global "unauthorized" event on 401 so AuthContext can log out
 */
const BASE = import.meta.env.VITE_API_URL || '/api';

export function getToken() {
  return localStorage.getItem('healthguard.token');
}

export function setToken(token) {
  if (token) localStorage.setItem('healthguard.token', token);
  else localStorage.removeItem('healthguard.token');
}

export class ApiError extends Error {
  constructor(status, payload) {
    super(payload?.message || `Request failed (${status})`);
    this.status = status;
    this.code = payload?.error || 'error';
    this.field = payload?.field;
    this.payload = payload;
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    throw new ApiError(0, { message: 'network_error', error: 'network_error' });
  }

  let payload = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new CustomEvent('healthguard:unauthorized'));
    throw new ApiError(res.status, payload);
  }
  return payload;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  delete: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
};

/** Local datetime value -> "YYYY-MM-DDTHH:mm" for <input type="datetime-local"> */
export function toLocalInput(iso) {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDate(iso, withTime = false) {
  if (!iso) return '—';
  const d = new Date(String(iso).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString(i18nLocale(), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

function i18nLocale() {
  const lang = document.documentElement.lang || 'en';
  return lang === 'hi' ? 'hi-IN' : 'en-GB';
}
