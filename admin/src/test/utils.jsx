import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { AppProviders } from '@/app/AppProviders';
import { routes } from '@/app/routeConfig';

export function signInForTest() {
  window.sessionStorage.setItem(
    'ai_bajan_admin_session',
    JSON.stringify({ adminId: 'adm-01', startedAt: new Date().toISOString(), demo: true }),
  );
}

/** Render the full app at a route (signed in by default). */
export function renderApp(route = '/', { signedIn = true } = {}) {
  if (signedIn) signInForTest();
  const router = createMemoryRouter(routes, {
    initialEntries: [route],
    future: {
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
    },
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: 0 } },
  });
  const utils = render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </AppProviders>,
  );
  return { ...utils, router };
}
