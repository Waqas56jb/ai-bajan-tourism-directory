import { Suspense, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { usePreferences } from '@/context/PreferencesContext';
import { PageMetaProvider } from '@/context/PageMetaContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { MobileNavigation } from '@/components/layout/MobileNavigation';
import { PageLoading } from '@/components/common/States';
import { RouteErrorBoundary } from '@/app/RouteErrorBoundary';

/**
 * Authenticated shell. NOTE: this guard only controls what the browser shows in the demo.
 * Real access control must be enforced by the backend on every request.
 */
export function AdminLayout() {
  const { isAuthenticated } = useAuth();
  const { collapsed } = usePreferences();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return (
    <PageMetaProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-navy focus:px-4 focus:py-2 focus:text-surface"
      >
        Skip to content
      </a>
      <Sidebar collapsed={collapsed} />
      <MobileNavigation open={mobileOpen} onOpenChange={setMobileOpen} />
      <div
        className={`min-w-0 transition-[padding] duration-200 ${collapsed ? 'lg:pl-[var(--sidebar-w-collapsed)]' : 'lg:pl-[var(--sidebar-w)]'}`}
      >
        <Topbar onOpenMobileNav={() => setMobileOpen(true)} />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1600px] px-3 py-5 outline-none sm:px-5 sm:py-6 lg:px-8"
        >
          <RouteErrorBoundary resetKey={location.pathname}>
            <Suspense fallback={<PageLoading />}>
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                <Outlet />
              </motion.div>
            </Suspense>
          </RouteErrorBoundary>
        </main>
      </div>
    </PageMetaProvider>
  );
}
