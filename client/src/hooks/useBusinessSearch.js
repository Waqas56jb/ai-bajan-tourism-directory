import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SORT_OPTIONS } from '@/lib/search';

const SORT_VALUES = new Set(SORT_OPTIONS.map((o) => o.value));

/**
 * Directory filter state, stored in the URL so searches are shareable and survive refresh /
 * back navigation. Example: /businesses?q=fish&category=restaurants&location=Oistins&sort=name-asc
 *
 * @param {{ fixed?: { category?: string, location?: string } }} [options] filters locked by the
 *   page (e.g. a category page) — they are applied but not written to the URL.
 */
export function useBusinessSearch({ fixed = {} } = {}) {
  const [params, setParams] = useSearchParams();

  const filters = useMemo(() => {
    const sort = params.get('sort');
    return {
      q: params.get('q') ?? '',
      category: fixed.category ?? params.get('category') ?? '',
      location: fixed.location ?? params.get('location') ?? '',
      type: params.get('type') ?? '',
      amenities: (params.get('amenities') ?? '').split(',').filter(Boolean),
      featured: params.get('featured') === 'true',
      sort: SORT_VALUES.has(sort) ? sort : 'relevance',
      page: Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1),
    };
  }, [params, fixed.category, fixed.location]);

  /** Merge updates into the URL. Any change other than `page` resets to page 1. */
  const update = useCallback(
    (changes, { replace = false } = {}) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(changes)) {
            const empty =
              value === undefined ||
              value === null ||
              value === '' ||
              value === false ||
              (Array.isArray(value) && value.length === 0) ||
              (key === 'sort' && value === 'relevance') ||
              (key === 'page' && Number(value) <= 1);
            if (empty) next.delete(key);
            else next.set(key, Array.isArray(value) ? value.join(',') : String(value));
          }
          if (!('page' in changes)) next.delete('page');
          return next;
        },
        { replace },
      );
    },
    [setParams],
  );

  const clearAll = useCallback(() => {
    setParams((prev) => {
      const next = new URLSearchParams();
      // keep view preferences
      if (prev.get('view')) next.set('view', prev.get('view'));
      return next;
    });
  }, [setParams]);

  const activeCount =
    (filters.q ? 1 : 0) +
    (!fixed.category && filters.category ? 1 : 0) +
    (!fixed.location && filters.location ? 1 : 0) +
    (filters.type ? 1 : 0) +
    filters.amenities.length +
    (filters.featured ? 1 : 0);

  return { filters, update, clearAll, activeCount, params, setParams };
}
