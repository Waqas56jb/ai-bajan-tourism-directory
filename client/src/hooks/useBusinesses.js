import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  getBusinesses,
  getBusinessBySlug,
  searchBusinesses,
  getTravelGuides,
  getGuideBySlug,
} from '@/lib/services';
import { queryKeys } from '@/lib/queryClient';

export function useAllBusinesses() {
  return useQuery({ queryKey: queryKeys.businesses, queryFn: () => getBusinesses() });
}

export function useBusiness(slug) {
  return useQuery({
    queryKey: queryKeys.business(slug),
    queryFn: () => getBusinessBySlug(slug),
    enabled: Boolean(slug),
  });
}

/** Directory search; keeps showing the previous page of results while new ones load. */
export function useDirectorySearch(filters) {
  return useQuery({
    queryKey: queryKeys.businessSearch(filters),
    queryFn: ({ signal }) => searchBusinesses(filters, { signal }),
    placeholderData: keepPreviousData,
  });
}

export function useGuides() {
  return useQuery({ queryKey: queryKeys.guides, queryFn: () => getTravelGuides() });
}

export function useGuide(slug) {
  return useQuery({
    queryKey: queryKeys.guide(slug),
    queryFn: () => getGuideBySlug(slug),
    enabled: Boolean(slug),
  });
}
