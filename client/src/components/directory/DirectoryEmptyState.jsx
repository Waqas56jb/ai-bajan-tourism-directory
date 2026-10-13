import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import { categories, categoryBySlug } from '@/data/categories';
import { routes } from '@/lib/routes';
import { EmptyState } from '@/components/common/States';
import { Button } from '@/components/common/Button';

/**
 * No results. Keeps the visitor's search terms visible and offers concrete ways to broaden
 * the search, based on the facet counts for the current query.
 */
export function DirectoryEmptyState({
  filters,
  facets,
  onChange,
  onClearAll,
  lockCategory = false,
  lockLocation = false,
}) {
  const parts = [];
  if (filters.q) parts.push(`“${filters.q}”`);
  if (filters.category) parts.push(categoryBySlug[filters.category]?.name.toLowerCase());
  if (filters.location) parts.push(`in ${filters.location}`);
  const summary = parts.filter(Boolean).join(' ');

  const suggestions = [];
  if (filters.location && !lockLocation) {
    suggestions.push({
      label: `Search all of Barbados`,
      onClick: () => onChange({ location: '' }),
    });
  }
  if (filters.q)
    suggestions.push({ label: `Remove “${filters.q}”`, onClick: () => onChange({ q: '' }) });
  if (filters.amenities.length || filters.type || filters.featured) {
    suggestions.push({
      label: 'Remove extra filters',
      onClick: () => onChange({ amenities: [], type: '', featured: false }),
    });
  }

  const otherCategories = categories
    .filter((c) => c.slug !== filters.category && (facets?.categories?.[c.slug] ?? 0) > 0)
    .slice(0, 4);

  return (
    <EmptyState
      icon={SearchX}
      title="No matching businesses"
      message={
        <p>
          We couldn’t find listings matching{' '}
          {summary ? <strong className="text-navy">{summary}</strong> : 'these filters'}. Rather
          than show unrelated results, try broadening your search.
        </p>
      }
    >
      <div className="flex flex-wrap justify-center gap-2">
        {suggestions.map((s) => (
          <Button key={s.label} variant="outline" size="sm" onClick={s.onClick}>
            {s.label}
          </Button>
        ))}
        {!lockCategory && (
          <Button variant="primary" size="sm" onClick={onClearAll}>
            Clear all filters
          </Button>
        )}
      </div>
      {!lockCategory && otherCategories.length > 0 && (
        <div className="mt-8">
          <p className="text-sm font-bold text-muted">
            These categories have matches for your other filters:
          </p>
          <ul className="mt-3 flex flex-wrap justify-center gap-2">
            {otherCategories.map((c) => (
              <li key={c.slug}>
                <button
                  type="button"
                  onClick={() => onChange({ category: c.slug, type: '' })}
                  className="rounded-full bg-sand px-3.5 py-2 text-sm font-semibold text-navy hover:bg-ocean hover:text-white"
                >
                  {c.name} ({facets.categories[c.slug]})
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {lockCategory && (
        <p className="mt-6 text-sm text-muted">
          Or{' '}
          <Link className="font-bold text-ocean-700 underline" to={routes.businesses()}>
            browse the whole directory
          </Link>
          .
        </p>
      )}
    </EmptyState>
  );
}
