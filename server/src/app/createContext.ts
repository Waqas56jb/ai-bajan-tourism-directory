import { SupabaseTokenVerifier, type TokenVerifier } from '../auth/tokenVerifier.js';
import { env } from '../config/env.js';
import { createDatabase, type Database } from '../database/db.js';
import { OpenAiProvider } from '../llm/openaiProvider.js';
import type { LlmProvider } from '../llm/provider.js';
import { LexiconCache } from '../rag/lexicon.js';
import type { AppContext } from './context.js';

export function createContext(overrides: { db?: Database; llm?: LlmProvider; verifier?: TokenVerifier } = {}): AppContext {
  const config = env();
  const db = overrides.db ?? createDatabase(config.DB_SCHEMA);
  return {
    db,
    llm: overrides.llm ?? new OpenAiProvider(),
    verifier: overrides.verifier ?? new SupabaseTokenVerifier(),
    config,
    lexicon: new LexiconCache(db),
    embeddingCache: new Map(),
  };
}
