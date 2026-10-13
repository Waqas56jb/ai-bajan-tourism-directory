import { ChevronLeft, ChevronRight } from 'lucide-react';

function pages(page, count) {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const set = new Set([1, count, page - 1, page, page + 1].filter((p) => p >= 1 && p <= count));
  const sorted = [...set].sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push(`gap-${p}`);
    out.push(p);
  });
  return out;
}

export function Pagination({
  page,
  pageCount,
  total,
  from,
  to,
  onPageChange,
  pageSize,
  onPageSizeChange,
  label = 'records',
}) {
  if (!total) return null;
  const btn =
    'grid h-8 min-w-8 place-items-center rounded-lg px-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40';
  return (
    <div className="flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 text-xs text-muted">
        <span aria-live="polite">
          Showing{' '}
          <span className="font-medium text-ink tabular">
            {from}–{to}
          </span>{' '}
          of <span className="font-medium text-ink tabular">{total}</span> {label}
        </span>
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5">
            <span className="sr-only sm:not-sr-only">Rows</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="field h-8 w-auto py-0 pl-2 pr-7 text-xs"
              aria-label="Rows per page"
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {pageCount > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-1">
          <button
            type="button"
            className={`${btn} text-ink hover:bg-subtle`}
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          {pages(page, pageCount).map((p) =>
            typeof p === 'string' ? (
              <span key={p} className="px-1 text-muted" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? 'page' : undefined}
                aria-label={`Page ${p}`}
                className={`${btn} ${p === page ? 'bg-navy text-surface' : 'text-ink hover:bg-subtle'}`}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            className={`${btn} text-ink hover:bg-subtle`}
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </nav>
      )}
    </div>
  );
}
