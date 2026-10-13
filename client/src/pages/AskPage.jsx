import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Landmark, RotateCcw, ShieldCheck, Utensils, MapPinned, Building2, Sparkles } from 'lucide-react';
import { Seo } from '@/lib/seo';
import { useChatbot } from '@/hooks/useChatbot';
import { LogoMark } from '@/components/common/Logo';
import { HeroBackdrop } from '@/components/home/HeroBackdrop';
import { AskBox } from '@/components/home/HeroSection';
import { ChatMessage } from '@/components/chatbot/ChatMessage';
import { ChatComposer } from '@/components/chatbot/ChatComposer';

const TOPICS = [
  { icon: Landmark, label: 'History', q: 'When did Barbados become independent?' },
  { icon: Utensils, label: 'Food', q: 'What are Bajan fish cakes?' },
  { icon: Sparkles, label: 'Culture', q: 'What is Crop Over?' },
  { icon: Building2, label: 'Government', q: 'How do I apply for a Barbados passport?' },
  { icon: MapPinned, label: 'Places', q: 'What is Harrison’s Cave?' },
  { icon: BookOpen, label: 'Everyday life', q: 'Do taxis in Barbados have meters?' },
];

function Typing() {
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
 * Ask AI Bajan — full-page conversation with the RAG assistant. Shares the conversation with the
 * floating widget, so a chat started anywhere continues here.
 */
export default function AskPage() {
  const { messages, pending, send, retry, clear } = useChatbot();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const listRef = useRef(null);
  const composerRef = useRef(null);
  const handled = useRef(null);
  const conversation = messages.filter((m) => m.id !== 'welcome');
  const started = conversation.length > 0;

  // A question passed from the homepage (/ask?q=…) is asked once, then removed from the URL.
  useEffect(() => {
    const q = params.get('q');
    if (q && handled.current !== q) {
      handled.current = q;
      send(q);
      setParams({}, { replace: true });
    }
  }, [params, send, setParams]);

  // Keep the latest message in view.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length, pending]);

  useEffect(() => {
    if (started) composerRef.current?.focus({ preventScroll: true });
  }, [started]);

  return (
    <section aria-labelledby="ask-title" className="relative isolate min-h-[100svh] overflow-hidden">
      <Seo path="/ask" title="Ask AI Bajan" description="Ask anything about Barbados — history, culture, food, places, businesses, government services and everyday life — and get clear answers with sources." />
      <HeroBackdrop />
      <div className="container-page flex min-h-[100svh] flex-col pb-8" style={{ paddingTop: 'calc(var(--chrome-h, 88px) + 1.5rem)' }}>
        {!started ? (
          <div className="flex flex-1 flex-col justify-center py-10">
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-5 flex items-center gap-4 text-xs font-extrabold uppercase tracking-[0.22em] text-lagoon sm:text-sm">
              <span className="h-px w-10 bg-lagoon" aria-hidden="true" />
              Ask AI Bajan
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              id="ask-title"
              className="max-w-3xl font-display text-[2.8rem] leading-[1.04] text-white sm:text-[4rem]"
            >
              Ask Barbados. Get a <em className="italic text-lagoon">Bajan Answer.</em>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="mt-5 max-w-2xl text-lg text-white/85">
              Ask about our history, culture, food, people, places, businesses, government services and
              everyday life. Every answer shows the Barbadian sources it comes from.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="mt-9 max-w-3xl">
              <AskBox onAsk={send} autoFocus examples={[]} inputId="ask-question" />
            </motion.div>
            <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="mt-8 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Suggested questions">
              {TOPICS.map(({ icon: Icon, label, q }) => (
                <li key={label}>
                  <button
                    type="button"
                    onClick={() => send(q)}
                    className="group flex h-full w-full items-start gap-3 rounded-2xl border border-white/15 bg-white/[0.07] p-4 text-left backdrop-blur-sm transition hover:border-lagoon/60 hover:bg-white/[0.12]"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-lagoon/15 text-lagoon">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-xs font-extrabold uppercase tracking-wider text-lagoon">{label}</span>
                      <span className="mt-0.5 block font-semibold text-white">{q}</span>
                    </span>
                  </button>
                </li>
              ))}
            </motion.ul>
            <p className="mt-8 flex items-center gap-2 text-sm text-white/65">
              <ShieldCheck className="h-4 w-4 text-lagoon" aria-hidden="true" />
              Answers come from approved Barbadian sources. AI Bajan won’t guess when it doesn’t know.
            </p>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h1 id="ask-title" className="font-display text-3xl text-white sm:text-4xl">
                Ask <em className="italic text-lagoon">AI Bajan</em>
              </h1>
              <button
                type="button"
                onClick={() => {
                  clear();
                  navigate('/ask', { replace: true });
                }}
                className="inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                New conversation
              </button>
            </div>
            <div className="flex min-h-[60svh] flex-1 flex-col overflow-hidden rounded-[1.75rem] bg-cream shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] ring-1 ring-white/10">
              <ol
                ref={listRef}
                className="flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-8"
                style={{ maxHeight: 'calc(100svh - var(--chrome-h, 88px) - 15rem)' }}
                aria-live="polite"
                aria-label="Conversation"
              >
                {conversation.map((m) => (
                  <ChatMessage key={m.id} message={m} onRetry={retry} onFollowUp={send} disabled={pending} />
                ))}
                {pending && <Typing />}
              </ol>
              <ChatComposer ref={composerRef} onSend={send} pending={pending} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
