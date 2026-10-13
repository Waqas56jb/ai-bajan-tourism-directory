import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

export interface VerifiedIdentity {
  authUserId: string;
  email: string;
  emailConfirmed: boolean;
}

/** Verifies a Supabase Auth access token server-side. Returns null for invalid/expired tokens. */
export interface TokenVerifier {
  verify(token: string): Promise<VerifiedIdentity | null>;
}

/**
 * Uses Supabase Auth's own /user endpoint (auth.getUser), which validates the signature, expiry
 * and session revocation on the Supabase side — no JWT secret is needed in this service.
 *
 * NOTE: the Supabase project is shared with other applications, so a valid token alone proves
 * nothing about AI Bajan access. Authorization always comes from website_with_rag_admins.
 */
export class SupabaseTokenVerifier implements TokenVerifier {
  private readonly client: SupabaseClient;

  constructor() {
    const e = env();
    const key = e.SUPABASE_ANON_KEY ?? e.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error('SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY) must be set to verify tokens');
    this.client = createClient(e.SUPABASE_URL, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }

  async verify(token: string): Promise<VerifiedIdentity | null> {
    if (!/^[A-Za-z0-9._-]{20,4096}$/.test(token)) return null;
    const { data, error } = await this.client.auth.getUser(token);
    if (error || !data.user) {
      // 401/403 from Supabase = bad token. Anything else (network, 5xx) must not be treated as
      // "anonymous" — surface it so the request fails closed with a 503.
      const status = (error as { status?: number } | null)?.status;
      if (!error || status === 401 || status === 403 || status === 400) return null;
      throw Object.assign(new Error('Authentication service unavailable'), { code: 'AUTH_UNAVAILABLE' });
    }
    return {
      authUserId: data.user.id,
      email: (data.user.email ?? '').toLowerCase(),
      emailConfirmed: Boolean(data.user.email_confirmed_at),
    };
  }
}
