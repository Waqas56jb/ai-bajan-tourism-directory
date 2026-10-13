import { ArrowRight, HeartHandshake, MapPinned, Sparkles } from 'lucide-react';
import { useAllBusinesses } from '@/hooks/useBusinesses';
import { routes } from '@/lib/routes';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { Button } from '@/components/common/Button';
import { BusinessCard } from '@/components/directory/BusinessCard';
import { BusinessGridSkeleton } from '@/components/common/Skeleton';
import { Reveal } from '@/components/common/Reveal';

/** Small, independent businesses — selected by business type rather than promotion. */
const INDEPENDENT_TYPES = new Set([
  'Guesthouse',
  'Café',
  'Craft & Art',
  'Market',
  'Music & Dance',
  'Seafood',
]);

export function LocalGems() {
  const { data, isPending, isError } = useAllBusinesses();
  const gems = (data ?? [])
    .filter((b) => INDEPENDENT_TYPES.has(b.businessType) && !b.isSponsored)
    .slice(0, 3);

  return (
    <section aria-labelledby="gems-heading" className="section-y">
      <div className="container-page grid items-start gap-12 lg:grid-cols-[1fr_1.35fr] lg:gap-16">
        <Reveal className="relative lg:sticky lg:top-28">
          <ImageWithFallback
            imageKey="craftMarket"
            aspect="aspect-[4/5]"
            className="rounded-card shadow-card"
            sizes="(min-width: 1024px) 40vw, 100vw"
          />
          <div className="absolute -bottom-6 -right-2 w-[58%] overflow-hidden rounded-card border-[6px] border-cream shadow-lift sm:-right-6">
            <ImageWithFallback imageKey="mangoesRed" aspect="aspect-square" sizes="25vw" />
          </div>
          <span className="absolute -left-3 top-8 rotate-[-4deg] rounded-full bg-coral px-4 py-2 text-sm font-extrabold text-navy-900 shadow-card">
            Made & run locally
          </span>
        </Reveal>

        <div>
          <p className="eyebrow mb-4">Discover local gems</p>
          <h2 className="text-section font-display font-normal text-balance">
            More than the usual tourist trail.
          </h2>
          <p className="mt-5 text-lead text-muted">
            Some of the best of Barbados is small and easy to miss — a family guesthouse, a fish
            shack, a maker’s studio. AI Bajan brings these independent businesses into the same
            search as the big names, so you can find them by area and support the island’s own.
          </p>
          <ul className="mt-7 grid gap-4 sm:grid-cols-3">
            {[
              { icon: MapPinned, text: 'Search by town or parish' },
              { icon: HeartHandshake, text: 'Find independent businesses' },
              { icon: Sparkles, text: 'Ask the AI assistant' },
            ].map(({ icon: I, text }) => (
              <li
                key={text}
                className="flex items-center gap-3 rounded-2xl bg-white p-3 text-sm font-bold text-navy shadow-soft"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ocean/10 text-ocean-700">
                  <I className="h-5 w-5" aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
          <div className="mt-8">
            {isPending ? (
              <BusinessGridSkeleton count={2} layout="list" />
            ) : isError ? null : (
              <ul className="grid gap-4">
                {gems.map((b) => (
                  <li key={b.id}>
                    <BusinessCard business={b} layout="list" />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button
            to={routes.businesses()}
            variant="primary"
            size="lg"
            className="mt-8"
            iconRight={<ArrowRight className="h-5 w-5" aria-hidden="true" />}
          >
            Browse the directory
          </Button>
        </div>
      </div>
    </section>
  );
}
