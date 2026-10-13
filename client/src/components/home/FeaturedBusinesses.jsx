import { ArrowRight } from 'lucide-react';
import { useAllBusinesses } from '@/hooks/useBusinesses';
import { routes } from '@/lib/routes';
import { SectionHeading } from '@/components/common/SectionHeading';
import { BusinessGridSkeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/States';
import { Button } from '@/components/common/Button';
import { BusinessCard } from '@/components/directory/BusinessCard';
import { Reveal } from '@/components/common/Reveal';

/** "Local Favorites Worth Discovering" — driven by the `isFeatured` data flag. */
export function FeaturedBusinesses() {
  const { data, isPending, isError, refetch, isFetching } = useAllBusinesses();
  const featured = (data ?? []).filter((b) => b.isFeatured).slice(0, 6);

  return (
    <section aria-labelledby="featured-heading" className="section-y bg-sand">
      <div className="container-page">
        <SectionHeading
          id="featured-heading"
          eyebrow="Featured listings"
          title="Local Favorites Worth Discovering"
          description="Explore standout places selected to help you experience more of Barbados."
        />
        {isPending ? (
          <BusinessGridSkeleton count={3} />
        ) : isError ? (
          <ErrorState
            message="Featured businesses couldn’t be loaded."
            onRetry={() => refetch()}
            retrying={isFetching}
          />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((b, i) => (
              <Reveal key={b.id} delay={(i % 3) * 0.08} className={i === 0 ? 'lg:row-span-1' : ''}>
                <BusinessCard business={b} className="h-full" />
              </Reveal>
            ))}
          </div>
        )}
        <div className="mt-12 flex justify-center">
          <Button
            to={routes.businesses()}
            variant="primary"
            size="lg"
            iconRight={<ArrowRight className="h-5 w-5" aria-hidden="true" />}
          >
            View All Businesses
          </Button>
        </div>
      </div>
    </section>
  );
}
