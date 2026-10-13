import { daysAgo, minutesAgo } from './helpers';

/**
 * DEMO platform users. Fictional names; email addresses use the reserved example.com domain.
 * Roles are illustrative frontend roles, not production permissions.
 */
const U = (id, name, role, status, registered, lastActive, extra = {}) => ({
  id,
  name,
  email: `${name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, '.')
    .replace(/\.$/, '')}@example.com`,
  role,
  status,
  createdAt: daysAgo(registered),
  updatedAt: daysAgo(Math.min(registered, lastActive + 3)),
  lastActiveAt: lastActive === 0 ? minutesAgo(25) : daysAgo(lastActive, 15),
  phone: null,
  organisation: null,
  ...extra,
});

export const mockUsers = [
  U('usr-01', 'Renée Clarke', 'business_owner', 'active', 210, 1, { organisation: 'Coral Cove Guesthouse' }),
  U('usr-02', 'Marcus Holder', 'business_owner', 'active', 180, 3, {
    organisation: 'Turquoise Tide Catamaran Cruises',
  }),
  U('usr-03', 'Tanya Brathwaite', 'business_owner', 'active', 150, 0, {
    organisation: 'Pelican Craft Collective',
  }),
  U('usr-04', 'Andre Griffith', 'business_owner', 'invited', 6, 6, {
    organisation: 'Sunset Rum Shack (submission)',
  }),
  U('usr-05', 'Keisha Alleyne', 'listing_manager', 'active', 320, 0),
  U('usr-06', 'Jamal Small', 'moderator', 'active', 290, 2),
  U('usr-07', 'Olivia Bennett', 'visitor', 'active', 45, 9),
  U('usr-08', 'Daniel Forde', 'visitor', 'active', 30, 12),
  U('usr-09', 'Priya Nair', 'visitor', 'suspended', 75, 40, {
    note: 'Suspended for repeated spam reports (demo).',
  }),
  U('usr-10', 'Shawn Cumberbatch', 'business_owner', 'active', 260, 5, {
    organisation: 'Island Hop Taxi Service',
  }),
  U('usr-11', 'Lisa Moreau', 'visitor', 'active', 12, 1),
  U('usr-12', 'Kevin Best', 'business_owner', 'active', 140, 8, { organisation: 'Seabreeze Day Spa' }),
  U('usr-13', 'Natalie King', 'listing_manager', 'deactivated', 400, 120),
  U('usr-14', 'Omar Thompson', 'business_owner', 'active', 21, 2, {
    organisation: 'Harbourside Kitchen (submission)',
  }),
  U('usr-15', 'Grace Waithe', 'visitor', 'active', 3, 0),
  U('usr-16', 'Hannah Lewis', 'business_owner', 'active', 95, 4, { organisation: 'Breadfruit & Co. Café' }),
  U('usr-17', 'Malik Jordan', 'moderator', 'active', 230, 1),
  U('usr-18', 'Sophie Carter', 'visitor', 'deactivated', 300, 200),
];

/** DEMO administrators (admin dashboard accounts). */
export const mockAdmins = [
  {
    id: 'adm-01',
    name: 'Alexis Demo',
    email: 'admin.demo@example.com',
    role: 'super_admin',
    status: 'active',
    lastLoginAt: minutesAgo(5),
    createdAt: daysAgo(420),
    title: 'Platform lead',
  },
  {
    id: 'adm-02',
    name: 'Keisha Alleyne',
    email: 'keisha.alleyne@example.com',
    role: 'administrator',
    status: 'active',
    lastLoginAt: daysAgo(0, 8),
    createdAt: daysAgo(320),
    title: 'Directory manager',
  },
  {
    id: 'adm-03',
    name: 'Jamal Small',
    email: 'jamal.small@example.com',
    role: 'moderator',
    status: 'active',
    lastLoginAt: daysAgo(2, 14),
    createdAt: daysAgo(290),
    title: 'Content moderator',
  },
  {
    id: 'adm-04',
    name: 'Rhea Phillips',
    email: 'rhea.phillips@example.com',
    role: 'content_editor',
    status: 'active',
    lastLoginAt: daysAgo(1, 11),
    createdAt: daysAgo(150),
    title: 'Knowledge editor',
  },
  {
    id: 'adm-05',
    name: 'Tom Ashby',
    email: 'tom.ashby@example.com',
    role: 'analyst',
    status: 'invited',
    lastLoginAt: null,
    createdAt: daysAgo(4),
    title: 'Marketing analyst',
  },
  {
    id: 'adm-06',
    name: 'Natalie King',
    email: 'natalie.king@example.com',
    role: 'content_editor',
    status: 'deactivated',
    lastLoginAt: daysAgo(120),
    createdAt: daysAgo(400),
    title: 'Former editor',
  },
];

export const CURRENT_ADMIN_ID = 'adm-01';
