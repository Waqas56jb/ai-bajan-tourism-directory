/** Status vocabularies used across the dashboard. Each has a label and a badge tone. */

export const LISTING_STATUSES = {
  published: { label: 'Published', tone: 'success' },
  pending: { label: 'Pending', tone: 'warning' },
  draft: { label: 'Draft', tone: 'neutral' },
  rejected: { label: 'Rejected', tone: 'danger' },
  archived: { label: 'Archived', tone: 'muted' },
};

export const PUBLICATION_STATUSES = {
  published: { label: 'Published', tone: 'success' },
  draft: { label: 'Draft', tone: 'neutral' },
  review: { label: 'In review', tone: 'warning' },
  archived: { label: 'Archived', tone: 'muted' },
};

export const INDEXING_STATUSES = {
  indexed: { label: 'Indexed', tone: 'success' },
  pending: { label: 'Pending', tone: 'warning' },
  processing: { label: 'Processing', tone: 'info' },
  failed: { label: 'Failed', tone: 'danger' },
  excluded: { label: 'Excluded', tone: 'muted' },
  not_indexed: { label: 'Not indexed', tone: 'neutral' },
};

export const SYNC_STATUSES = {
  completed: { label: 'Completed', tone: 'success' },
  pending: { label: 'Pending', tone: 'warning' },
  running: { label: 'Running', tone: 'info' },
  failed: { label: 'Failed', tone: 'danger' },
};

export const SYNC_OPERATIONS = {
  initial: 'Initial indexing',
  update: 'Update',
  delete: 'Delete from index',
  reindex: 'Reindex',
  retry: 'Retry',
};

export const SOURCE_TYPES = {
  listing: 'Business listing',
  guide: 'Tourism guide',
  faq: 'FAQ',
  policy: 'Approved policy',
  upload: 'Uploaded document',
  article: 'Manually written article',
};

export const CONVERSATION_STATUSES = {
  answered: { label: 'Answered', tone: 'success' },
  partial: { label: 'Partially answered', tone: 'info' },
  fallback: { label: 'Fallback', tone: 'warning' },
  error: { label: 'Error', tone: 'danger' },
};

export const REVIEW_STATUSES = {
  unreviewed: { label: 'Unreviewed', tone: 'neutral' },
  reviewed: { label: 'Reviewed', tone: 'success' },
  flagged: { label: 'Flagged', tone: 'danger' },
};

export const AD_STATUSES = {
  active: { label: 'Active', tone: 'success' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  draft: { label: 'Draft', tone: 'neutral' },
  paused: { label: 'Paused', tone: 'warning' },
  ended: { label: 'Ended', tone: 'muted' },
  archived: { label: 'Archived', tone: 'muted' },
};

export const AD_PLACEMENTS = {
  homepage_banner: 'Homepage banner',
  category_page: 'Category page placement',
  featured_directory: 'Featured directory placement',
  sidebar: 'Sidebar promotion',
};

export const FEATURED_PLACEMENTS = {
  homepage: 'Homepage — Local favourites',
  category: 'Category page — top slot',
  destination: 'Destination page',
  chatbot: 'Chatbot suggestions',
};

export const USER_ROLES = {
  visitor: 'Visitor',
  business_owner: 'Business owner',
  listing_manager: 'Listing manager',
  moderator: 'Moderator',
  administrator: 'Administrator',
};

export const ACCOUNT_STATUSES = {
  active: { label: 'Active', tone: 'success' },
  invited: { label: 'Invited', tone: 'info' },
  suspended: { label: 'Suspended', tone: 'danger' },
  deactivated: { label: 'Deactivated', tone: 'muted' },
};

export const FEEDBACK_TYPES = {
  incorrect_answer: 'Incorrect chatbot answer',
  missing_info: 'Missing business information',
  incorrect_location: 'Incorrect location',
  broken_link: 'Broken listing link',
  outdated: 'Outdated information',
  general: 'General feedback',
};

export const FEEDBACK_STATUSES = {
  new: { label: 'New', tone: 'info' },
  reviewed: { label: 'Reviewed', tone: 'warning' },
  resolved: { label: 'Resolved', tone: 'success' },
  reopened: { label: 'Reopened', tone: 'danger' },
};

export const PRIORITIES = {
  high: { label: 'High', tone: 'danger' },
  medium: { label: 'Medium', tone: 'warning' },
  low: { label: 'Low', tone: 'neutral' },
};

export const SEVERITIES = {
  critical: { label: 'Critical', tone: 'danger' },
  error: { label: 'Error', tone: 'danger' },
  warning: { label: 'Warning', tone: 'warning' },
  info: { label: 'Info', tone: 'info' },
};

export const ERROR_CATEGORIES = {
  retrieval: 'Retrieval failure',
  indexing: 'Document indexing failure',
  timeout: 'API timeout',
  validation: 'Validation error',
  rate_limit: 'Rate limit',
  external: 'External service failure',
};

export const SERVICES = {
  public_site: 'Public website',
  admin: 'Admin frontend',
  api: 'Node.js API',
  supabase: 'Supabase',
  openai: 'OpenAI API',
  rag: 'RAG retrieval pipeline',
  sync: 'Knowledge synchronization',
  files: 'File processing',
};

export const LISTING_TYPES = ['Business', 'Attraction', 'Service', 'Event venue', 'Public facility'];
export const PRICE_RANGES = ['$', '$$', '$$$', '$$$$', 'Free', 'Varies'];
export const AUDIENCES = [
  'Families',
  'Couples',
  'Solo travellers',
  'Groups',
  'Business travellers',
  'Locals',
];
export const LANGUAGES = ['English', 'Spanish', 'French', 'Portuguese', 'German', 'Italian'];
