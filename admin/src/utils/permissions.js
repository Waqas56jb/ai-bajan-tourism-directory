/**
 * DEMO role/permission model for the frontend only.
 *
 * Hiding a button in the browser is NOT access control. The future Node.js API (and Supabase
 * row-level security) must enforce every permission server-side.
 */
export const PERMISSIONS = {
  manage_listings: 'Manage listings',
  approve_submissions: 'Approve submissions',
  manage_knowledge: 'Manage knowledge base',
  review_conversations: 'Review chatbot conversations',
  manage_ads: 'Manage advertisements',
  view_analytics: 'View analytics',
  manage_settings: 'Manage platform settings',
  manage_admins: 'Manage administrators',
};

export const ADMIN_ROLES = {
  super_admin: { label: 'Super administrator', permissions: Object.keys(PERMISSIONS) },
  administrator: {
    label: 'Administrator',
    permissions: [
      'manage_listings',
      'approve_submissions',
      'manage_knowledge',
      'review_conversations',
      'manage_ads',
      'view_analytics',
      'manage_settings',
    ],
  },
  content_editor: {
    label: 'Content editor',
    permissions: ['manage_listings', 'manage_knowledge', 'view_analytics'],
  },
  moderator: {
    label: 'Moderator',
    permissions: ['approve_submissions', 'review_conversations', 'view_analytics'],
  },
  analyst: { label: 'Analyst (read-only)', permissions: ['view_analytics'] },
};

export function can(role, permission) {
  return Boolean(ADMIN_ROLES[role]?.permissions.includes(permission));
}
