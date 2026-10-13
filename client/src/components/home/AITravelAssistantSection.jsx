import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { useUI } from '@/hooks/useUI';
import { useAllBusinesses } from '@/hooks/useBusinesses';
import { generateMockReply } from '@/lib/chat/mockChatEngine';
import { IS_DEMO } from '@/lib/config';
import { LogoMark } from '@/components/common/Logo';
import { Button } from '@/components/common/Button';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { Reveal } from '@/components/common/Reveal';

const QUESTIONS = [
  'Find restaurants near Holetown.',
  'What family-friendly activities are listed?',
  'Show me guesthouses in Christ Church.',
  'Which businesses offer snorkeling tours?',
  'What information is available about local transport?',
];

const PREVIEW_QUESTION = 'Find restaurants near Holetown.';

/**
 * Introduces the assistant. The preview answer is produced by the same retrieval logic the
 * demo chat uses, over the current listings — it is not a hand-written mock-up.
 */
export function AITravelAssistantSection() {
  const { openChat } = useUI();
  const { data } = useAllBusinesses();
  const preview = useMemo(
    () => (data ? generateMockReply({ message: PREVIEW_QUESTION }, data) : null),
    [data],
  );

  return (
    <section aria-labelledby="ai-heading" className="section-y relative overflow-hidden bg-cream">
      <div
        className="pointer-events-none absolute right-[-10%] top-[-20%] h-[520px] w-[520px] rounded-full bg-lagoon/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-[-25%] left-[-10%] h-[420px] w-[420px] rounded-full bg-coral/15 blur-3xl"
        aria-hidden="true"
      />

      <div className="container-page relative grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <Reveal>
          <p className="eyebrow mb-4">AI travel assistant</p>
          <h2 id="ai-heading" className="text-section font-display font-normal text-balance">
            Your Barbados Questions, <em className="italic text-ocean-700">Answered.</em>
          </h2>
          <p className="mt-5 max-w-xl text-lead text-muted">
            Looking for a restaurant in Holetown, a local tour, or a place to stay? Ask AI Bajan to
            explore the available directory and approved travel information.
          </p>

          <ul className="mt-8 flex flex-wrap gap-2" aria-label="Example questions">
            {QUESTIONS.map((q) => (
              <li key={q}>
                <button
                  type="button"
                  onClick={() => openChat({ prompt: q, business: null })}
                  className="group inline-flex items-center gap-2 rounded-full border border-navy/15 bg-white px-4 py-2.5 text-left text-sm font-semibold text-navy shadow-soft transition-all hover:-translate-y-0.5 hover:border-ocean hover:text-ocean-700"
                >
                  <Sparkles className="h-4 w-4 shrink-0 text-coral-600" aria-hidden="true" />
                  {q}
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Button
              size="lg"
              variant="primary"
              onClick={() => openChat()}
              iconLeft={<MessageCircle className="h-5 w-5" aria-hidden="true" />}
            >
              Open AI Bajan
            </Button>
          </div>
          <p className="mt-6 flex max-w-lg items-start gap-2 text-sm text-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-palm" aria-hidden="true" />
            Answers come from AI Bajan listings and approved content. The assistant doesn’t know
            live opening hours, availability or prices unless a business has supplied them.
            {IS_DEMO && ' This preview runs in demo mode with sample listings.'}
          </p>
        </Reveal>

        {/* Preview */}
        <Reveal delay={0.1} className="relative">
          <div className="animate-float-slow absolute -left-6 -top-6 hidden h-24 w-24 overflow-hidden rounded-3xl shadow-card ring-4 ring-cream sm:block">
            <ImageWithFallback
              imageKey="holetownAerial"
              decorative
              className="h-full w-full"
              sizes="96px"
            />
          </div>
          <div
            className="relative mx-auto max-w-md overflow-hidden rounded-[1.75rem] bg-white shadow-lift ring-1 ring-navy/10"
            aria-label="Example conversation with AI Bajan"
            role="img"
          >
            <div className="flex items-center gap-3 bg-navy px-5 py-4 text-white">
              <LogoMark tone="light" className="h-9 w-9" />
              <div>
                <p className="font-extrabold">AI Bajan</p>
                <p className="text-xs text-white/70">
                  Example answer{IS_DEMO ? ' · demo data' : ''}
                </p>
              </div>
            </div>
            <div className="space-y-4 bg-cream px-5 py-6" aria-hidden="true">
              <p className="ml-auto w-fit max-w-[85%] rounded-3xl rounded-br-lg bg-navy px-4 py-2.5 text-sm text-white">
                {PREVIEW_QUESTION}
              </p>
              <div className="flex gap-2.5">
                <LogoMark className="h-7 w-7 shrink-0" />
                <div className="min-w-0 flex-1 space-y-2.5">
                  <p className="rounded-3xl rounded-tl-lg bg-white px-4 py-3 text-sm text-ink shadow-soft">
                    {preview
                      ? `I found ${preview.businesses.length} ${preview.businesses.length === 1 ? 'match' : 'matches'} for restaurants in Holetown in the directory.`
                      : 'Searching the directory…'}
                  </p>
                  {preview?.businesses.slice(0, 2).map((b, i) => (
                    <motion.div
                      key={b.slug}
                      initial={{ opacity: 0, x: 12 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.25 + i * 0.12, duration: 0.4 }}
                      className="flex gap-3 rounded-2xl border border-line bg-white p-2.5"
                    >
                      <ImageWithFallback
                        imageKey={b.image}
                        decorative
                        className="h-14 w-14 shrink-0 rounded-xl"
                        sizes="56px"
                      />
                      <div className="min-w-0">
                        <p className="text-[0.68rem] font-extrabold uppercase tracking-wide text-ocean-700">
                          {b.categoryName} · {b.area}
                        </p>
                        <p className="truncate font-bold text-navy">{b.name}</p>
                        <p className="truncate text-xs text-muted">{b.shortDescription}</p>
                      </div>
                    </motion.div>
                  ))}
                  <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-muted">
                    Sources · Directory listings
                  </p>
                </div>
              </div>
            </div>
            <div className="border-t border-line bg-white px-4 py-3">
              <div className="flex items-center gap-2 rounded-full bg-cream px-4 py-2.5 text-sm text-muted">
                Ask about places, food, stays…
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
