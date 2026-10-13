/**
 * Bootstrap an administrator (the API has no endpoint to create the first one).
 *   npm run admin:grant -- --email owner@example.com --role super_admin [--name "Jane Doe"]
 * The person then signs in with Supabase Auth using that email; the first verified sign-in links
 * their Supabase user id to this record. Re-running updates the role (never deletes anything).
 */
import { env } from '../src/config/env.js';
import { createDatabase } from '../src/database/db.js';
import { ROLES } from '../src/auth/permissions.js';

const args = process.argv.slice(2);
const get = (flag: string) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const email = get('--email')?.toLowerCase();
const role = get('--role') ?? 'super_admin';
const name = get('--name') ?? '';

if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Usage: npm run admin:grant -- --email you@example.com --role super_admin');
  process.exit(1);
}
if (!(ROLES as readonly string[]).includes(role)) {
  console.error(`Role must be one of: ${ROLES.join(', ')}`);
  process.exit(1);
}

const db = createDatabase(env().DB_SCHEMA);
try {
  const row = await db.one<{ id: string; status: string }>(
    `insert into ${db.t('admins')} (email, display_name, role, status) values ($1, $2, $3, 'invited')
     on conflict (email) do update set role = excluded.role returning id, status`,
    [email, name, role],
  );
  console.log(`Administrator ${email} → ${role} (${row!.status}). They can now sign in with Supabase Auth.`);
} finally {
  await db.close();
}
