import { Link } from 'react-router-dom';
import { ArrowRight, Info } from 'lucide-react';
import { sponsoredPlacements } from '@/data/sponsoredPlacements';
import { categoryBySlug } from '@/data/categories';
import { destinationBySlug } from '@/data/destinations';
import { useAllBusinesses } from '@/hooks/useBusinesses';
import { routes } from '@/lib/routes';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { Badge } from '@/components/common/Badge';
import { BusinessCard } from '@/components/directory/BusinessCard';
import { SectionHeading } from '@/components/common/SectionHeading';
import { Reveal } from '@/components/common/Reveal';

function placementHref(p) {
  if (p.businessSlug) return routes.business(p.businessSlug);
  if (p.categorySlug) return routes.category(p.categorySlug);
  if (p.destinationSlug) return routes.destination(p.destinationSlug);
  return routes.businesses();
}

/** Banner placement — always labelled. */
export function PromoBanner({ placement }) {
  if (!placement) return null;
  return (
    <Link
      to={placementHref(placement)}
      className="img-zoom group relative block overflow-hidden rounded-card bg-navy shadow-card"
    >
      <ImageWithFallback
        imageKey={placement.image}
        decorative
        aspect="aspect-[4/5] sm:aspect-[21/9]"
        sizes="(min-width: 1024px) 66vw, 100vw"
      />
      <span
        className="absolute inset-0 bg-gradient-to-r from-navy-900/90 via-navy-900/55 to-transparent"
        aria-hidden="true"
      />
      <span className="absolute inset-0 flex flex-col justify-end p-6 sm:justify-center sm:p-10">
        <Badge
          variant={placement.label === 'Sponsored' ? 'sponsored' : 'featured'}
          className="w-fit"
        >
          {placement.label}
        </Badge>
        <span className="mt-4 block max-w-md font-display text-3xl leading-tight text-white md:text-5xl">
          {placement.headline}
        </span>
        <span className="mt-3 block max-w-md text-white/80">{placement.body}</span>
        <span className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-navy transition-colors group-hover:bg-coral">
          {placement.cta}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </span>
    </Link>
  );
}

/**
 * Advertising area. Every element shown here is driven by data flags / placement records and
 * carries a visible "Sponsored" or "Featured" label.
 */
export function SponsoredBusinesses() {
  const { data } = useAllBusinesses();
  const banner = sponsoredPlacements.find((p) => p.type === 'banner');
  const destinationPlacement = sponsoredPlacements.find((p) => p.type === 'destination');
  const categoryPlacement = sponsoredPlacements.find((p) => p.type === 'category');
  const sponsored = (data ?? [])
    .filter((b) => b.isSponsored && b.slug !== banner?.businessSlug)
    .slice(0, 2);

  return (
    <section aria-labelledby="sponsored-heading" className="section-y bg-sand">
      <div className="container-page">
        <SectionHeading
          id="sponsored-heading"
          eyebrow="Partners & promotions"
          title="Spotlight on Island Businesses"
          description="Promoted placements from businesses that advertise with AI Bajan. Paid placements are always labelled."
          action={{ label: 'What does sponsored mean?', to: '/faq#sponsored-meaning' }}
        />

        <div className="grid gap-6 lg:grid-cols-3">
          <Reveal className="lg:col-span-2">
            <PromoBanner placement={banner} />
          </Reveal>
          {destinationPlacement && (
            <Reveal delay={0.08}>
              <Link
                to={placementHref(destinationPlacement)}
                className="img-zoom group relative flex h-full min-h-[320px] flex-col justify-end overflow-hidden rounded-card shadow-card"
              >
                <ImageWithFallback
                  imageKey={destinationPlacement.image}
                  decorative
                  className="absolute inset-0"
                  sizes="(min-width: 1024px) 33vw, 100vw"
                />
                <span
                  className="absolute inset-0 bg-gradient-to-t from-navy-900/95 via-navy-900/30 to-transparent"
                  aria-hidden="true"
                />
                <span className="relative p-6">
                  <Badge variant="sponsored">{destinationPlacement.label}</Badge>
                  <span className="mt-3 block text-xs font-bold uppercase tracking-[0.14em] text-lagoon">
                    {destinationBySlug[destinationPlacement.destinationSlug]?.name}
                  </span>
                  <span className="mt-1 block font-display text-3xl text-white">
                    {destinationPlacement.headline}
                  </span>
                  <span className="mt-2 block text-sm text-white/80">
                    {destinationPlacement.body}
                  </span>
                </span>
              </Link>
            </Reveal>
          )}
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sponsored.map((b, i) => (
            <Reveal key={b.id} delay={i * 0.08}>
              <BusinessCard business={b} className="h-full" />
            </Reveal>
          ))}
          {categoryPlacement && (
            <Reveal delay={0.16} className="md:col-span-2 lg:col-span-1">
              <Link
                to={placementHref(categoryPlacement)}
                className="group flex h-full flex-col justify-between rounded-card bg-navy p-7 text-white shadow-card transition-transform hover:-translate-y-1"
              >
                <div>
                  <Badge variant="glass">{categoryPlacement.label} category</Badge>
                  <p className="mt-5 font-display text-3xl">{categoryPlacement.headline}</p>
                  <p className="mt-2 text-white/75">{categoryPlacement.body}</p>
                </div>
                <div className="mt-8 flex items-center justify-between">
                  <span className="text-sm font-bold text-lagoon">
                    {categoryBySlug[categoryPlacement.categorySlug]?.name}
                  </span>
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-white/10 transition-colors group-hover:bg-coral group-hover:text-navy-900">
                    <ArrowRight className="h-5 w-5" aria-hidden="true" />
                  </span>
                </div>
              </Link>
            </Reveal>
          )}
        </div>

        <p className="mt-8 flex items-center gap-2 text-sm text-muted">
          <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
          Sponsored and featured placements are advertising, not independent recommendations.
        </p>
      </div>
    </section>
  );
}
