import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { guideCategories } from '@/data/travelGuides';
import { useGuides } from '@/hooks/useBusinesses';
import { normalize } from '@/lib/search';
import { Seo } from '@/lib/seo';
import { PageHeader } from '@/components/layout/PageContainer';
import { SearchInput } from '@/components/common/Fields';
import { GuideCard } from '@/components/guides/GuideCard';
import { EmptyState, ErrorState } from '@/components/common/States';
import { Skeleton } from '@/components/common/Skeleton';
import { Button } from '@/components/common/Button';

export default function TravelGuidesPage() {
  const [params, setParams] = useSearchParams();
  const topic = params.get('topic') ?? '';
  const q = params.get('q') ?? '';
  const { data, isPending, isError, refetch, isFetching } = useGuides();

  const set = (key, value) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: key === 'q' },
    );

  const filtered = useMemo(() => {
    const term = normalize(q);
    return (data ?? []).filter(
      (g) =>
        (!topic || g.category === topic) &&
        (!term || normalize(`${g.title} ${g.excerpt}`).includes(term)),
    );
  }, [data, topic, q]);

  const isFiltering = Boolean(topic || q);
  const featured = !isFiltering ? filtered.find((g) => g.featured) : null;
  const rest = filtered.filter((g) => g !== featured);

  return (
    <>
      <Seo
        title="Travel Guides"
        description="Editorial guides to Barbados: first-time tips, the west coast, Bajan food, outdoor adventures, culture and getting around."
        path="/guides"
        imageKey="heroBarbados"
      />
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Travel guides' }]}
        eyebrow="Travel guides"
        title="Stories and practical tips for your Barbados trip"
        description="General guidance to help you plan. For entry rules, schedules and prices, always check official sources."
      />

      <div className="container-page pb-24">
        <div className="flex flex-col gap-4 border-b border-line pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div
            role="group"
            aria-label="Filter guides by topic"
            className="scrollbar-none -mx-[var(--gutter)] flex gap-2 overflow-x-auto px-[var(--gutter)] lg:mx-0 lg:flex-wrap lg:px-0"
          >
            {['', ...guideCategories].map((c) => (
              <button
                key={c || 'all'}
                type="button"
                onClick={() => set('topic', c)}
                aria-pressed={topic === c}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors ${topic === c ? 'bg-navy text-white' : 'bg-white text-navy ring-1 ring-line hover:ring-navy'}`}
              >
                {c || 'All guides'}
              </button>
            ))}
          </div>
          <SearchInput
            value={q}
            onChange={(v) => set('q', v)}
            label="Search guides by title"
            placeholder="Search guides"
            className="lg:w-80"
          />
        </div>

        <div className="mt-10">
          {isPending ? (
            <div className="grid gap-10 md:grid-cols-3" role="status" aria-label="Loading guides">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="aspect-[4/3]" />
              ))}
            </div>
          ) : isError ? (
            <ErrorState
              message="Guides couldn’t be loaded."
              onRetry={() => refetch()}
              retrying={isFetching}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No guides match"
              message={
                q
                  ? `Nothing matches “${q}”${topic ? ` in ${topic}` : ''}.`
                  : `No guides in ${topic} yet.`
              }
            >
              <Button variant="primary" onClick={() => setParams({})}>
                Show all guides
              </Button>
            </EmptyState>
          ) : (
            <>
              {featured && (
                <div className="mb-16">
                  <GuideCard guide={featured} variant="feature" headingLevel={2} priority />
                </div>
              )}
              <p className="sr-only" role="status">
                {filtered.length} guides shown
              </p>
              <ul className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((g) => (
                  <li key={g.slug}>
                    <GuideCard guide={g} headingLevel={2} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </>
  );
}
