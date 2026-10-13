import { useGuides } from '@/hooks/useBusinesses';
import { routes } from '@/lib/routes';
import { SectionHeading } from '@/components/common/SectionHeading';
import { Skeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/States';
import { GuideCard } from '@/components/guides/GuideCard';
import { Reveal } from '@/components/common/Reveal';

export function TourismGuides() {
  const { data, isPending, isError, refetch, isFetching } = useGuides();
  const guides = (data ?? []).slice(0, 5);
  const [lead, ...rest] = guides;

  return (
    <section aria-labelledby="guides-heading" className="section-y">
      <div className="container-page">
        <SectionHeading
          id="guides-heading"
          eyebrow="Travel guides"
          title="Plan Like Someone Who’s Been Before"
          description="Practical, unhurried guides to the island’s coasts, food and culture."
          action={{ label: 'All travel guides', to: routes.guides() }}
        />
        {isPending ? (
          <div className="grid gap-8 lg:grid-cols-2" role="status" aria-label="Loading guides">
            <Skeleton className="aspect-[4/3]" />
            <div className="grid gap-6 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="aspect-[4/3]" />
              ))}
            </div>
          </div>
        ) : isError ? (
          <ErrorState
            message="Travel guides couldn’t be loaded."
            onRetry={() => refetch()}
            retrying={isFetching}
          />
        ) : (
          <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-12">
            {lead && (
              <Reveal className="sm:col-span-2 lg:col-span-12">
                <GuideCard guide={lead} variant="feature" />
              </Reveal>
            )}
            {rest.map((g, i) => (
              <Reveal key={g.slug} delay={i * 0.06} className="sm:col-span-1 lg:col-span-3">
                <GuideCard guide={g} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
