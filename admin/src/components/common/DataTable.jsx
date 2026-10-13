import { useEffect, useRef } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { EmptyState, ErrorState, Skeleton } from './States';

const HIDE = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
  '2xl': 'hidden 2xl:table-cell',
};

function HeaderCheckbox({ checked, indeterminate, onChange }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label="Select all rows on this page"
      className="h-4 w-4 cursor-pointer accent-[rgb(var(--accent))]"
    />
  );
}

/**
 * Generic table with sorting, selection, responsive column hiding and loading/empty/error states.
 *
 * columns: [{ key, header, cell(row), sortKey?, align?: 'right', hideBelow?: 'sm'|'md'|'lg'|'xl', className?, width? }]
 */
export function DataTable({
  columns,
  rows,
  loading = false,
  error = null,
  onRetry,
  retrying,
  empty = { title: 'No records found' },
  selection,
  sort,
  caption,
  rowLabel = (row) => row.name ?? row.title ?? row.id,
  hiddenColumns,
  rowClassName,
  skeletonRows = 6,
}) {
  const visible = columns.filter((c) => !hiddenColumns?.has(c.key));
  const colCount = visible.length + (selection ? 1 : 0);

  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-line bg-subtle/60 text-left">
            {selection && (
              <th scope="col" className="w-10 px-4 py-2.5">
                <HeaderCheckbox
                  checked={selection.allOnPage}
                  indeterminate={selection.someOnPage}
                  onChange={selection.togglePage}
                />
              </th>
            )}
            {visible.map((col) => {
              const sorted = sort && col.sortKey && sort.key === col.sortKey;
              const ariaSort = sorted ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={ariaSort}
                  style={col.width ? { width: col.width } : undefined}
                  className={`whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted ${col.align === 'right' ? 'text-right' : ''} ${col.hideBelow ? HIDE[col.hideBelow] : ''}`}
                >
                  {sort && col.sortKey ? (
                    <button
                      type="button"
                      onClick={() => sort.onSort(col.sortKey)}
                      className={`inline-flex items-center gap-1 rounded uppercase hover:text-ink ${sorted ? 'text-ink' : ''}`}
                    >
                      {col.header}
                      {sorted ? (
                        sort.dir === 'asc' ? (
                          <ArrowUp className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="h-3 w-3" aria-hidden="true" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: skeletonRows }, (_, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                <td colSpan={colCount} className="px-4 py-3.5">
                  <Skeleton className={`h-4 ${i % 2 ? 'w-3/4' : 'w-full'}`} />
                </td>
              </tr>
            ))
          ) : error ? (
            <tr>
              <td colSpan={colCount}>
                <ErrorState message={error.message} onRetry={onRetry} retrying={retrying} />
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={colCount}>
                <EmptyState {...empty} />
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const selected = selection?.isSelected(row.id);
              return (
                <tr
                  key={row.id}
                  className={`border-b border-line transition-colors last:border-0 hover:bg-subtle/50 ${selected ? 'bg-accent-50/60' : ''} ${rowClassName?.(row) ?? ''}`}
                >
                  {selection && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => selection.toggle(row.id)}
                        aria-label={`Select ${rowLabel(row)}`}
                        className="h-4 w-4 cursor-pointer accent-[rgb(var(--accent))]"
                      />
                    </td>
                  )}
                  {visible.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 align-middle ${col.align === 'right' ? 'text-right tabular' : ''} ${col.hideBelow ? HIDE[col.hideBelow] : ''} ${col.className ?? ''}`}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
