import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Compass, MessageCircle, Sparkles } from 'lucide-react';
import { destinationBySlug, destinations } from '@/data/destinations';
import { categories } from '@/data/categories';
import { travelGuides } from '@/data/travelGuides';
import { sponsoredPlacements } from '@/data/sponsoredPlacements';
import { useAllBusinesses } from '@/hooks/useBusinesses';
import { useUI } from '@/hooks/useUI';
import { matchesLocation } from '@/lib/search';
import { routes } from '@/lib/routes';
import { Seo } from '@/lib/seo';
import { breadcrumbJsonLd } from '@/lib/structuredData';
import { PageHero } from '@/components/layout/PageContainer';
import { SectionHeading } from '@/components/common/SectionHeading';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { EmptyState, ErrorState } from '@/components/common/States';
import { BusinessGridSkeleton } from '@/components/common/Skeleton';
import { BusinessList } from '@/components/directory/BusinessList';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { GuideCard } from '@/components/guides/GuideCard';
import { Reveal } from '@/components/common/Reveal';
import { Badge } from '@/components/common/Badge';
import NotFoundPage from './NotFoundPage';

export default function DestinationPage() {
  const { slug } = useParams();
  const destination = destinationBySlug[slug];
  const { openChat } = useUI();
  const { data, isPending, isError, refetch, isFetching } = useAllBusinesses();

  const location = destination ? (destination.filter.area ?? destination.filter.parish) : null;
  const listings = useMemo(
    () => (data && location ? data.filter((b) => matchesLocation(b, location)) : []),
    [data, location],
  );
  const categoryCounts = useMemo(() => {
    const counts = {};
    for (const b of listings) counts[b.category] = (counts[b.category] ?? 0) + 1;
    return categories.filter((c) => counts[c.slug]).map((c) => ({ ...c, count: counts[c.slug] }));
  }, [listings]);

  if (!destination)
    return (
      <NotFoundPage
        title="Place not found"
        message="We couldn’t find that place. Explore one of our destinations instead."
      />
    );

  const guides = travelGuides.filter((g) => g.relatedDestinations.includes(slug)).slice(0, 3);
  const placement = sponsoredPlacements.find(
    (p) => p.type === 'destination' && p.destinationSlug === slug,
  );
  const crumbs = [
    { label: 'Home', to: '/' },
    { label: 'Discover', to: '/discover' },
    { label: destination.name },
  ];
  const shown = [...listings]
    .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a.name.localeCompare(b.name))
    .slice(0, 6);

  return (
    <>
      <Seo
        title={`${destination.name}, Barbados`}
        description={`${destination.caption} ${destination.intro.slice(0, 120)}…`}
        path={routes.destination(slug)}
        imageKey={destination.image}
        jsonLd={breadcrumbJsonLd(crumbs)}
      />
      <PageHero
        imageKey={destination.image}
        breadcrumbs={crumbs}
        eyebrow={
          destination.type === 'parish'
            ? `Parish · ${destination.region}`
            : `${destination.parish} · ${destination.region}`
        }
        title={destination.name}
        description={destination.caption}
        size="lg"
      >
        <div className="flex flex-wrap gap-3">
          <Button to={routes.businesses({ location })} variant="coral" size="lg">
            Browse {destination.name} listings
          </Button>
          <Button
            variant="glass"
            size="lg"
            onClick={() => openChat({ prompt: destination.aiPrompts[0], business: null })}
            iconLeft={<MessageCircle className="h-5 w-5" aria-hidden="true" />}
          >
            Ask about {destination.name}
          </Button>
        </div>
      </PageHero>

      {/* Intro + highlights */}
      <section
        aria-labelledby="dest-intro"
        className="container-page section-y grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20"
      >
        <Reveal>
          <p className="eyebrow mb-4">About {destination.name}</p>
          <h2 id="dest-intro" className="font-display text-section font-normal text-balance">
            {destination.caption}
          </h2>
          <p className="mt-5 text-lead leading-relaxed text-ink/80">{destination.intro}</p>
          <ul className="mt-8 grid gap-4">
            {destination.highlights.map((h, i) => (
              <li key={h.title} className="flex gap-4 rounded-2xl bg-white p-5 shadow-soft">
                <span className="font-display text-3xl leading-none text-coral">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>
                  <span className="block font-extrabold text-navy">{h.title}</span>
                  <span className="mt-1 block text-muted">{h.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.1} className="grid grid-cols-2 gap-4 self-start">
          {destination.gallery.map((key, i) => (
            <ImageWithFallback
              key={key}
              imageKey={key}
              className={`rounded-card shadow-card ${i === 0 ? 'col-span-2' : ''}`}
              aspect={i === 0 ? 'aspect-[16/10]' : 'aspect-square'}
              sizes={i === 0 ? '(min-width: 1024px) 45vw, 100vw' : '(min-width: 1024px) 22vw, 50vw'}
            />
          ))}
          <p className="col-span-2 text-xs text-muted">
            Some photos are illustrative and may not show {destination.name} itself. See photo
            credits on the About page.
          </p>
        </Reveal>
      </section>

      {/* Listings */}
      <section aria-labelledby="dest-listings" className="bg-sand py-16 md:py-24">
        <div className="container-page">
          <SectionHeading
            id="dest-listings"
            eyebrow="In the directory"
            title={`Places to discover in ${destination.name}`}
            action={
              listings.length > 6
                ? { label: `See all ${listings.length}`, to: routes.businesses({ location }) }
                : undefined
            }
          />
          {categoryCounts.length > 0 && (
            <ul
              className="mb-10 flex flex-wrap gap-2"
              aria-label={`Popular categories in ${destination.name}`}
            >
              {categoryCounts.map((c) => (
                <li key={c.slug}>
                  <Link
                    to={routes.businesses({ category: c.slug, location })}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-navy shadow-soft transition-colors hover:bg-navy hover:text-white"
                  >
                    <Icon name={c.icon} className="h-4 w-4" />
                    {c.shortName}
                    <span className="rounded-full bg-sand px-2 text-xs text-muted">{c.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {isPending ? (
            <BusinessGridSkeleton count={3} />
          ) : isError ? (
            <ErrorState
              message="Listings for this area couldn’t be loaded."
              onRetry={() => refetch()}
              retrying={isFetching}
            />
          ) : shown.length ? (
            <BusinessList businesses={shown} />
          ) : (
            <EmptyState
              icon={Compass}
              title={`No listings in ${destination.name} yet`}
              message="The directory doesn’t have businesses here yet. Explore nearby areas or the whole island instead."
            >
              <div className="flex flex-wrap justify-center gap-3">
                <Button to={routes.businesses({ location: destination.parish })} variant="primary">
                  Browse {destination.parish}
                </Button>
                <Button to="/discover" variant="outline">
                  Discover Barbados
                </Button>
              </div>
            </EmptyState>
          )}
        </div>
      </section>

      {placement && data && (
        <section aria-label="Sponsored" className="container-page pt-16 md:pt-20">
          <Link
            to={routes.business(placement.businessSlug)}
            className="img-zoom group relative flex flex-col overflow-hidden rounded-card bg-navy shadow-card sm:flex-row"
          >
            <ImageWithFallback
              imageKey={placement.image}
              decorative
              aspect="aspect-[16/9] sm:aspect-auto"
              className="sm:w-1/2"
              sizes="50vw"
            />
            <span className="flex flex-col justify-center p-8 text-white sm:w-1/2 md:p-12">
              <Badge variant="sponsored" className="w-fit">
                {placement.label}
              </Badge>
              <span className="mt-4 font-display text-4xl">{placement.headline}</span>
              <span className="mt-2 text-white/75">{placement.body}</span>
              <span className="mt-6 font-bold text-lagoon">{placement.cta} →</span>
            </span>
          </Link>
        </section>
      )}

      {/* AI suggestions */}
      <section aria-labelledby="dest-ai" className="container-page section-y">
        <div className="grid gap-8 rounded-[2rem] bg-white p-8 shadow-card md:grid-cols-[1fr_1.3fr] md:p-12">
          <div>
            <p className="eyebrow mb-3">AI Bajan suggestions</p>
            <h2 id="dest-ai" className="font-display text-3xl font-normal md:text-4xl">
              Questions about {destination.name}?
            </h2>
          </div>
          <ul className="grid gap-2.5">
            {destination.aiPrompts.map((p) => (
              <li key={p}>
                <button
                  type="button"
                  onClick={() => openChat({ prompt: p, business: null })}
                  className="flex w-full items-center gap-3 rounded-2xl border border-line px-4 py-3.5 text-left font-semibold text-navy transition-colors hover:border-ocean hover:bg-ocean/5"
                >
                  <Sparkles className="h-4 w-4 shrink-0 text-coral-600" aria-hidden="true" />
                  {p}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {guides.length > 0 && (
        <section aria-labelledby="dest-guides" className="container-page pb-20">
          <SectionHeading
            id="dest-guides"
            eyebrow="Related reading"
            title="Travel guides"
            action={{ label: 'All guides', to: routes.guides() }}
          />
          <div className="grid gap-10 md:grid-cols-3">
            {guides.map((g) => (
              <GuideCard key={g.slug} guide={g} />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="dest-more" className="border-t border-line py-14">
        <div className="container-page">
          <h2 id="dest-more" className="mb-5 text-lg font-extrabold">
            More places in Barbados
          </h2>
          <ul className="flex flex-wrap gap-2">
            {destinations
              .filter((d) => d.slug !== slug)
              .map((d) => (
                <li key={d.slug}>
                  <Link
                    to={routes.destination(d.slug)}
                    className="inline-block rounded-full border border-navy/15 px-4 py-2 text-sm font-semibold text-navy hover:border-navy"
                  >
                    {d.name}
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      </section>
    </>
  );
}
