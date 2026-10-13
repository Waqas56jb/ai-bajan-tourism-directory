/**
 * Platform users and administrators (DEMO). No accounts are created, no invitations are sent
 * and no permissions are enforced — the backend must do all of that.
 */
import { db } from './db';
import { simulate, newId, notFound, conflict } from './mockApi';
import { logActivity } from './activityService';
import { ADMIN_ROLES } from '@/utils/permissions';
import { USER_ROLES } from '@/utils/constants';
import { CURRENT_ADMIN_ID } from '@/data/mockUsers';

const nowIso = () => new Date().toISOString();

export const getUsers = () =>
  simulate(() =>
    db.users
      .all()
      .map((u) => ({ ...u, listingCount: db.listings.all().filter((l) => l.ownerId === u.id).length })),
  );

export const getUserById = (id) =>
  simulate(() => {
    const user = db.users.find(id);
    if (!user) throw notFound('User');
    const listings = db.listings.all().filter((l) => l.ownerId === user.id || l.submittedBy === user.id);
    const activity = db.activity
      .all()
      .filter((e) => e.actor === user.name)
      .slice(0, 10);
    return { ...user, listings, activity };
  });

export const updateUser = (id, changes) =>
  simulate(
    () => {
      const existing = db.users.find(id);
      if (!existing) throw notFound('User');
      const next = db.users.patch(id, { ...changes, updatedAt: nowIso() });
      const summary = changes.role
        ? `Role changed to ${USER_ROLES[changes.role]}.`
        : changes.status
          ? `Status changed to ${changes.status}.`
          : 'User updated.';
      logActivity({
        action: 'role_changed',
        entityType: 'user',
        entityId: id,
        entityName: next.name,
        summary,
      });
      return next;
    },
    { write: true },
  );

export const getAdministrators = () => simulate(() => db.admins.all());

export const getAdministratorById = (id) =>
  simulate(() => {
    const admin = db.admins.find(id);
    if (!admin) throw notFound('Administrator');
    return admin;
  });

export const inviteAdministrator = ({ name, email, role, title }) =>
  simulate(
    () => {
      if (db.admins.all().some((a) => a.email.toLowerCase() === email.toLowerCase()))
        throw conflict('An administrator with that email already exists.');
      const admin = {
        id: newId('adm'),
        name,
        email,
        role,
        title: title ?? '',
        status: 'invited',
        lastLoginAt: null,
        createdAt: nowIso(),
      };
      db.admins.insert(admin);
      logActivity({
        action: 'role_changed',
        entityType: 'admin',
        entityId: admin.id,
        entityName: name,
        summary: `Invited as ${ADMIN_ROLES[role].label} (demo — no email sent).`,
      });
      return admin;
    },
    { write: true },
  );

export const updateAdministrator = (id, changes) =>
  simulate(
    () => {
      const existing = db.admins.find(id);
      if (!existing) throw notFound('Administrator');
      if (
        id === CURRENT_ADMIN_ID &&
        (changes.status === 'deactivated' || (changes.role && changes.role !== 'super_admin'))
      ) {
        throw conflict('You can’t deactivate or downgrade your own account.');
      }
      const next = db.admins.patch(id, changes);
      const summary = changes.role
        ? `Role changed to ${ADMIN_ROLES[changes.role].label}.`
        : `Status changed to ${changes.status}.`;
      logActivity({
        action: 'role_changed',
        entityType: 'admin',
        entityId: id,
        entityName: next.name,
        summary,
      });
      return next;
    },
    { write: true },
  );
