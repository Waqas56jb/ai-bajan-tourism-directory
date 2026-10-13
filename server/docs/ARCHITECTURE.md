# Architecture

```
React public site (client/)      React admin (admin/)
          │  /api/v1/public, /chat           │  /api/v1/admin  (Supabase access token)
          └──────────────┬───────────────────┘
                         ▼
               Express API (server/src)
   auth ─ validation ─ rate limits ─ services ─ RAG pipeline
                         │ parameterised SQL (node-postgres, pooler :6543)
                         ▼
     Supabase Postgres — website_with_rag_* tables, pgvector (extensions schema)
                         ▲
               Sync worker (src/jobs/worker.ts) ── OpenAI embeddings
```

## Modules

| Folder | Responsibility |
| --- | --- |
| `config/` | Environment validation (names missing variables, never prints values). |
| `database/` | Pool, transactions, prefixed table names, guarded migration runner, isolation snapshot/verify. |
| `auth/`, `middleware/` | Supabase token verification, admin lookup, permission checks, visitor tokens, validation, rate limiting, error mapping. |
| `listings/`, `taxonomy/`, `knowledge/`, `advertising/`, `users/`, `feedback/`, `monitoring/` | REST modules (routes + service logic). Every write runs in a transaction with an audit row. |
| `sync/` | Durable queue (enqueue/coalesce), source loaders, indexer, worker. |
| `indexing/` | Chunking strategies (listing profile/details, FAQ, heading-aware documents). |
| `llm/` | Provider interface, OpenAI provider (timeouts, bounded retries, concurrency cap, error classification), fakes for tests. |
| `rag/` | Lexicon, query analysis, memory, query building, hybrid retrieval + fusion, evidence assessment, prompts, generation, answer validation. |
| `chat/` | Chat orchestration, persistence, diagnostics, visitor + admin conversation routes. |

## RAG pipeline (per message)

1. **Validate** (≤ 2000 chars, control characters stripped) and **resolve the conversation** —
   ownership is part of the SQL `WHERE` (`visitor_key = sha256(visitor id)`), so another visitor's
   conversation is indistinguishable from a missing one.
2. **Analyse** (`rag/queryAnalysis.ts`): normalise without losing meaning; detect intent
   (`directory_search`, `business_prospecting`, `product_availability`, `listing_detail`,
   `general_info`, `live_info`, `out_of_scope`, `security_probe`, `fabrication_request`, `greeting`);
   match categories/locations/listing names against a lexicon built from the **live database**
   (names, slugs, admin synonyms/aliases + a small reviewed synonym list); keep product phrases
   ("test strips") and the *direction* of the relationship (user sells **to** vs user buys **from**).
3. **Memory** (`rag/memory.ts`): follow-ups inherit category/location; new topics clear old
   constraints; "the second one"/"it" resolve against listings shown last; unresolved references
   produce a clarification. Memory is structured state + a deterministic summary — never authority.
4. **Retrieve** (`rag/retrieval.ts`), methods run in parallel with per-method timeouts:
   * *structured*: active listing chunks whose `category_ids`/`location_ids` (ancestors included) match;
   * *keyword*: PostgreSQL full-text search with an **OR** tsquery built from sanitised tokens and
     phrases (`website_with_rag_keyword_search`);
   * *semantic*: pgvector cosine search with the same embedding model used at indexing time
     (`website_with_rag_vector_search`), similarity floor `RETRIEVAL_MIN_SIMILARITY`;
   * one bounded refinement pass (singular forms / phrase words) if keyword search finds nothing.
5. **Fuse** with reciprocal rank fusion (k = 60) at source level, modest boosts for category,
   explicit location and product matches, near-duplicate removal.
6. **Assess evidence** (`rag/evidence.ts`) → `strong` / `partial` / `ambiguous` / `none` / `failure`
   with explicit caveats (`purchase_interest_not_verified`, `product_not_verified`,
   `attribute_missing`, `location_unresolved`, `refinement_not_matched`, `degraded_retrieval`).
7. **Answer**: no LLM call for greetings, security probes, fabrication requests and out-of-scope
   questions. Otherwise the LLM gets the system rules, a task block for the intent + caveats, the
   sources as escaped `<source>` data blocks, bounded history, and the question; output is strict
   JSON schema. **Validation** drops unknown citations and rejects answers containing phone numbers,
   emails or URLs that are not in the sources. If the model is unavailable, misconfigured or fails
   validation, a deterministic extractive answer is built from the same evidence.
8. **Persist** message, sources, memory state, summary, outcome; write a redacted retrieval log.

## Why the client's short question used to fail (and why it can't here)

The original backend was not available in this repository, so the specific faulty line could not be
inspected. The pipeline was designed against the causes listed in the brief, each covered by tests:

| Cause | Mitigation | Test |
| --- | --- | --- |
| AND-style keyword query (every word must co-occur) | OR tsquery + ranking + coverage | `queryAnalysis.test.ts`, `retrievalLogic.test.ts` |
| Stop-word stripping empties a short query | content-word fallback; category words kept | `queryAnalysis.test.ts` ("single-word…") |
| "sell X to Y" misread | explicit `relation`; dedicated prospecting intent + caveat | regression suite |
| Over-strict similarity threshold / vectors as only method | structured + keyword always run; vector is one signal | `retrievalLogic.test.ts` |
| Retrieval errors turned into "insufficient" | `failure` level + distinct technical message | regression ("database outage") |
| Prompt overusing "insufficient" | prompt forbids the word; distinct no-evidence messages per intent | regression suite (`forbidText`) |
| Stale/missing chunks | durable sync queue, version checks, verification after indexing | `sync.test.ts` |

## Synchronisation

* Every content write (listing/FAQ/document, plus category/location renames) enqueues a job **in the
  same transaction**. A partial unique index keeps at most one *pending* job per source — repeated
  edits coalesce.
* Becoming ineligible (unpublish, archive, reject, exclude, delete) deactivates chunks **immediately**
  in that transaction; the worker then cleans up.
* The worker claims jobs with `FOR UPDATE SKIP LOCKED` and a lease; expired leases are re-claimed.
  Before writing chunks it locks the source's index state and re-checks `content_version`; an older
  job is marked `superseded` instead of overwriting newer content. After committing it re-counts the
  active chunks for that version (verification) before reporting `completed`.
* Embeddings are skipped when the text hash is unchanged. Transient failures retry with exponential
  backoff + jitter up to `max_attempts`; permanent failures are `failed`, visible in the admin UI
  (`/admin/sync/jobs`), recorded in `error_events`, and retryable.
* Without `OPENAI_API_KEY` sources are indexed `keyword_only`. After adding a key run
  `POST /admin/sync/reindex-all` to add embeddings.

Synchronisation is **asynchronous** (seconds with the default 5 s poll), except un-publishing,
which takes effect immediately.

## Caching

* Lexicon (categories, locations, eligible listing names): in-process, 60 s TTL, invalidated on
  taxonomy writes in the same process.
* Query embeddings: in-process LRU keyed by model + text (non-personal).
* Answers are **not** cached (they depend on conversation state and current content).
* Public GET endpoints send short `Cache-Control` headers.

## Running in production

* API: `npm run build && npm start` behind HTTPS; set `TRUST_PROXY` to the number of proxies.
* Worker: run `npm run worker:prod` as a separate long-running process (or set
  `RUN_WORKER_IN_PROCESS=true` for a single small instance). It is safe to run several workers.
* Rate limits are per process (in-memory). With multiple API instances use a shared store.
