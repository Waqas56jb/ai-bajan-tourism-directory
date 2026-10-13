import { QueryClient } from '@tanstack/react-query';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
        refetchOnWindowFocus: false,
        // Retry transient failures only; 404s and config errors fail fast.
        retry: (count, error) => (error?.retryable === false ? false : count < 2),
      },
    },
  });
}

export const queryKeys = {
  businesses: ['businesses'],
  businessSearch: (filters) => ['businesses', 'search', filters],
  business: (slug) => ['businesses', 'detail', slug],
  guides: ['guides'],
  guide: (slug) => ['guides', slug],
};
