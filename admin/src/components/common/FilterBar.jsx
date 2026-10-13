import { RotateCcw, X } from 'lucide-react';

/**
 * Container for a table's search + filter controls, with removable chips for active filters
 * and a "Reset" action.
 * chips: [{ key, label, onRemove }]
 */
export function FilterBar({ children, chips = [], onReset, actions }) {
  return (
    <div className="border-b border-line p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="grid grid-cols-1 flex-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end [&>*]:min-w-0 lg:[&>*]:min-w-[10rem]">
          {children}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Active filters">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={c.onRemove}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-subtle py-0.5 pl-2.5 pr-1.5 text-xs font-medium text-ink hover:border-danger/40 hover:bg-danger/5"
              aria-label={`Remove filter: ${c.label}`}
            >
              {c.label}
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          ))}
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-accent-600 hover:underline"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              Reset all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
