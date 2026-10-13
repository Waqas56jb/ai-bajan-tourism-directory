import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import App from '@/App';
import { AppProviders } from '@/AppProviders';

export function createTestQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
}

/** Render the full app at a route, with fresh providers. */
export function renderApp(route = '/') {
  try {
    window.sessionStorage.clear();
  } catch {
    /* ignore */
  }
  return render(
    <MemoryRouter
      initialEntries={[route]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AppProviders queryClient={createTestQueryClient()}>
        <App />
      </AppProviders>
    </MemoryRouter>,
  );
}

/** Render a single component with providers and a router. */
export function renderWithProviders(ui, { route = '/' } = {}) {
  return render(
    <MemoryRouter
      initialEntries={[route]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AppProviders queryClient={createTestQueryClient()}>{ui}</AppProviders>
    </MemoryRouter>,
  );
}
