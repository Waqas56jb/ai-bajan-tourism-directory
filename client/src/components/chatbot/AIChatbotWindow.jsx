import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, Minus, RotateCcw, Store, X } from 'lucide-react';
import { useChatbot } from '@/hooks/useChatbot';
import { useUI } from '@/hooks/useUI';
import { IS_DEMO } from '@/lib/config';
import { LogoMark } from '@/components/common/Logo';
import { ChatMessage } from './ChatMessage';
import { ChatComposer } from './ChatComposer';
import { ChatSuggestions } from './ChatSuggestions';
import { useIsDesktop } from '@/hooks/useMediaQuery';

function TypingIndicator() {
  return (
    <li className="flex items-center gap-2.5" role="status">
      <LogoMark className="h-8 w-8 shrink-0" />
      <span className="flex items-center gap-2 rounded-3xl rounded-tl-lg bg-white px-4 py-3 shadow-soft ring-1 ring-line/70">
        <span className="flex gap-1" aria-hidden="true">
          <span className="typing-dot h-2 w-2 rounded-full bg-ocean" />
          <span className="typing-dot h-2 w-2 rounded-full bg-ocean" />
          <span className="typing-dot h-2 w-2 rounded-full bg-ocean" />
        </span>
        <span className="text-sm text-muted">Searching Barbadian sources…</span>
      </span>
    </li>
  );
}

/**
 * The assistant panel. Desktop: floating panel. Mobile: full-screen sheet.
 * Non-modal dialog (the page stays usable on desktop); Escape closes; focus moves to the
 * composer on open and back to the launcher on close.
 */
export default function AIChatbotWindow() {
  const { messages, pending, send, retry, clear, context, setContext } = useChatbot();
  const { closeChat, minimizeChat } = useUI();
  const isDesktop = useIsDesktop();
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const composerRef = useRef(null);
  const [pinnedToBottom, setPinnedToBottom] = useState(true);

  useEffect(() => {
    composerRef.current?.focus({ preventScroll: true });
  }, []);

  // Escape closes the assistant when focus is inside it — or has been lost to <body>
  // (e.g. a clicked suggestion chip was removed). Other dialogs handle their own Escape.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const active = document.activeElement;
      if (!active || active === document.body || rootRef.current?.contains(active)) closeChat();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeChat]);

  /** Send from a chip / follow-up and keep keyboard focus in the conversation. */
  const sendFromChip = (text) => {
    send(text);
    composerRef.current?.focus({ preventScroll: true });
  };

  // Scroll to the newest message unless the visitor has scrolled up to read history.
  useEffect(() => {
    const el = listRef.current;
    if (el && pinnedToBottom) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length, pending, pinnedToBottom]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    setPinnedToBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  const scrollToLatest = () => {
    const el = listRef.current;
    el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setPinnedToBottom(true);
  };

  const onlyWelcome = messages.length === 1;
  const contextSuggestions = context
    ? [
        `Tell me about ${context.name}.`,
        'What are the opening hours?',
        'How can I contact them?',
        'Show similar businesses nearby.',
      ]
    : undefined;

  return (
    <motion.div
      ref={rootRef}
      role="dialog"
      aria-modal={isDesktop ? 'false' : 'true'}
      aria-labelledby="chat-title"
      aria-describedby="chat-mode"
      initial={{ opacity: 0, y: 24, scale: isDesktop ? 0.97 : 1 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: isDesktop ? 0.97 : 1 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-cream lg:inset-auto lg:bottom-6 lg:right-6 lg:h-[min(680px,calc(100vh-7rem))] lg:w-[420px] lg:rounded-[1.6rem] lg:shadow-lift lg:ring-1 lg:ring-navy/10"
      style={{ transformOrigin: 'bottom right' }}
    >
      {/* Header */}
      <div className="relative overflow-hidden bg-navy px-4 pb-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] text-white">
        <div
          className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-ocean/40 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-3">
          <LogoMark tone="light" className="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <h2 id="chat-title" className="text-base font-extrabold text-white">
              AI Bajan
            </h2>
            <p id="chat-mode" className="flex items-center gap-1.5 text-xs text-white/75">
              <span
                className={`h-2 w-2 rounded-full ${IS_DEMO ? 'bg-coral' : 'bg-lagoon'}`}
                aria-hidden="true"
              />
              {IS_DEMO
                ? 'Demo mode · answers from sample listings, not a live AI'
                : 'Answers backed by Barbadian sources'}
            </p>
          </div>
          <div className="flex items-center">
            <button
              type="button"
              onClick={clear}
              disabled={onlyWelcome && !context}
              className="grid h-10 w-10 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-40"
              aria-label="Start a new conversation"
              title="New conversation"
            >
              <RotateCcw className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={minimizeChat}
              className="hidden h-10 w-10 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white lg:grid"
              aria-label="Minimize chat"
              title="Minimize"
            >
              <Minus className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={closeChat}
              className="grid h-10 w-10 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Close chat"
              title="Close"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
        {context && (
          <div className="relative mt-3 flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-sm">
            <Store className="h-4 w-4 shrink-0 text-lagoon" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">
              Asking about <strong className="font-bold">{context.name}</strong>
            </span>
            <button
              type="button"
              onClick={() => setContext(null)}
              className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/15"
              aria-label={`Stop asking about ${context.name}`}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {/* Conversation */}
      <div className="relative min-h-0 flex-1">
        <ol
          ref={listRef}
          onScroll={onScroll}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Conversation"
          className="h-full space-y-4 overflow-y-auto overscroll-contain px-4 py-5"
        >
          {messages.map((m) => (
            <ChatMessage
              key={m.id}
              message={m}
              onRetry={retry}
              onFollowUp={sendFromChip}
              disabled={pending}
              onNavigate={() => !isDesktop && minimizeChat()}
            />
          ))}
          {onlyWelcome && !pending && (
            <li>
              <ChatSuggestions
                suggestions={contextSuggestions}
                onSelect={sendFromChip}
                disabled={pending}
              />
            </li>
          )}
          {pending && <TypingIndicator />}
        </ol>
        {!pinnedToBottom && (
          <button
            type="button"
            onClick={scrollToLatest}
            className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-navy px-3.5 py-2 text-xs font-bold text-white shadow-card"
          >
            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
            Jump to latest
          </button>
        )}
      </div>

      <div className="pb-[env(safe-area-inset-bottom)]">
        <ChatComposer ref={composerRef} onSend={send} pending={pending} />
      </div>
    </motion.div>
  );
}
