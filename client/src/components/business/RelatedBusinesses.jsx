import { useMemo } from 'react';
import { useAllBusinesses } from '@/hooks/useBusinesses';
import { findRelated } from '@/lib/search';
import { categoryBySlug } from '@/data/categories';
import { routes } from '@/lib/routes';
import { SectionHeading } from '@/components/common/SectionHeading';
import { BusinessGridSkeleton } from '@/components/common/Skeleton';
import { EmptyState } from '@/components/common/States';
import { BusinessList } from '@/components/directory/BusinessList';
import { Button } from '@/components/common/Button';

/** Same category, nearest first (same area → same parish → elsewhere). */
export function RelatedBusinesses({ business }) {
  const { data, isPending, isError } = useAllBusinesses();
  const related = useMemo(() => (data ? findRelated(data, business, 3) : []), [data, business]);
  const category = categoryBySlug[business.category];

  if (isError) return null;

  return (
    <section aria-labelledby="related-heading" className="section-y border-t border-line">
      <div className="container-page">
        <SectionHeading
          id="related-heading"
          eyebrow="Keep exploring"
          title={`More ${category?.shortName.toLowerCase() ?? 'places'} to discover`}
          action={{
            label: `All ${category?.shortName.toLowerCase() ?? 'businesses'}`,
            to: routes.category(business.category),
          }}
        />
        {isPending ? (
          <BusinessGridSkeleton count={3} />
        ) : related.length ? (
          <BusinessList businesses={related} />
        ) : (
          <EmptyState
            title="No related listings yet"
            message={`There are no other ${category?.shortName.toLowerCase()} listings in the directory right now.`}
          >
            <Button to={routes.businesses()} variant="outline">
              Explore all businesses
            </Button>
          </EmptyState>
        )}
      </div>
    </section>
  );
}
