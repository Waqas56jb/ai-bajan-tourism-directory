import { X } from 'lucide-react';
import { categoryBySlug } from '@/data/categories';
import { getAmenityLabel } from '@/data/amenities';

function Chip({ label, onRemove }) {
  return (
    <li>
      <button
        type="button"
        onClick={onRemove}
        className="group inline-flex min-h-9 items-center gap-1.5 rounded-full border border-navy/15 bg-white py-1.5 pl-3.5 pr-2 text-sm font-semibold text-navy transition-colors hover:border-coral hover:bg-coral/10"
        aria-label={`Remove filter: ${label}`}
      >
        {label}
        <span className="grid h-5 w-5 place-items-center rounded-full bg-sand transition-colors group-hover:bg-coral group-hover:text-navy-900">
          <X className="h-3 w-3" aria-hidden="true" />
        </span>
      </button>
    </li>
  );
}

/** Removable chips for every active filter, plus "Clear all". */
export function ActiveFilters({
  filters,
  onChange,
  onClearAll,
  lockCategory = false,
  lockLocation = false,
}) {
  const chips = [];
  if (filters.q)
    chips.push({ key: 'q', label: `“${filters.q}”`, remove: () => onChange({ q: '' }) });
  if (filters.category && !lockCategory)
    chips.push({
      key: 'category',
      label: categoryBySlug[filters.category]?.name ?? filters.category,
      remove: () => onChange({ category: '', type: '' }),
    });
  if (filters.location && !lockLocation)
    chips.push({
      key: 'location',
      label: filters.location,
      remove: () => onChange({ location: '' }),
    });
  if (filters.type)
    chips.push({ key: 'type', label: filters.type, remove: () => onChange({ type: '' }) });
  for (const a of filters.amenities) {
    chips.push({
      key: `a-${a}`,
      label: getAmenityLabel(a),
      remove: () => onChange({ amenities: filters.amenities.filter((x) => x !== a) }),
    });
  }
  if (filters.featured)
    chips.push({
      key: 'featured',
      label: 'Featured only',
      remove: () => onChange({ featured: false }),
    });

  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      <span className="text-sm font-bold text-muted">Filtering by:</span>
      <ul className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <Chip key={c.key} label={c.label} onRemove={c.remove} />
        ))}
      </ul>
      <button
        type="button"
        onClick={onClearAll}
        className="ml-1 rounded-full px-2 py-1 text-sm font-bold text-ocean-700 underline-offset-4 hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}
