import type { RequestHandler } from 'express';
import type { AppContext } from '../app/context.js';
import { hasPermission, permissionsFor, type Permission, type Role } from '../auth/permissions.js';
import { issueVisitorToken, verifyVisitorToken } from '../auth/visitorToken.js';
import { forbidden, unauthorized } from '../utils/errors.js';

interface AdminRow {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  status: string;
  auth_user_id: string | null;
}

/**
 * Requires a valid Supabase access token AND an active row in website_with_rag_admins.
 * Identity comes only from the verified token — never from headers or the request body.
 */
export function authenticateAdmin(ctx: AppContext): RequestHandler {
  return async (req, _res, next) => {
    const header = req.header('authorization') ?? '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return next(unauthorized());
    const identity = await ctx.verifier.verify(match[1].trim());
    if (!identity) return next(unauthorized('Your session is invalid or has expired. Please sign in again.'));

    const t = ctx.db.t('admins');
    let admin = await ctx.db.one<AdminRow>(
      `select id, email, display_name, role, status, auth_user_id from ${t} where auth_user_id = $1`,
      [identity.authUserId],
    );
    // First sign-in of an invited administrator: link by confirmed email exactly once.
    if (!admin && identity.email && identity.emailConfirmed) {
      admin = await ctx.db.one<AdminRow>(
        `update ${t} set auth_user_id = $1, status = case when status = 'invited' then 'active' else status end,
                last_sign_in_at = now()
          where email = $2 and auth_user_id is null
          returning id, email, display_name, role, status, auth_user_id`,
        [identity.authUserId, identity.email],
      );
    }
    if (!admin) return next(forbidden('This account is not an AI Bajan administrator.'));
    if (admin.status !== 'active') return next(forbidden('This administrator account is not active.'));

    req.admin = {
      id: admin.id,
      email: admin.email,
      displayName: admin.display_name,
      role: admin.role,
      permissions: permissionsFor(admin.role),
    };
    next();
  };
}

export function requirePermission(...needed: Permission[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.admin) return next(unauthorized());
    const missing = needed.filter((p) => !hasPermission(req.admin!.role, p));
    if (missing.length) return next(forbidden());
    next();
  };
}

/**
 * Anonymous visitor identity for the public chatbot. A valid X-Visitor-Token is honoured;
 * otherwise a new one is minted and returned in the response body (`visitorToken`).
 */
export function visitorSession(ctx: AppContext, { mint }: { mint: boolean }): RequestHandler {
  return (req, _res, next) => {
    const visitorId = verifyVisitorToken(ctx.config.SESSION_SECRET, req.header('x-visitor-token') ?? undefined);
    if (visitorId) req.visitorId = visitorId;
    else if (mint) {
      const issued = issueVisitorToken(ctx.config.SESSION_SECRET);
      req.visitorId = issued.visitorId;
      req.issuedVisitorToken = { token: issued.token, expiresAt: issued.expiresAt };
    }
    next();
  };
}
