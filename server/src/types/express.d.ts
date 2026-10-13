import type { Permission, Role } from '../auth/permissions.js';

export interface AdminPrincipal {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  permissions: Permission[];
}

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      admin?: AdminPrincipal;
      visitorId?: string;
      /** Set when the server minted a new visitor token for this request. */
      issuedVisitorToken?: { token: string; expiresAt: string };
      validated?: { body?: unknown; query?: unknown; params?: unknown };
    }
  }
}

export {};
