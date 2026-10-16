import { Suspense } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { LogoMark } from '@/components/layout/Logo';
import { ImageWithFallback } from '@/components/common/ImageUploadPreview';
import { imgLarge } from '@/data/helpers';
import { PageLoading } from '@/components/common/States';
import { IS_DEMO } from '@/config/environment';

/** Split-screen layout for sign-in screens. Signed-in admins are sent to the dashboard. */
export function AuthLayout() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (isAuthenticated && location.pathname === '/login')
    return <Navigate to={location.state?.from ?? '/'} replace />;

  return (
    <div className="grid grid-cols-1 min-h-screen bg-canvas lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center gap-2.5">
          <LogoMark className="h-9 w-9" />
          <span className="leading-tight">
            <span className="block text-[0.95rem] font-semibold">AI Bajan</span>
            <span className="block text-2xs font-medium uppercase tracking-wider text-muted">
              Platform Admin
            </span>
          </span>
        </div>
        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <Suspense fallback={<PageLoading />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
        <p className="flex items-start gap-2 text-xs text-muted">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {IS_DEMO
            ? 'Demo sign-in only. Real authentication and authorization will be provided by the backend.'
            : 'Secure sign-in for authorised AI Bajan administrators. Every request is checked against your administrator role.'}
        </p>
      </div>
      <div className="relative hidden overflow-hidden lg:block">
        <ImageWithFallback src={imgLarge('holetown')} alt="" className="absolute inset-0 h-full w-full" />
        <div
          className="absolute inset-0 bg-gradient-to-t from-[#0b1c29]/90 via-[#0b1c29]/30 to-transparent"
          aria-hidden="true"
        />
        <div className="absolute inset-x-0 bottom-0 p-12 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7fdcd6]">AI Bajan Platform</p>
          <p className="mt-3 max-w-md text-3xl font-semibold leading-tight">
            Manage the directory, knowledge and AI assistant in one place.
          </p>
          <p className="mt-3 max-w-md text-sm text-white/75">
            Listings, approvals, knowledge sync and chatbot quality — built for a calm, efficient daily
            workflow.
          </p>
        </div>
      </div>
    </div>
  );
}
