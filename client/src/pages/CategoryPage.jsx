import { Link, useParams } from 'react-router-dom';
import { MessageCircle, Sparkles } from 'lucide-react';
import { categories, categoryBySlug } from '@/data/categories';
import { sponsoredPlacements } from '@/data/sponsoredPlacements';
import { useAllBusinesses } from '@/hooks/useBusinesses';
import { useUI } from '@/hooks/useUI';
import { routes } from '@/lib/routes';
import { Seo } from '@/lib/seo';
import { breadcrumbJsonLd } from '@/lib/structuredData';
import { PageHero } from '@/components/layout/PageContainer';
import { DirectoryExplorer } from '@/components/directory/DirectoryExplorer';
import { BusinessCard } from '@/components/directory/BusinessCard';
import { SectionHeading } from '@/components/common/SectionHeading';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { Icon } from '@/components/common/Icon';
import { PromoBanner } from '@/components/home/SponsoredBusinesses';
import NotFoundPage from './NotFoundPage';

/** Related categories: hand-picked pairings that make sense for trip planning. */
const RELATED = {
  restaurants: ['shopping', 'culture', 'hotels'],
  hotels: ['restaurants', 'transportation', 'wellness'],
  tours: ['attractions', 'transportation', 'restaurants'],
  attractions: ['tours', 'culture', 'restaurants'],
  shopping: ['culture', 'restaurants', 'attractions'],
  transportation: ['hotels', 'tours', 'attractions'],
  culture: ['attractions', 'shopping', 'tours'],
  wellness: ['hotels', 'restaurants', 'attractions'],
};

export default function CategoryPage() {
  const { slug } = useParams();
  const category = categoryBySlug[slug];
  const { openChat } = useUI();
  const { data } = useAllBusinesses();

  if (!category)
    return (
      <NotFoundPage
        title="Category not found"
        message="We couldn’t find that category. Try one of these instead."
      />
    );

  const featured = (data ?? [])
    .filter((b) => (b.categories ?? [b.category]).includes(slug) && (b.isFeatured || b.isSponsored))
    .slice(0, 3);
  const placement =
    sponsoredPlacements.find(
      (p) => p.type === 'banner' && data?.find((b) => b.slug === p.businessSlug)?.category === slug,
    ) ?? sponsoredPlacements.find((p) => p.type === 'category' && p.categorySlug === slug);
  const crumbs = [
    { label: 'Home', to: '/' },
    { label: 'Businesses', to: '/businesses' },
    { label: category.name },
  ];

  return (
    <>
      <Seo
        title={category.name}
        description={`${category.description} Browse ${category.name.toLowerCase()} across Barbados on AI Bajan.`}
        path={routes.category(slug)}
        imageKey={category.heroImage}
        jsonLd={breadcrumbJsonLd(crumbs)}
      />
      <PageHero
        imageKey={category.heroImage}
        breadcrumbs={crumbs}
        eyebrow={category.tagline}
        title={category.name}
        description={category.intro}
        badge={
          <span className="mb-5 inline-grid h-12 w-12 place-items-center rounded-2xl bg-white/15 text-white ring-1 ring-white/30 backdrop-blur">
            <Icon name={category.icon} className="h-6 w-6" />
          </span>
        }
      />

      {featured.length > 0 && (
        <section aria-labelledby="cat-featured" className="container-page pt-16 md:pt-20">
          <SectionHeading
            id="cat-featured"
            eyebrow="Featured & sponsored"
            title={`Standout ${category.shortName.toLowerCase()}`}
            description="Promoted listings are labelled — they’re advertising, not reviews."
          />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((b) => (
              <BusinessCard key={b.id} business={b} className="h-full" />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="cat-all" className="container-page py-16 md:py-20">
        <h2 id="cat-all" className="mb-8 font-display text-section font-normal">
          All {category.shortName.toLowerCase()}
        </h2>
        <DirectoryExplorer
          fixed={{ category: slug }}
          searchPlaceholder={`Search ${category.shortName.toLowerCase()} by name, keyword or place`}
          anchorId="category-results"
        />
      </section>

      {/* AI prompts for this category */}
      <section aria-labelledby="cat-ai" className="bg-navy py-16 text-white md:py-20">
        <div className="container-page grid items-center gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="eyebrow eyebrow-light mb-4">Ask AI Bajan</p>
            <h2 id="cat-ai" className="font-display text-section font-normal text-white">
              Not sure where to start?
            </h2>
            <p className="mt-4 text-white/75">
              Ask the assistant to search {category.name.toLowerCase()} by area, amenity or type.
            </p>
          </div>
          <ul className="grid gap-3">
            {category.aiPrompts.map((p) => (
              <li key={p}>
                <button
                  type="button"
                  onClick={() => openChat({ prompt: p, business: null })}
                  className="group flex w-full items-center gap-3 rounded-2xl bg-white/5 px-5 py-4 text-left font-semibold ring-1 ring-white/15 transition-colors hover:bg-white hover:text-navy"
                >
                  <Sparkles className="h-5 w-5 shrink-0 text-coral" aria-hidden="true" />
                  <span className="flex-1">{p}</span>
                  <MessageCircle
                    className="h-5 w-5 shrink-0 text-lagoon opacity-60 group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {placement && (
        <section aria-label="Sponsored" className="container-page pt-16 md:pt-20">
          <PromoBanner placement={placement} />
        </section>
      )}

      <section aria-labelledby="cat-related" className="container-page py-16 md:py-24">
        <SectionHeading
          id="cat-related"
          eyebrow="Related categories"
          title="Plan the rest of your trip"
        />
        <ul className="grid gap-5 sm:grid-cols-3">
          {RELATED[slug]
            .map((s) => categories.find((c) => c.slug === s))
            .map((c) => (
              <li key={c.slug}>
                <Link
                  to={routes.category(c.slug)}
                  className="img-zoom group relative block overflow-hidden rounded-card"
                >
                  <ImageWithFallback
                    imageKey={c.image}
                    decorative
                    aspect="aspect-[16/10]"
                    sizes="(min-width: 640px) 33vw, 100vw"
                  />
                  <span
                    className="absolute inset-0 bg-gradient-to-t from-navy-900/85 to-transparent"
                    aria-hidden="true"
                  />
                  <span className="absolute inset-x-0 bottom-0 p-5">
                    <span className="block text-xl font-extrabold text-white">{c.name}</span>
                    <span className="block text-sm text-white/80">{c.tagline}</span>
                  </span>
                </Link>
              </li>
            ))}
        </ul>
      </section>
    </>
  );
}
