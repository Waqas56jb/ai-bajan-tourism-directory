import { Link, useParams } from 'react-router-dom';
import { MapPin, Share2 } from 'lucide-react';
import { useBusiness } from '@/hooks/useBusinesses';
import { categoryBySlug } from '@/data/categories';
import { findDestinationForLocation } from '@/data/destinations';
import { routes } from '@/lib/routes';
import { Seo } from '@/lib/seo';
import { breadcrumbJsonLd, localBusinessJsonLd } from '@/lib/structuredData';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { ListingBadges } from '@/components/common/Badge';
import { RatingDisplay } from '@/components/common/RatingDisplay';
import { ErrorState } from '@/components/common/States';
import { Skeleton } from '@/components/common/Skeleton';
import { DemoNotice } from '@/components/common/DemoNotice';
import { BusinessGallery } from '@/components/business/BusinessGallery';
import { BusinessContactCard } from '@/components/business/BusinessContactCard';
import {
  BusinessAmenities,
  BusinessHighlights,
  BusinessLocationMap,
  BusinessOpeningHours,
} from '@/components/business/BusinessDetails';
import { RelatedBusinesses } from '@/components/business/RelatedBusinesses';
import { ShareButton } from '@/components/common/ShareButton';
import NotFoundPage from './NotFoundPage';

function DetailSkeleton() {
  return (
    <div className="container-page py-10" role="status" aria-live="polite">
      <span className="sr-only">Loading business…</span>
      <Skeleton className="h-4 w-72" />
      <Skeleton className="mt-6 h-12 w-2/3 max-w-xl" />
      <Skeleton className="mt-3 h-5 w-48" />
      <Skeleton className="mt-8 aspect-[2.1/1] w-full" />
      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-11/12" />
          <Skeleton className="h-5 w-4/5" />
        </div>
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

export default function BusinessDetailPage() {
  const { slug } = useParams();
  const { data: business, isPending, isError, error, refetch, isFetching } = useBusiness(slug);

  if (isPending) return <DetailSkeleton />;
  if (isError && error?.status === 404) {
    return (
      <NotFoundPage
        title="Business not found"
        message="This listing may have moved or is no longer published. Try searching the directory instead."
      />
    );
  }
  if (isError) {
    return (
      <div className="container-page py-20">
        <ErrorState
          title="We couldn’t load this business"
          message={error?.message}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      </div>
    );
  }

  const category = categoryBySlug[business.category];
  const destination = findDestinationForLocation(business.area);
  const crumbs = [
    { label: 'Home', to: '/' },
    { label: 'Businesses', to: '/businesses' },
    { label: category?.shortName ?? 'Category', to: routes.category(business.category) },
    { label: business.name },
  ];

  return (
    <>
      <Seo
        title={`${business.name} — ${category?.shortName ?? ''} in ${business.area}`}
        description={business.shortDescription}
        path={routes.business(business.slug)}
        imageKey={business.images?.[0]}
        type="business.business"
        noindex={business.demoContent}
        jsonLd={[breadcrumbJsonLd(crumbs), localBusinessJsonLd(business)]}
      />

      <article>
        <header className="container-page pt-6 md:pt-10">
          <Breadcrumbs items={crumbs} />
          <div className="mt-6 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              <ListingBadges business={business} className="mb-4" />
              <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-ocean-700">
                {category?.name}
                {business.businessType ? ` · ${business.businessType}` : ''}
              </p>
              <h1 className="mt-2 font-display text-page font-normal text-balance">
                {business.name}
              </h1>
              <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-muted">
                <MapPin className="h-4 w-4 text-coral-600" aria-hidden="true" />
                <span>
                  {business.area}, {business.parish}
                </span>
              </p>
              <RatingDisplay
                rating={business.rating}
                count={business.reviewCount}
                source={business.ratingSource}
                className="mt-3"
              />
            </div>
            <ShareButton title={business.name} icon={Share2} />
          </div>
          {business.demoContent && (
            <DemoNotice className="mt-6 max-w-3xl">
              This is a fictional demo listing used to preview the AI Bajan directory. It is not a
              real business.
            </DemoNotice>
          )}
        </header>

        <div className="container-page mt-8">
          <BusinessGallery images={business.images} name={business.name} />
        </div>

        <div className="container-page mt-10 grid gap-12 pb-20 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16">
          <div className="min-w-0 space-y-12">
            <section aria-labelledby="about-heading">
              <h2 id="about-heading" className="text-xl font-extrabold">
                About {business.name}
              </h2>
              <p className="mt-4 max-w-prose text-lead leading-relaxed text-ink/85">
                {business.description}
              </p>
              <BusinessHighlights items={business.highlights} />
              {business.categories?.length > 1 && (
                <p className="mt-6 text-sm text-muted">
                  Also listed in:{' '}
                  {business.categories
                    .filter((c) => c !== business.category)
                    .map((c) => categoryBySlug[c]?.name)
                    .join(', ')}
                </p>
              )}
            </section>
            <BusinessAmenities items={business.amenities} />
            <BusinessOpeningHours hours={business.openingHours} demo={business.demoContent} />
            <BusinessLocationMap business={business} />
            {destination && (
              <p className="text-muted">
                Exploring the area? Read about{' '}
                <Link
                  className="font-bold text-ocean-700 underline underline-offset-4"
                  to={routes.destination(destination.slug)}
                >
                  {destination.name}
                </Link>
                .
              </p>
            )}
          </div>
          <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Contact information">
            <BusinessContactCard business={business} />
          </aside>
        </div>
      </article>

      <RelatedBusinesses business={business} />
    </>
  );
}
