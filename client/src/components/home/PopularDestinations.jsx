import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useEmblaCarousel from 'embla-carousel-react';
import { ArrowRight, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { destinations } from '@/data/destinations';
import { routes } from '@/lib/routes';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { SectionHeading } from '@/components/common/SectionHeading';

/** "Popular places in Barbados" — Embla carousel with keyboard-accessible controls. */
export function PopularDestinations() {
  const [emblaRef, embla] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: false,
  });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const onSelect = useCallback(() => {
    if (!embla) return;
    setCanPrev(embla.canScrollPrev());
    setCanNext(embla.canScrollNext());
  }, [embla]);

  useEffect(() => {
    if (!embla) return undefined;
    onSelect();
    embla.on('select', onSelect).on('reInit', onSelect);
    return () => embla.off('select', onSelect).off('reInit', onSelect);
  }, [embla, onSelect]);

  const navBtn =
    'grid h-12 w-12 place-items-center rounded-full border border-navy/15 bg-white text-navy transition-colors hover:border-navy hover:bg-navy hover:text-white disabled:pointer-events-none disabled:opacity-35';

  return (
    <section aria-labelledby="destinations-heading" className="section-y overflow-hidden">
      <div className="container-page">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHeading
            id="destinations-heading"
            eyebrow="Popular places"
            title="Where Will You Wander?"
            description="From the capital’s heritage streets to the wild Atlantic coast — every corner of the island has its own character."
            className="!mb-0"
          />
          <div className="flex gap-2" role="group" aria-label="Carousel controls">
            <button
              type="button"
              className={navBtn}
              onClick={() => embla?.scrollPrev()}
              disabled={!canPrev}
              aria-label="Previous places"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={navBtn}
              onClick={() => embla?.scrollNext()}
              disabled={!canNext}
              aria-label="Next places"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="mt-10 md:mt-14" ref={emblaRef}>
          <ul className="-ml-4 flex touch-pan-y md:-ml-6" aria-label="Destinations">
            {destinations.map((d) => (
              <li
                key={d.slug}
                className="min-w-0 shrink-0 grow-0 basis-[82%] pl-4 sm:basis-1/2 md:pl-6 lg:basis-1/3 xl:basis-1/4"
              >
                <Link
                  to={routes.destination(d.slug)}
                  className="img-zoom group relative block overflow-hidden rounded-card shadow-card"
                >
                  <ImageWithFallback
                    imageKey={d.image}
                    decorative
                    aspect="aspect-[3/4]"
                    sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 82vw"
                  />
                  <span
                    className="absolute inset-0 bg-gradient-to-t from-navy-900/90 via-navy-900/20 to-transparent"
                    aria-hidden="true"
                  />
                  <span className="absolute inset-x-0 bottom-0 p-6">
                    <span className="mb-2 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.14em] text-lagoon">
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      {d.type === 'parish' ? 'Parish' : d.region}
                    </span>
                    <span className="block font-display text-3xl text-white">{d.name}</span>
                    <span className="mt-1.5 block text-sm text-white/80">{d.caption}</span>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-white">
                      Explore {d.name}
                      <ArrowRight
                        className="h-4 w-4 transition-transform group-hover:translate-x-1"
                        aria-hidden="true"
                      />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
