import type { TokenVerifier } from '../auth/tokenVerifier.js';
import type { Env } from '../config/env.js';
import type { Database } from '../database/db.js';
import type { LlmProvider } from '../llm/provider.js';
import type { LexiconCache } from '../rag/lexicon.js';

/** Everything a request handler needs. Built once in server.ts; tests inject fakes. */
export interface AppContext {
  db: Database;
  llm: LlmProvider;
  verifier: TokenVerifier;
  config: Env;
  lexicon: LexiconCache;
  /** Embedding cache for repeated non-personal queries (keyed by model + normalised text). */
  embeddingCache: Map<string, number[]>;
}
