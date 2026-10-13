import { TriangleAlert } from 'lucide-react';
import { Seo } from '@/lib/seo';
import { PageHeader } from '@/components/layout/PageContainer';

/** Shared template for draft policy pages. */
export function LegalPage({ doc, path, description }) {
  return (
    <>
      <Seo title={doc.title} description={description} path={path} noindex={doc.draft} />
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: doc.title }]}
        eyebrow="Legal"
        title={doc.title}
      >
        {doc.effectiveDate && (
          <p className="mt-4 text-muted">
            Effective{' '}
            <time dateTime={doc.effectiveDate}>
              {new Date(doc.effectiveDate).toLocaleDateString('en-GB', { dateStyle: 'long' })}
            </time>
          </p>
        )}
      </PageHeader>
      <div className="container-page grid gap-12 pb-24 lg:grid-cols-[240px_minmax(0,68ch)]">
        <nav aria-labelledby="legal-toc" className="lg:sticky lg:top-24 lg:self-start">
          <h2
            id="legal-toc"
            className="text-sm font-extrabold uppercase tracking-[0.12em] text-muted"
          >
            Contents
          </h2>
          <ol className="mt-3 space-y-1 text-sm">
            {doc.sections.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="block rounded-lg px-2 py-1.5 font-semibold text-navy hover:bg-sand"
                >
                  {i + 1}. {s.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="prose-article">
          {doc.draft && (
            <p
              role="note"
              className="!mt-0 flex items-start gap-3 rounded-2xl border border-coral/40 bg-coral/10 p-5 text-[0.95rem] text-ink"
            >
              <TriangleAlert className="mt-1 h-5 w-5 shrink-0 text-coral-600" aria-hidden="true" />
              <span>
                <strong>Draft for review.</strong> This is template text, not legal advice. It must
                be reviewed and completed by a qualified professional before launch.
              </span>
            </p>
          )}
          {doc.sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-28">
              <h2>
                {i + 1}. {s.heading}
              </h2>
              <p>{s.body}</p>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
