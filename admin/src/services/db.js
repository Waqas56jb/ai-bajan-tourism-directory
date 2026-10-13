/** All demo collections in one place (avoids circular imports between services). */
import { createCollection } from './mockApi';
import { mockListings } from '@/data/mockListings';
import { mockCategories } from '@/data/mockCategories';
import { mockLocations } from '@/data/mockLocations';
import { mockKnowledgeDocuments, mockFaqs, mockSyncJobs } from '@/data/mockKnowledge';
import { mockConversations } from '@/data/mockConversations';
import { mockAdvertisements, mockFeaturedPlacements } from '@/data/mockAdvertisements';
import { mockUsers, mockAdmins } from '@/data/mockUsers';
import { mockFeedback } from '@/data/mockFeedback';
import { mockActivity } from '@/data/mockActivity';
import { mockErrorLogs, mockNotifications } from '@/data/mockSystemHealth';

export const db = {
  listings: createCollection('listings', mockListings),
  categories: createCollection('categories', mockCategories),
  locations: createCollection('locations', mockLocations),
  documents: createCollection('knowledge_documents', mockKnowledgeDocuments),
  faqs: createCollection('faqs', mockFaqs),
  syncJobs: createCollection('sync_jobs', mockSyncJobs),
  conversations: createCollection('conversations', mockConversations),
  ads: createCollection('advertisements', mockAdvertisements),
  featured: createCollection('featured_placements', mockFeaturedPlacements),
  users: createCollection('users', mockUsers),
  admins: createCollection('administrators', mockAdmins),
  feedback: createCollection('feedback', mockFeedback),
  activity: createCollection('activity', mockActivity),
  errorLogs: createCollection('error_logs', mockErrorLogs),
  notifications: createCollection('notifications', mockNotifications),
};
