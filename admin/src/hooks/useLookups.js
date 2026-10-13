import { useMemo } from 'react';
import { useApiQuery } from './useApi';
import { getCategories } from '@/services/categoryService';
import { getLocations } from '@/services/locationService';
import { getListings } from '@/services/listingService';

/** Shared reference data (categories, locations, listings) with id → record maps. */
export function useLookups() {
  const categories = useApiQuery('categories', getCategories);
  const locations = useApiQuery('locations', getLocations);
  const listings = useApiQuery('listings', getListings);

  return useMemo(() => {
    const catById = Object.fromEntries((categories.data ?? []).map((c) => [c.id, c]));
    const locById = Object.fromEntries((locations.data ?? []).map((l) => [l.id, l]));
    const listingById = Object.fromEntries((listings.data ?? []).map((l) => [l.id, l]));
    return {
      categories: categories.data ?? [],
      locations: locations.data ?? [],
      listings: listings.data ?? [],
      catById,
      locById,
      listingById,
      categoryName: (id) => catById[id]?.name ?? '—',
      locationName: (id) => locById[id]?.name ?? '—',
      /** "Holetown, Saint James" from a listing.location object */
      placeLabel: (loc) => {
        if (!loc) return '—';
        const city = locById[loc.neighborhoodId] ?? locById[loc.cityId];
        const region = locById[loc.regionId];
        return [city?.name, region?.name].filter(Boolean).join(', ') || '—';
      },
      isLoading: categories.isPending || locations.isPending || listings.isPending,
    };
  }, [
    categories.data,
    locations.data,
    listings.data,
    categories.isPending,
    locations.isPending,
    listings.isPending,
  ]);
}
