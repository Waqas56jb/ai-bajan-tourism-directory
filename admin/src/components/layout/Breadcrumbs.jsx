import { Link, useMatches } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { usePageMeta } from '@/context/PageMetaContext';

/**
 * Breadcrumbs from route `handle.crumb` values. The last crumb can be replaced by a record
 * name set with usePageTitle() on detail pages.
 */
export function useBreadcrumbs() {
  const matches = useMatches();
  const { title } = usePageMeta();
  const crumbs = matches
    .filter((m) => m.handle?.crumb)
    .map((m) => ({
      label:
        m.handle.dynamic && title
          ? title
          : typeof m.handle.crumb === 'function'
            ? m.handle.crumb(m.params)
            : m.handle.crumb,
      to: m.handle.to ?? m.pathname,
    }));
  // De-duplicate consecutive identical paths (index routes)
  return crumbs.filter((c, i) => i === 0 || c.to !== crumbs[i - 1].to || c.label !== crumbs[i - 1].label);
}

export function Breadcrumbs({ className = '' }) {
  const crumbs = useBreadcrumbs();
  if (crumbs.length <= 1) return null;
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex min-w-0 items-center gap-1 text-xs text-muted">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li
              key={`${c.to}-${i}`}
              className={`flex min-w-0 items-center gap-1 ${!last && i > 0 ? 'hidden sm:flex' : ''}`}
            >
              {last ? (
                <span aria-current="page" className="truncate font-medium text-ink">
                  {c.label}
                </span>
              ) : (
                <Link to={c.to} className="truncate rounded hover:text-ink">
                  {c.label}
                </Link>
              )}
              {!last && <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
