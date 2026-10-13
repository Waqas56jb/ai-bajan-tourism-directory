import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../app/context.js';
import { recordAudit } from '../audit/auditService.js';
import { ROLES, permissionsFor } from '../auth/permissions.js';
import { requirePermission } from '../middleware/auth.js';
import { body, csv, paged, paginationQuery, params, query, uuidParam, validate, searchText } from '../middleware/core.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';

/** The signed-in administrator (identity and permissions come from the server, not the client). */
export function meRoutes() {
  const r = Router();
  r.get('/', (req, res) => {
    res.json({ ...req.admin });
  });
  return r;
}

const ADMIN_SELECT = `id, email, display_name as "displayName", role, status, (auth_user_id is not null) as "linked",
  last_sign_in_at as "lastSignInAt", created_at as "createdAt", updated_at as "updatedAt"`;

export function administratorRoutes(ctx: AppContext) {
  const r = Router();
  const { db } = ctx;
  const t = db.t('admins');

  r.get('/', requirePermission('admins:manage'), async (_req, res) => {
    const rows = await db.many(`select ${ADMIN_SELECT} from ${t} order by created_at limit 500`);
    res.json({ items: rows.map((a) => ({ ...a, permissions: permissionsFor(a.role) })) });
  });

  /** Invite: creates the admin record; the person signs in with Supabase Auth using this email. */
  r.post(
    '/',
    requirePermission('admins:manage'),
    validate({ body: z.strictObject({ email: z.email().max(200).transform((e) => e.toLowerCase()), displayName: z.string().trim().max(120).default(''), role: z.enum(ROLES) }) }),
    async (req, res) => {
      const b = body<{ email: string; displayName: string; role: string }>(req);
      const row = await db.tx(async (client) => {
        const exists = await client.query(`select 1 from ${t} where email = $1`, [b.email]);
        if (exists.rowCount) throw conflict('An administrator with this email already exists.');
        const created = (await client.query(`insert into ${t} (email, display_name, role, status) values ($1, $2, $3, 'invited') returning ${ADMIN_SELECT}`, [b.email, b.displayName, b.role])).rows[0];
        await recordAudit(client, db, req, { action: 'admin.invited', entityType: 'admin', entityId: created.id, entityName: b.email, summary: `Role: ${b.role}` });
        return created;
      });
      res.status(201).json(row);
    },
  );

  r.patch(
    '/:id',
    requirePermission('admins:manage'),
    validate({ params: uuidParam, body: z.strictObject({ role: z.enum(ROLES).optional(), status: z.enum(['active', 'suspended']).optional(), displayName: z.string().trim().max(120).optional() }).refine((v) => Object.keys(v).length > 0, 'No changes supplied') }),
    async (req, res) => {
      const id = params<{ id: string }>(req).id;
      const b = body<{ role?: string; status?: string; displayName?: string }>(req);
      if (id === req.admin!.id && (b.role || b.status)) throw forbidden('You cannot change your own role or status.');
      const row = await db.tx(async (client) => {
        const cur = (await client.query(`select role, status from ${t} where id = $1 for update`, [id])).rows[0];
        if (!cur) throw notFound('Administrator');
        // Never leave the platform without an active super administrator.
        if (cur.role === 'super_admin' && ((b.role && b.role !== 'super_admin') || b.status === 'suspended')) {
          const others = await client.query(`select 1 from ${t} where role = 'super_admin' and status = 'active' and id <> $1`, [id]);
          if (!others.rowCount) throw conflict('At least one active super administrator must remain.');
        }
        const updated = (
          await client.query(
            `update ${t} set role = coalesce($2, role), status = coalesce($3, status), display_name = coalesce($4, display_name) where id = $1 returning ${ADMIN_SELECT}`,
            [id, b.role ?? null, b.status ?? null, b.displayName ?? null],
          )
        ).rows[0];
        await recordAudit(client, db, req, { action: 'admin.updated', entityType: 'admin', entityId: id, entityName: updated.email, changes: { role: b.role, status: b.status } });
        return updated;
      });
      res.json(row);
    },
  );

  return r;
}

const USER_SELECT = `u.id, u.email, u.display_name as "displayName", u.role, u.status, u.last_active_at as "lastActiveAt", u.created_at as "createdAt",
  (select count(*)::int from {{listings}} l where l.owner_user_id = u.id) as "listingCount"`;

export function userRoutes(ctx: AppContext) {
  const r = Router();
  const { db } = ctx;
  const select = USER_SELECT.replace('{{listings}}', db.t('listings'));

  r.get(
    '/',
    requirePermission('users:read'),
    validate({ query: z.strictObject({ ...paginationQuery, q: searchText(120).optional(), status: csv(z.enum(['active', 'invited', 'suspended', 'deactivated'])).optional() }) }),
    async (req, res) => {
      const f = query<{ page: number; pageSize: number; q?: string; status?: string[] }>(req);
      const where: string[] = [];
      const p: unknown[] = [];
      if (f.q) {
        p.push(`%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
        where.push(`(u.email ilike $${p.length} or u.display_name ilike $${p.length})`);
      }
      if (f.status?.length) {
        p.push(f.status);
        where.push(`u.status = any($${p.length})`);
      }
      const w = where.length ? `where ${where.join(' and ')}` : '';
      const total = await db.one<{ n: number }>(`select count(*)::int as n from ${db.t('users')} u ${w}`, p);
      const rows = await db.many(`select ${select} from ${db.t('users')} u ${w} order by u.created_at desc limit ${f.pageSize} offset ${(f.page - 1) * f.pageSize}`, p);
      res.json(paged(rows, total?.n ?? 0, f.page, f.pageSize));
    },
  );

  r.get('/:id', requirePermission('users:read'), validate({ params: uuidParam }), async (req, res) => {
    const row = await db.one(`select ${select} from ${db.t('users')} u where u.id = $1`, [params<{ id: string }>(req).id]);
    if (!row) throw notFound('User');
    res.json(row);
  });

  r.patch(
    '/:id',
    requirePermission('users:manage'),
    validate({ params: uuidParam, body: z.strictObject({ status: z.enum(['active', 'suspended', 'deactivated']).optional(), role: z.enum(['visitor', 'business_owner', 'listing_manager']).optional() }) }),
    async (req, res) => {
      const id = params<{ id: string }>(req).id;
      const b = body<{ status?: string; role?: string }>(req);
      if (!b.status && !b.role) throw badRequest('No changes supplied.');
      const row = await db.tx(async (client) => {
        const u = await client.query(`update ${db.t('users')} set status = coalesce($2, status), role = coalesce($3, role) where id = $1 returning id, email`, [id, b.status ?? null, b.role ?? null]);
        if (!u.rowCount) throw notFound('User');
        await recordAudit(client, db, req, { action: 'user.updated', entityType: 'user', entityId: id, entityName: u.rows[0].email, changes: b });
        return u.rows[0];
      });
      res.json(row);
    },
  );

  return r;
}
