import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import Disclaimer from './Disclaimer';

/**
 * Rule-based / AI health assistant, available on every page.
 * Answers follow the selected language and always carry the safety notice.
 */
export default function ChatWidget() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    api.get('/chat/messages').then((res) => setMessages(res.messages || [])).catch(() => setMessages([]));
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, busy]);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setMessages((m) => [...m, { role: 'user', content: body }]);
    setText('');
    setBusy(true);
    try {
      const res = await api.post('/chat', { message: body, language: i18n.language === 'hi' ? 'hi' : 'en' });
      setMessages((m) => [...m, { role: 'assistant', content: res.reply, source: res.source }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: t('common.networkError'), source: 'rule' }]);
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    try {
      await api.delete('/chat/messages');
    } catch {
      /* ignore */
    }
    setMessages([]);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? t('chat.close') : t('chat.open')}
        className="no-print fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-2xl text-white shadow-lg transition hover:bg-brand-700"
      >
        {open ? '✕' : '💬'}
      </button>

      {open && (
        <div className="no-print fixed bottom-24 right-5 z-50 flex h-[70vh] max-h-[560px] w-[calc(100vw-2.5rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-brand-600 px-4 py-3 text-white">
            <div>
              <div className="text-sm font-semibold">{t('chat.title')}</div>
              <div className="text-[11px] opacity-80">{t('common.tagline')}</div>
            </div>
            <button type="button" onClick={clear} className="rounded px-2 py-1 text-[11px] hover:bg-brand-700">
              {t('chat.clear')}
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-3">
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm shadow-sm">
              {t('chat.greeting')}
            </div>
            {messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm shadow-sm ${
                  m.role === 'user' ? 'ml-auto rounded-br-sm bg-brand-600 text-white' : 'rounded-tl-sm bg-white'
                }`}
              >
                {m.content}
                {m.role === 'assistant' && m.source === 'ai' && (
                  <span className="ml-2 rounded bg-slate-200 px-1 text-[10px] text-slate-600">{t('chat.sourceAi')}</span>
                )}
              </div>
            ))}
            {busy && <div className="text-xs text-slate-400">{t('chat.typing')}</div>}
            <div ref={endRef} />
          </div>

          <Disclaimer className="m-2" />

          <form onSubmit={send} className="flex gap-2 border-t border-slate-100 p-2">
            <input
              className="input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('chat.placeholder')}
              aria-label={t('chat.placeholder')}
            />
            <button type="submit" className="btn-primary shrink-0" disabled={busy || !text.trim()}>
              {t('chat.send')}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
