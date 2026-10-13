/**
 * Server-side permission model. Routes check permissions (what), never role names (who), so a
 * role change only needs editing here.
 */
export const PERMISSIONS = [
  'listings:read',
  'listings:write',
  'listings:publish',
  'listings:delete',
  'taxonomy:write',
  'knowledge:read',
  'knowledge:write',
  'knowledge:publish',
  'sync:manage',
  'conversations:read',
  'conversations:review',
  'conversations:export',
  'feedback:read',
  'feedback:manage',
  'ads:read',
  'ads:write',
  'users:read',
  'users:manage',
  'admins:manage',
  'analytics:read',
  'logs:read',
  'settings:read',
  'settings:write',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = ['super_admin', 'administrator', 'content_manager', 'moderator', 'analyst'] as const;
export type Role = (typeof ROLES)[number];

const ALL = [...PERMISSIONS];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  super_admin: ALL,
  administrator: ALL.filter((p) => p !== 'admins:manage'),
  content_manager: [
    'listings:read',
    'listings:write',
    'listings:publish',
    'taxonomy:write',
    'knowledge:read',
    'knowledge:write',
    'knowledge:publish',
    'sync:manage',
    'feedback:read',
    'ads:read',
    'analytics:read',
    'settings:read',
  ],
  moderator: [
    'listings:read',
    'listings:publish',
    'knowledge:read',
    'conversations:read',
    'conversations:review',
    'feedback:read',
    'feedback:manage',
    'analytics:read',
    'settings:read',
  ],
  analyst: ['listings:read', 'knowledge:read', 'feedback:read', 'ads:read', 'analytics:read', 'settings:read'],
};

export function hasPermission(role: Role | undefined, permission: Permission): boolean {
  return Boolean(role && ROLE_PERMISSIONS[role]?.includes(permission));
}

export function permissionsFor(role: Role): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}
