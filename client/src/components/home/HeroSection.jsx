import { motion } from 'framer-motion';
import { ArrowRight, Compass, MessageCircle } from 'lucide-react';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { Button } from '@/components/common/Button';
import { useUI } from '@/hooks/useUI';
import { HeroSearch } from './HeroSearch';

const rise = (delay) => ({
  initial: { opacity: 0, y: 26 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] },
});

export function HeroSection() {
  const { openChat } = useUI();
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-[100svh] flex-col justify-end overflow-hidden bg-navy-900 md:min-h-[860px] lg:min-h-[max(100svh,820px)]"
    >
      <ImageWithFallback
        imageKey="heroBarbados"
        priority
        sizes="100vw"
        className="absolute inset-0 -z-20 !bg-navy-900"
      />
      {/* Layered overlay: left-weighted for text on desktop, bottom-weighted for mobile */}
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-t from-navy-900/95 via-navy-900/45 to-navy-900/35 md:bg-gradient-to-r md:from-navy-900/85 md:via-navy-900/40 md:to-transparent"
        aria-hidden="true"
      />
      <div
        className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-t from-navy-900/80 to-transparent"
        aria-hidden="true"
      />

      <div
        className="container-page pb-14 md:pb-20"
        style={{ paddingTop: 'calc(var(--chrome-h, 108px) + 3rem)' }}
      >
        <div className="max-w-3xl">
          <motion.p {...rise(0.05)} className="eyebrow eyebrow-light mb-5">
            Barbados · Discover · Explore
          </motion.p>
          <motion.h1
            {...rise(0.12)}
            id="hero-title"
            className="text-hero font-display font-normal leading-[1.02] text-white text-balance"
          >
            Find Your Own Piece of <em className="italic text-lagoon">Paradise.</em>
          </motion.h1>
          <motion.p {...rise(0.22)} className="mt-6 max-w-xl text-lead text-white/85 text-pretty">
            Discover the restaurants, stays, experiences, and local gems that make Barbados
            unforgettable.
          </motion.p>
          <motion.div {...rise(0.3)} className="mt-8 flex flex-wrap gap-3">
            <Button
              to="/discover"
              variant="coral"
              size="lg"
              iconRight={<ArrowRight className="h-5 w-5" aria-hidden="true" />}
            >
              Explore Barbados
            </Button>
            <Button
              variant="glass"
              size="lg"
              onClick={() => openChat()}
              iconLeft={<MessageCircle className="h-5 w-5" aria-hidden="true" />}
            >
              Ask AI Bajan
            </Button>
          </motion.div>
        </div>

        <motion.div {...rise(0.4)} className="mt-12 max-w-5xl md:mt-16">
          <HeroSearch />
        </motion.div>

        <motion.p {...rise(0.5)} className="mt-8 flex items-center gap-2 text-sm text-white/70">
          <Compass className="h-4 w-4 text-lagoon" aria-hidden="true" />
          Independent guesthouses, family kitchens and island makers — all in one directory.
        </motion.p>
      </div>
    </section>
  );
}
