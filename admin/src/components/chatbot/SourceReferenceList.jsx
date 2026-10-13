import { Link } from 'react-router-dom';
import { BookOpen, HelpCircle, Store, ArrowUpRight } from 'lucide-react';

const META = {
  listing: { icon: Store, label: 'Business listing', to: (id) => `/listings/${id}` },
  guide: { icon: BookOpen, label: 'Tourism guide', to: (id) => `/knowledge/${id}` },
  faq: { icon: HelpCircle, label: 'FAQ', to: (id) => `/knowledge/faqs?edit=${id}` },
};

/** Source cards for a grounded answer. Each links to the admin record it came from. */
export function SourceReferenceList({ sources, compact = false }) {
  if (!sources?.length) return null;
  return (
    <ul className={`grid gap-2 ${compact ? '' : 'sm:grid-cols-2'}`} aria-label="Sources">
      {sources.map((s, i) => {
        const meta = META[s.type] ?? META.guide;
        return (
          <li key={`${s.id}-${i}`}>
            <Link
              to={meta.to(s.id)}
              className="group flex h-full gap-2.5 rounded-xl border border-line bg-surface p-2.5 text-left transition-colors hover:border-accent/50"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent-600">
                <meta.icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-xs font-semibold text-ink">
                  <span className="truncate">{s.title}</span>
                  <ArrowUpRight
                    className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </span>
                <span className="block text-2xs text-muted">{s.meta || meta.label}</span>
                {s.snippet && (
                  <span className="mt-0.5 line-clamp-2 block text-xs text-muted">“{s.snippet}”</span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
