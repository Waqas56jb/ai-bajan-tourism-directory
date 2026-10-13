import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, Info } from 'lucide-react';
import { useAllBusinesses, useGuide, useGuides } from '@/hooks/useBusinesses';
import { getReadingTime } from '@/data/travelGuides';
import { routes } from '@/lib/routes';
import { Seo } from '@/lib/seo';
import { articleJsonLd, breadcrumbJsonLd } from '@/lib/structuredData';
import { PageHero } from '@/components/layout/PageContainer';
import { SafeMarkdown } from '@/components/common/SafeMarkdown';
import { ShareButton } from '@/components/common/ShareButton';
import { SectionHeading } from '@/components/common/SectionHeading';
import { GuideCard } from '@/components/guides/GuideCard';
import { BusinessCard } from '@/components/directory/BusinessCard';
import { ErrorState } from '@/components/common/States';
import { PageSkeleton } from '@/components/common/Skeleton';
import NotFoundPage from './NotFoundPage';

export default function GuideDetailPage() {
  const { slug } = useParams();
  const { data: guide, isPending, isError, error, refetch, isFetching } = useGuide(slug);
  const { data: allGuides } = useGuides();
  const { data: businesses } = useAllBusinesses();

  const relatedListings = useMemo(() => {
    if (!guide || !businesses) return [];
    return businesses
      .filter((b) => guide.relatedCategories.includes(b.category))
      .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a.name.localeCompare(b.name))
      .slice(0, 3);
  }, [guide, businesses]);

  if (isPending) return <PageSkeleton />;
  if (isError && error?.status === 404)
    return (
      <NotFoundPage
        title="Guide not found"
        message="That guide may have moved. Browse all travel guides instead."
      />
    );
  if (isError) {
    return (
      <div className="container-page py-20">
        <ErrorState message={error?.message} onRetry={() => refetch()} retrying={isFetching} />
      </div>
    );
  }

  const minutes = getReadingTime(guide);
  const related = (allGuides ?? []).filter((g) => g.slug !== guide.slug).slice(0, 3);
  const crumbs = [
    { label: 'Home', to: '/' },
    { label: 'Guides', to: '/guides' },
    { label: guide.title },
  ];

  return (
    <>
      <Seo
        title={guide.title}
        description={guide.excerpt}
        path={routes.guide(guide.slug)}
        imageKey={guide.image}
        type="article"
        jsonLd={[breadcrumbJsonLd(crumbs), articleJsonLd(guide)]}
      />
      <PageHero
        imageKey={guide.image}
        breadcrumbs={crumbs}
        eyebrow={guide.category}
        title={guide.title}
        description={guide.excerpt}
      >
        <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold text-white/85">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4" aria-hidden="true" />
            {minutes} min read
          </span>
          {guide.author && <span>By {guide.author}</span>}
          {guide.publishedAt && (
            <time dateTime={guide.publishedAt}>
              {new Date(guide.publishedAt).toLocaleDateString('en-GB', { dateStyle: 'long' })}
            </time>
          )}
        </p>
      </PageHero>

      <div className="container-page grid gap-12 py-14 md:py-20 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16 xl:grid-cols-[260px_minmax(0,68ch)_1fr]">
        {/* Table of contents */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <nav aria-labelledby="toc-heading" className="rounded-card bg-white p-5 shadow-soft">
            <h2
              id="toc-heading"
              className="text-sm font-extrabold uppercase tracking-[0.12em] text-muted"
            >
              In this guide
            </h2>
            <ol className="mt-3 space-y-1">
              {guide.sections.map((s, i) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="flex gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-navy hover:bg-sand"
                  >
                    <span className="text-ocean-700">{i + 1}.</span>
                    {s.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <ShareButton title={guide.title} text={guide.excerpt} className="mt-5" />
        </aside>

        <article className="prose-article min-w-0">
          {guide.sections.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-28">
              <h2 id={`${s.id}-h`}>{s.heading}</h2>
              <SafeMarkdown>{s.body}</SafeMarkdown>
            </section>
          ))}
          <p className="mt-12 flex items-start gap-3 rounded-2xl bg-sand p-5 text-[0.95rem] not-italic text-muted">
            <Info className="mt-1 h-4 w-4 shrink-0 text-ocean-700" aria-hidden="true" />
            This guide offers general information and is not official tourism or travel guidance.
            Check official sources for entry requirements, schedules, prices and opening hours.
          </p>
        </article>
      </div>

      {relatedListings.length > 0 && (
        <section aria-labelledby="guide-listings" className="bg-sand py-16 md:py-20">
          <div className="container-page">
            <SectionHeading
              id="guide-listings"
              eyebrow="From the directory"
              title="Places mentioned in this theme"
              action={{ label: 'Explore the directory', to: routes.businesses() }}
            />
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {relatedListings.map((b) => (
                <BusinessCard key={b.id} business={b} className="h-full" />
              ))}
            </div>
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section aria-labelledby="guide-related" className="container-page py-16 md:py-24">
          <SectionHeading
            id="guide-related"
            eyebrow="Keep reading"
            title="Related guides"
            action={{ label: 'All guides', to: routes.guides() }}
          />
          <div className="grid gap-10 md:grid-cols-3">
            {related.map((g) => (
              <GuideCard key={g.slug} guide={g} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
