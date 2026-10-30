import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

/** Notification bell (alerts + reminders) with an unread badge. */
export default function AlertBell() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const boxRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      setItems(res.notifications || []);
      setUnread(res.unread || 0);
    } catch {
      /* signed out or offline — keep the last known state */
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const markAll = async () => {
    await api.post('/notifications/read-all', {});
    load();
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('alerts.bellCount', { count: unread })}
        className="relative rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-600 hover:bg-slate-50"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 max-h-[70vh] w-80 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-sm font-semibold">{t('nav.notifications')}</span>
            <button type="button" className="text-xs text-brand-600 hover:underline" onClick={markAll}>
              {t('nav.markAllRead')}
            </button>
          </div>
          {items.length === 0 && <p className="px-3 py-4 text-sm text-slate-500">{t('alerts.empty')}</p>}
          <ul className="divide-y divide-slate-100">
            {items.map((n) => {
              const lang = i18n.language === 'hi' ? 'hi' : 'en';
              return (
                <li key={n.id} className={`px-3 py-2.5 ${n.is_read ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-slate-800">{lang === 'hi' ? n.title_hi : n.title_en}</span>
                    {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{lang === 'hi' ? n.body_hi : n.body_en}</p>
                  <span className="mt-1 block text-[11px] text-slate-400">
                    {new Date(String(n.created_at).replace(' ', 'T')).toLocaleString()}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
