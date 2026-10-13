# Database: inventory, isolation and owned objects

## Pre-change inventory (read-only, 2026-10-13)

Taken with `npm run db:inventory -- inventory/before.raw.json` inside a `READ ONLY` transaction
(the raw file is git-ignored because it lists other projects' objects).

* PostgreSQL 17.6 (Supabase), connected as `postgres` via the Tokyo pooler.
* Schemas: `auth`, `extensions`, `graphql`, `graphql_public`, `public`, `realtime`, `storage`, `vault`.
* Extensions: `pg_stat_statements 1.11`, `pgcrypto 1.3`, `plpgsql 1.0`, `supabase_vault 0.3.1`,
  `uuid-ossp 1.1`, **`vector 0.8.0` (schema `extensions`)** — reused as-is, not altered.
* `public` held **125 tables owned by other projects**, identified by prefix:
  `ai_conductor_*`, `ai_knowledge_chat_*`, `ai_workspace_*`, `dvsa_driving_*`, `nexpept_*`,
  `recruitment_staffing_platform_*`, `shopify_store_database_*`, `whatsapp_visitor_management_*`,
  plus generic `admin_*` (4) and `chat_*`/`chatbot_context` (8) tables whose owner could not be
  determined — **left untouched**.
* 14 public functions (`ai_knowledge_chat_*`, `ai_workspace_*`), 19 triggers, 65 RLS policies,
  300 indexes, 3 storage buckets (`ai_knowledge_chat_documents`, `ai-workspace-files`,
  `shopify_store_database_assets`). No Supabase CLI migration history table.
* **No pre-existing `website_with_rag_*` objects** → nothing to reuse, nothing renamed.

## Isolation guarantees

* Every object we create is named `website_with_rag_*` (tables, indexes, triggers, functions,
  constraints). Enforced by `src/database/sqlSafety.ts` before any migration runs, and re-checked by
  `npm run db:verify`.
* Migration files may not contain `DROP`, `TRUNCATE`, `DELETE`, `GRANT`, `CREATE EXTENSION` or
  database-wide `ALTER`; violations abort before connecting.
* Each migration runs in a transaction, is recorded with a SHA-256 checksum in
  `website_with_rag_schema_migrations`, and an edited applied file is refused.
* Before/after every migration run the runner snapshots all **unrelated** objects (table list,
  column signatures, RLS flags, function definitions, triggers, policies, extensions, buckets) and
  fails loudly on any difference. Row counts of other apps are reported but not attributed (those
  apps are live — e.g. `ai_workspace_tasks` grew during our test-schema run).
* No storage bucket is created (uploads are extracted to text and stored in the documents table).
* Integration tests run in a separate schema, `website_with_rag_test`, which mirrors the production
  tables; browser roles have no usage on it and it is not exposed by the REST API.

## Access control (RLS)

All browser-facing access goes through the API. On every `website_with_rag_*` table:
RLS **enabled**, **no policies** (deny-by-default), and all privileges **revoked** from `anon` and
`authenticated`; `EXECUTE` on our functions revoked from `PUBLIC`, `anon`, `authenticated`
(`supabase/policies/harden.sql`, re-applied after every migration). The API connects with the
database role and enforces authentication/authorisation itself before every privileged query.

## Objects owned by AI Bajan

Tables (21 + migrations): `admins`, `users`, `categories`, `locations`, `listings`, `faqs`,
`knowledge_documents`, `index_state`, `knowledge_chunks`, `sync_jobs`, `conversations`, `messages`,
`conversation_notes`, `retrieval_logs`, `feedback`, `ads`, `featured_listings`, `audit_logs`,
`content_revisions`, `settings`, `error_events`, `schema_migrations` — all prefixed
`website_with_rag_`.

Functions: `website_with_rag_touch_updated_at`, `…_locations_check_hierarchy`,
`…_listings_search_document`, `…_keyword_search`, `…_vector_search`, `…_claim_sync_jobs`.

## Delete / cascade behaviour

| Relationship | On delete |
| --- | --- |
| messages, conversation_notes → conversation | CASCADE (only the retention purge deletes conversations; flagged ones are kept) |
| featured_listings → listing | CASCADE (a placement is meaningless without its listing) |
| faqs/documents/ads/feedback → listing, category, location | SET NULL (content survives) |
| listings → category / location | RESTRICT (API asks to reassign first) |
| categories/locations → parent | RESTRICT (children must move first) |
| created_by / updated_by → admin | SET NULL (history survives) |
| knowledge_chunks / index_state | no FK; maintained by the sync worker (derived data) |

## Vector index choice

`HNSW (vector_cosine_ops, m=16, ef_construction=64)` on `knowledge_chunks.embedding`
(`vector(1536)`, matching `text-embedding-3-small`). HNSW needs no training data, works from an
empty table, keeps recall as rows are added, and is supported for 1536 dimensions (< 2000 limit).
IVFFlat would need to be rebuilt once the corpus grows and gives poor recall on tiny tables.
Filtering by `is_active`/category happens in the same query; with very selective filters on a large
corpus consider pgvector 0.8 iterative scans (`hnsw.iterative_scan`). Changing the embedding model
to one with different dimensions requires a new migration (the runner refuses a mismatch).

## Retention

* `retrieval_logs`: deleted after `RETRIEVAL_LOG_RETENTION_DAYS` (default 30). Queries are stored
  redacted (emails/phone numbers removed), never raw message text.
* `conversations` (+ messages): deleted after `CONVERSATION_TTL_DAYS` of inactivity unless flagged
  for review. Visitors are identified only by a hash of a random id — no names, IPs or emails.
