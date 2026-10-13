import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Clock, Search } from 'lucide-react';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { useUI } from '@/hooks/useUI';
import { useChatbot } from '@/hooks/useChatbot';
import { useAssistant } from '@/hooks/useAssistant';

const rise = (delay) => ({
  initial: { opacity: 0, y: 26 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] },
});

export const HERO_ASK_ID = 'ask';
const EXAMPLES = ['What are Bajan fish cakes?', 'Why is Barbados called Little England?', 'How do I renew a Barbados passport?'];

/**
 * The homepage's single place to ask AI Bajan a question. While the assistant is not yet connected
 * to its AI model the box is shown but disabled, with an honest "coming soon" note.
 */
function AskBox() {
  const { openChat } = useUI();
  const { send } = useChatbot();
  const { available, loading } = useAssistant();
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  // "Start asking" / "Ask AI Bajan" links point at /#ask: bring the box into view and focus it.
  const location = useLocation();
  useEffect(() => {
    if (location.hash !== `#${HERO_ASK_ID}`) return;
    document.getElementById(HERO_ASK_ID)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    inputRef.current?.focus({ preventScroll: true });
  }, [location.key, location.hash]);

  const ask = (text) => {
    const q = text.trim();
    if (!q || !available) return;
    openChat();
    send(q);
    setValue('');
  };

  return (
    <div id={HERO_ASK_ID} className="scroll-mt-32">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(value);
        }}
        className="flex flex-col gap-2 rounded-[1.75rem] bg-white p-2 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.55)] sm:flex-row sm:items-center sm:rounded-full"
        role="search"
        aria-label="Ask AI Bajan"
      >
        <label htmlFor="hero-question" className="sr-only">
          What would you like to know about Barbados?
        </label>
        <div className="flex min-w-0 flex-1 items-center gap-3 px-4">
          <Search className="h-5 w-5 shrink-0 text-ocean" aria-hidden="true" />
          <input
            ref={inputRef}
            id="hero-question"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={1000}
            disabled={!available}
            placeholder="What would you like to know about Barbados?"
            className="h-14 min-w-0 flex-1 bg-transparent text-base text-navy placeholder:text-navy/50 focus:outline-none disabled:cursor-not-allowed sm:text-lg"
            aria-describedby="hero-ask-help"
          />
        </div>
        <button
          type="submit"
          disabled={!available || !value.trim()}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-coral px-7 text-base font-extrabold text-navy transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Ask AI Bajan <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </form>

      {!available && !loading ? (
        <p id="hero-ask-help" className="mt-4 flex items-start gap-2 text-sm text-white/80">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-lagoon" aria-hidden="true" />
          AI Bajan is being connected to its AI model and Barbadian sources. Questions open here
          soon — answers will cite where the information comes from.
        </p>
      ) : (
        <div id="hero-ask-help" className="mt-4 flex flex-wrap items-center gap-2 text-sm text-white/80">
          <span>Try asking:</span>
          {EXAMPLES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => ask(q)}
              disabled={!available}
              className="rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 font-semibold text-white hover:bg-white/20 disabled:opacity-60"
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function HeroSection() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-[100svh] flex-col justify-center overflow-hidden bg-navy-900 md:min-h-[820px]"
    >
      <ImageWithFallback imageKey="heroBarbados" priority sizes="100vw" className="absolute inset-0 -z-20 !bg-navy-900" />
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-t from-navy-900/95 via-navy-900/60 to-navy-900/45 md:bg-gradient-to-r md:from-navy-900/90 md:via-navy-900/55 md:to-navy-900/10"
        aria-hidden="true"
      />

      <div className="container-page pb-16 md:pb-20" style={{ paddingTop: 'calc(var(--chrome-h, 108px) + 3rem)' }}>
        <div className="max-w-3xl">
          <motion.p {...rise(0.05)} className="eyebrow eyebrow-light mb-5">
            Barbados knowledge, clearly answered
          </motion.p>
          <motion.h1
            {...rise(0.12)}
            id="hero-title"
            className="text-hero font-display font-normal leading-[1.02] text-white text-balance"
          >
            Ask Barbados. <br className="hidden sm:block" />
            Get a <em className="italic text-lagoon">Bajan Answer.</em>
          </motion.h1>
          <motion.p {...rise(0.22)} className="mt-6 max-w-2xl text-lead text-white/85 text-pretty">
            Ask about Barbados—our history, culture, food, people, places, businesses, government
            services and everyday life. AI Bajan provides clear answers supported by reliable
            Barbadian sources.
          </motion.p>
        </div>
        <motion.div {...rise(0.32)} className="mt-9 max-w-3xl">
          <AskBox />
        </motion.div>
      </div>
    </section>
  );
}
