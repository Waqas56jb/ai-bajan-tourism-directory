import { ChevronLeft, ChevronRight } from 'lucide-react';

function pageList(page, pageCount) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push(`gap-${p}`);
    out.push(p);
  });
  return out;
}

/** Page navigation. Filters live in the URL, so changing page keeps them. */
export function Pagination({ page, pageCount, onChange, className = '' }) {
  if (pageCount <= 1) return null;
  const btn =
    'grid h-11 min-w-11 place-items-center rounded-full px-3 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <nav
      aria-label="Pagination"
      className={`flex items-center justify-center gap-1.5 ${className}`}
    >
      <button
        type="button"
        className={`${btn} text-navy hover:bg-white`}
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <ul className="flex items-center gap-1">
        {pageList(page, pageCount).map((p) =>
          typeof p === 'string' ? (
            <li key={p} className="px-1 text-muted" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={p}>
              <button
                type="button"
                onClick={() => onChange(p)}
                aria-current={p === page ? 'page' : undefined}
                aria-label={`Page ${p}`}
                className={`${btn} ${p === page ? 'bg-navy text-white' : 'text-navy hover:bg-white'}`}
              >
                {p}
              </button>
            </li>
          ),
        )}
      </ul>
      <button
        type="button"
        className={`${btn} text-navy hover:bg-white`}
        onClick={() => onChange(page + 1)}
        disabled={page >= pageCount}
        aria-label="Next page"
      >
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>
    </nav>
  );
}
