import { lazy, Suspense } from 'react';
import { Route, Routes, useLocation, matchPath } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AIChatbotLauncher } from '@/components/chatbot/AIChatbotLauncher';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { ScrollToTop } from '@/components/common/ScrollToTop';
import { PageSkeleton } from '@/components/common/Skeleton';
import HomePage from '@/pages/HomePage';

// Route-level code splitting: only the homepage ships in the initial bundle.
const DirectoryPage = lazy(() => import('@/pages/DirectoryPage'));
const CategoryPage = lazy(() => import('@/pages/CategoryPage'));
const BusinessDetailPage = lazy(() => import('@/pages/BusinessDetailPage'));
const DestinationPage = lazy(() => import('@/pages/DestinationPage'));
const DiscoverPage = lazy(() => import('@/pages/DiscoverPage'));
const TravelGuidesPage = lazy(() => import('@/pages/TravelGuidesPage'));
const GuideDetailPage = lazy(() => import('@/pages/GuideDetailPage'));
const AboutPage = lazy(() => import('@/pages/AboutPage'));
const ContactPage = lazy(() => import('@/pages/ContactPage'));
const FAQPage = lazy(() => import('@/pages/FAQPage'));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'));
const TermsPage = lazy(() => import('@/pages/TermsPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

/** Pages whose hero sits under a transparent header. */
const OVERLAY_ROUTES = [
  '/',
  '/discover',
  '/about',
  '/category/:slug',
  '/places/:slug',
  '/guides/:slug',
];

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/businesses" element={<DirectoryPage />} />
      <Route path="/category/:slug" element={<CategoryPage />} />
      <Route path="/business/:slug" element={<BusinessDetailPage />} />
      <Route path="/places/:slug" element={<DestinationPage />} />
      <Route path="/discover" element={<DiscoverPage />} />
      <Route path="/guides" element={<TravelGuidesPage />} />
      <Route path="/guides/:slug" element={<GuideDetailPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/faq" element={<FAQPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  const { pathname } = useLocation();
  const overlay = OVERLAY_ROUTES.some((pattern) => matchPath(pattern, pathname));

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-navy focus:px-5 focus:py-3 focus:font-bold focus:text-white"
      >
        Skip to main content
      </a>
      <ScrollToTop />
      <Header overlay={overlay} />
      <main id="main" tabIndex={-1} className="min-h-[60vh] outline-none">
        <ErrorBoundary resetKey={pathname}>
          <Suspense fallback={<PageSkeleton />}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <AppRoutes />
            </motion.div>
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
      <AIChatbotLauncher />
    </>
  );
}
