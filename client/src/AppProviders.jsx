import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { MotionConfig } from 'framer-motion';
import { Toaster } from 'sonner';
import { createQueryClient } from '@/lib/queryClient';
import { UIProvider } from '@/context/UIContext';

/** All app-wide providers (router excluded so tests can supply a MemoryRouter). */
export function AppProviders({ children, queryClient: provided }) {
  const [queryClient] = useState(() => provided ?? createQueryClient());
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="user">
          <UIProvider>
            {children}
            <Toaster
              position="top-center"
              richColors
              closeButton
              toastOptions={{ style: { fontFamily: 'Manrope, sans-serif' } }}
            />
          </UIProvider>
        </MotionConfig>
      </QueryClientProvider>
    </HelmetProvider>
  );
}
