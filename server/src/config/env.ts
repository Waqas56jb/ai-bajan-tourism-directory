import 'dotenv/config';
import { z } from 'zod';

/**
 * Environment validation. Values are never printed — errors name the variable only.
 * Secrets in here (service-role key, DB password, OpenAI key, session secret) are server-only.
 */

const bool = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const int = (def: number, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  z.coerce.number().int().min(min).max(max).default(def);

const num = (def: number, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  z.coerce.number().min(min).max(max).default(def);

const schemaName = z
  .string()
  .regex(/^(public|website_with_rag_test)$/, 'must be "public" or "website_with_rag_test"');

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: int(4000, 1, 65535),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  FRONTEND_ORIGINS: z.string().default(''),
  TRUST_PROXY: int(0, 0, 10),

  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(20).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),

  DATABASE_HOST: z.string().min(1),
  DATABASE_PORT: int(6543, 1, 65535),
  DATABASE_MIGRATION_PORT: int(5432, 1, 65535),
  DATABASE_NAME: z.string().min(1),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string().min(1),
  DATABASE_SSL_CA_FILE: z.string().optional(),
  DATABASE_POOL_MAX: int(10, 1, 50),
  DATABASE_STATEMENT_TIMEOUT_MS: int(15000, 1000, 120000),
  DB_SCHEMA: schemaName.default('public'),

  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_CHAT_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  EMBEDDING_DIMENSIONS: int(1536, 64, 2000),
  OPENAI_TIMEOUT_MS: int(30000, 1000, 120000),
  OPENAI_MAX_RETRIES: int(2, 0, 5),
  OPENAI_MAX_OUTPUT_TOKENS: int(700, 100, 4000),
  LLM_MAX_CONCURRENCY: int(4, 1, 32),

  SESSION_SECRET: z.string().min(32, 'must be at least 32 characters'),
  RATE_LIMIT_WINDOW_MS: int(60000, 1000),
  RATE_LIMIT_MAX_REQUESTS: int(120, 1),
  CHAT_RATE_LIMIT_MAX: int(20, 1),
  FEEDBACK_RATE_LIMIT_MAX: int(10, 1),

  RETRIEVAL_CANDIDATE_LIMIT: int(30, 5, 100),
  RETRIEVAL_CONTEXT_LIMIT: int(8, 1, 20),
  RETRIEVAL_KEYWORD_WEIGHT: num(1, 0, 5),
  RETRIEVAL_SEMANTIC_WEIGHT: num(1, 0, 5),
  RETRIEVAL_MIN_SIMILARITY: num(0.25, 0, 1),
  RETRIEVAL_MAX_CONTEXT_CHARS: int(9000, 1000, 40000),
  RETRIEVAL_TIMEOUT_MS: int(8000, 500, 60000),
  MEMORY_TURNS: int(6, 0, 30),
  CONVERSATION_TTL_DAYS: int(30, 1, 365),
  RETRIEVAL_LOG_RETENTION_DAYS: int(30, 1, 365),

  WORKER_POLL_INTERVAL_MS: int(5000, 500),
  WORKER_LEASE_SECONDS: int(120, 10, 3600),
  RUN_WORKER_IN_PROCESS: bool,
  /** Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; required for the internal sync endpoint. */
  CRON_SECRET: z.string().min(16).optional(),
  /**
   * When true (default) the PUBLIC chat endpoint is disabled until an OpenAI key is configured, so
   * visitors never get keyword-only answers. Admins can still test via /admin/chat/test.
   */
  PUBLIC_CHAT_REQUIRES_LLM: z.enum(['true', 'false', '1', '0']).default('true').transform((v) => v === 'true' || v === '1'),
});

export type Env = z.infer<typeof EnvSchema>;

export class ConfigError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid server configuration:\n  - ${problems.join('\n  - ')}`);
    this.name = 'ConfigError';
  }
}

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((i) => {
      const name = i.path.join('.') || '(root)';
      const missing = source[name] === undefined || source[name] === '';
      return missing ? `${name} is not set` : `${name} is invalid (${i.message})`;
    });
    throw new ConfigError(problems);
  }
  return result.data;
}

let cached: Env | undefined;
export function env(): Env {
  cached ??= parseEnv();
  return cached;
}

/** Test helper: replace the cached config. */
export function setEnvForTests(overrides: Partial<Env>) {
  cached = { ...env(), ...overrides };
}

export const isProduction = () => env().NODE_ENV === 'production';
export const llmConfigured = () => env().OPENAI_API_KEY.length > 0;

export function allowedOrigins(): string[] {
  return env()
    .FRONTEND_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
