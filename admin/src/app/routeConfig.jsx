import { lazy } from 'react';
import { AdminLayout } from '@/layouts/AdminLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { RouterErrorPage } from './RouteErrorBoundary';

const page = (loader) => lazy(loader);

const LoginPage = page(() => import('@/pages/auth/LoginPage'));
const ForgotPasswordPage = page(() => import('@/pages/auth/ForgotPasswordPage'));
const DashboardPage = page(() => import('@/pages/dashboard/DashboardPage'));
const ListingsPage = page(() => import('@/pages/listings/ListingsPage'));
const CreateListingPage = page(() => import('@/pages/listings/CreateListingPage'));
const EditListingPage = page(() => import('@/pages/listings/EditListingPage'));
const ListingDetailsPage = page(() => import('@/pages/listings/ListingDetailsPage'));
const ListingPreviewPage = page(() => import('@/pages/listings/ListingPreviewPage'));
const ListingSubmissionsPage = page(() => import('@/pages/listings/ListingSubmissionsPage'));
const ApplicationsPage = page(() => import('@/pages/listings/ApplicationsPage'));
const ClassifiedsPage = page(() => import('@/pages/listings/ClassifiedsPage'));
const QuestionsReportPage = page(() => import('@/pages/chatbot/QuestionsReportPage'));
const CategoriesPage = page(() => import('@/pages/categories/CategoriesPage'));
const LocationsPage = page(() => import('@/pages/locations/LocationsPage'));
const KnowledgeBasePage = page(() => import('@/pages/knowledge/KnowledgeBasePage'));
const KnowledgeDocumentPage = page(() => import('@/pages/knowledge/KnowledgeDocumentPage'));
const KnowledgeDocumentFormPage = page(() => import('@/pages/knowledge/KnowledgeDocumentFormPage'));
const FAQsPage = page(() => import('@/pages/knowledge/FAQsPage'));
const KnowledgeSyncPage = page(() => import('@/pages/chatbot/KnowledgeSyncPage'));
const ChatbotOverviewPage = page(() => import('@/pages/chatbot/ChatbotOverviewPage'));
const ConversationsPage = page(() => import('@/pages/chatbot/ConversationsPage'));
const ConversationDetailsPage = page(() => import('@/pages/chatbot/ConversationDetailsPage'));
const ChatbotSettingsPage = page(() => import('@/pages/chatbot/ChatbotSettingsPage'));
const AdvertisementsPage = page(() => import('@/pages/advertising/AdvertisementsPage'));
const FeaturedListingsPage = page(() => import('@/pages/advertising/FeaturedListingsPage'));
const UsersPage = page(() => import('@/pages/users/UsersPage'));
const UserDetailsPage = page(() => import('@/pages/users/UserDetailsPage'));
const AdministratorsPage = page(() => import('@/pages/users/AdministratorsPage'));
const FeedbackPage = page(() => import('@/pages/feedback/FeedbackPage'));
const ActivityLogsPage = page(() => import('@/pages/activity/ActivityLogsPage'));
const SystemHealthPage = page(() => import('@/pages/monitoring/SystemHealthPage'));
const ErrorLogsPage = page(() => import('@/pages/monitoring/ErrorLogsPage'));
const GeneralSettingsPage = page(() => import('@/pages/settings/GeneralSettingsPage'));
const AppearanceSettingsPage = page(() => import('@/pages/settings/AppearanceSettingsPage'));
const NotificationSettingsPage = page(() => import('@/pages/settings/NotificationSettingsPage'));
const AccountSettingsPage = page(() => import('@/pages/settings/AccountSettingsPage'));
const NotFoundPage = page(() => import('@/pages/errors/NotFoundPage'));
const UnauthorizedPage = page(() => import('@/pages/errors/UnauthorizedPage'));

/** `handle.crumb` drives breadcrumbs; `dynamic` lets the page replace the label with a record name. */
const c = (crumb, extra = {}) => ({ handle: { crumb, ...extra } });

export const routes = [
  {
    element: <AuthLayout />,
    errorElement: <RouterErrorPage />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
    ],
  },
  {
    path: '/',
    element: <AdminLayout />,
    errorElement: <RouterErrorPage />,
    ...c('Dashboard'),
    children: [
      { index: true, element: <DashboardPage /> },
      {
        path: 'listings',
        ...c('Listings'),
        children: [
          { index: true, element: <ListingsPage /> },
          { path: 'new', element: <CreateListingPage />, ...c('Add listing') },
          { path: 'submissions', element: <ListingSubmissionsPage />, ...c('Pending submissions') },
          { path: 'applications', element: <ApplicationsPage />, ...c('Applications') },
          { path: 'classifieds', element: <ClassifiedsPage />, ...c('Jobs & classifieds') },
          {
            path: ':id',
            ...c('Listing details', { dynamic: true }),
            children: [
              { index: true, element: <ListingDetailsPage /> },
              { path: 'edit', element: <EditListingPage />, ...c('Edit') },
              { path: 'preview', element: <ListingPreviewPage />, ...c('Preview') },
            ],
          },
        ],
      },
      { path: 'categories', element: <CategoriesPage />, ...c('Categories') },
      { path: 'locations', element: <LocationsPage />, ...c('Locations') },
      {
        path: 'knowledge',
        ...c('Knowledge base'),
        children: [
          { index: true, element: <KnowledgeBasePage /> },
          { path: 'new', element: <KnowledgeDocumentFormPage />, ...c('New document') },
          { path: 'faqs', element: <FAQsPage />, ...c('FAQs') },
          { path: 'sync', element: <KnowledgeSyncPage />, ...c('Knowledge sync') },
          {
            path: ':id',
            ...c('Document', { dynamic: true }),
            children: [
              { index: true, element: <KnowledgeDocumentPage /> },
              { path: 'edit', element: <KnowledgeDocumentFormPage />, ...c('Edit') },
            ],
          },
        ],
      },
      {
        path: 'chatbot',
        ...c('AI assistant'),
        children: [
          { index: true, element: <ChatbotOverviewPage /> },
          {
            path: 'conversations',
            ...c('Conversations'),
            children: [
              { index: true, element: <ConversationsPage /> },
              { path: ':id', element: <ConversationDetailsPage />, ...c('Conversation', { dynamic: true }) },
            ],
          },
          { path: 'questions', element: <QuestionsReportPage />, ...c('Questions report') },
          { path: 'settings', element: <ChatbotSettingsPage />, ...c('Chatbot settings') },
        ],
      },
      {
        path: 'advertising',
        ...c('Advertisements'),
        children: [
          { index: true, element: <AdvertisementsPage /> },
          { path: 'featured', element: <FeaturedListingsPage />, ...c('Featured listings') },
        ],
      },
      {
        path: 'users',
        ...c('Users'),
        children: [
          { index: true, element: <UsersPage /> },
          { path: ':id', element: <UserDetailsPage />, ...c('User', { dynamic: true }) },
        ],
      },
      { path: 'administrators', element: <AdministratorsPage />, ...c('Administrators') },
      { path: 'feedback', element: <FeedbackPage />, ...c('Feedback') },
      { path: 'activity', element: <ActivityLogsPage />, ...c('Activity logs') },
      {
        path: 'monitoring',
        ...c('System', { to: '/monitoring/health' }),
        children: [
          { path: 'health', element: <SystemHealthPage />, ...c('System health') },
          { path: 'errors', element: <ErrorLogsPage />, ...c('Error logs') },
        ],
      },
      {
        path: 'settings',
        ...c('Settings', { to: '/settings/general' }),
        children: [
          { path: 'general', element: <GeneralSettingsPage />, ...c('General') },
          { path: 'appearance', element: <AppearanceSettingsPage />, ...c('Appearance') },
          { path: 'notifications', element: <NotificationSettingsPage />, ...c('Notifications') },
          { path: 'account', element: <AccountSettingsPage />, ...c('Account') },
        ],
      },
      { path: 'unauthorized', element: <UnauthorizedPage />, ...c('Access restricted') },
      { path: '*', element: <NotFoundPage />, ...c('Not found') },
    ],
  },
];
