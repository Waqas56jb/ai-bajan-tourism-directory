import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { routes } from '@/lib/routes';
import { HeroBackdrop } from './HeroBackdrop';

const rise = (delay) => ({
  initial: { opacity: 0, y: 26 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] },
});

const HERO_EXAMPLES = ['What are Bajan fish cakes?', 'Why is Barbados called Little England?'];

/** Large question box + "Try asking" chips. `onAsk(question)` decides what happens on submit. */
export function AskBox({ onAsk, disabled = false, autoFocus = false, examples = HERO_EXAMPLES, inputId = 'hero-question' }) {
  const [value, setValue] = useState('');
  const submit = (text) => {
    const q = text.trim();
    if (!q || disabled) return;
    onAsk(q);
    setValue('');
  };
  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        className="flex items-center gap-2 rounded-[1.6rem] bg-white p-2 pl-5 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)] sm:rounded-full"
        role="search"
        aria-label="Ask AI Bajan"
      >
        <Search className="h-5 w-5 shrink-0 text-ocean" aria-hidden="true" />
        <label htmlFor={inputId} className="sr-only">
          What would you like to know about Barbados?
        </label>
        <input
          id={inputId}
          type="text"
          value={value}
          autoFocus={autoFocus}
          maxLength={1000}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          placeholder="What would you like to know about Barbados?"
          className="h-12 min-w-0 flex-1 bg-transparent text-base text-navy placeholder:text-navy/50 focus:outline-none sm:h-14 sm:text-lg"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-coral px-4 text-[0.95rem] font-extrabold text-navy transition hover:brightness-105 disabled:cursor-not-allowed sm:h-14 sm:px-7 sm:text-lg"
        >
          <span className="hidden sm:inline">Ask AI Bajan</span>
          <span className="sm:hidden">Ask</span>
          <span aria-hidden="true">→</span>
        </button>
      </form>
      {examples.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-white/80">
          <span>Try asking:</span>
          {examples.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => submit(q)}
              disabled={disabled}
              className="rounded-full border border-white/25 bg-white/5 px-4 py-2 font-semibold text-white transition hover:bg-white/15 disabled:opacity-60"
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
  const navigate = useNavigate();
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-[100svh] flex-col justify-center overflow-hidden md:min-h-[820px]"
    >
      <HeroBackdrop />
      <div className="container-page pb-16 md:pb-20" style={{ paddingTop: 'calc(var(--chrome-h, 88px) + 3.5rem)' }}>
        <div className="max-w-3xl">
          <motion.p {...rise(0.05)} className="mb-6 flex items-center gap-4 text-xs font-extrabold uppercase tracking-[0.22em] text-lagoon sm:text-sm">
            <span className="h-px w-10 bg-lagoon" aria-hidden="true" />
            Barbados knowledge, clearly answered
          </motion.p>
          <motion.h1
            {...rise(0.12)}
            id="hero-title"
            className="font-display text-[3.1rem] leading-[1.02] text-white sm:text-[4.5rem] lg:text-[5.25rem]"
          >
            Ask Barbados.
            <br />
            Get a <em className="italic text-lagoon">Bajan</em>
            <br />
            <em className="italic text-lagoon">Answer.</em>
          </motion.h1>
          <motion.p {...rise(0.22)} className="mt-7 max-w-2xl text-lg leading-relaxed text-white/90 sm:text-xl">
            Ask about our history, culture, food, people, places, businesses, government services and
            everyday life. AI Bajan gives clear answers supported by reliable Barbadian sources.
          </motion.p>
        </div>
        <motion.div {...rise(0.32)} className="mt-10 max-w-3xl">
          <AskBox onAsk={(q) => navigate(routes.ask(q))} />
        </motion.div>
      </div>
    </section>
  );
}
