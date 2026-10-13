import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { AuthProvider } from '@/context/AuthContext';
import { PreferencesProvider } from '@/context/PreferencesContext';
import { ConfirmProvider } from '@/components/common/ConfirmDialog';
import { ToastProvider } from '@/components/common/ToastProvider';
import { TooltipProvider } from '@/components/common/Tooltip';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (count, error) => (error?.retryable === false ? false : count < 1),
      },
    },
  });
}

/** App-wide providers. The router is supplied separately (browser or memory router in tests). */
export function AppProviders({ children, queryClient: provided }) {
  const [queryClient] = useState(() => provided ?? createQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <PreferencesProvider>
            <TooltipProvider>
              <ConfirmProvider>
                {children}
                <ToastProvider />
              </ConfirmProvider>
            </TooltipProvider>
          </PreferencesProvider>
        </AuthProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
