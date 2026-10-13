import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/** @param {{ items: { label: string, to?: string }[], tone?: 'dark'|'light' }} props */
export function Breadcrumbs({ items, tone = 'dark', className = '' }) {
  const light = tone === 'light';
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol
        className={`flex flex-wrap items-center gap-1 text-sm font-semibold ${light ? 'text-white/80' : 'text-muted'}`}
      >
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-1">
              {item.to && !last ? (
                <Link
                  to={item.to}
                  className={`rounded transition-colors ${light ? 'hover:text-white' : 'hover:text-navy'}`}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? 'page' : undefined}
                  className={`truncate ${light ? 'text-white' : 'text-navy'}`}
                >
                  {item.label}
                </span>
              )}
              {!last && (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
