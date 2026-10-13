# Verification report — 2026-10-13

Everything below was executed in this environment; results are copied from actual output.

## Summary

| Check | Result |
| --- | --- |
| TypeScript (`npm run typecheck`, src + tests + scripts) | 0 errors |
| Production build (`npm run build`) | OK |
| Full test suite (`npx vitest run`) | **8 files, 200/200 tests passed** (676 s, remote DB) |
| — unit (no DB) | 98 passed |
| — integration: API (`tests/integration/api.test.ts`) | passed |
| — integration: sync queue/worker (`sync.test.ts`) | passed |
| — RAG regression, both modes (`tests/rag/regression.test.ts`) | 36 passed |
| — security (`tests/security/security.test.ts`) | 15 passed (incl. real Supabase token rejection) |
| RAG evaluation (`npm run eval:rag`, fake provider, hybrid retrieval) | **35/35**, intent accuracy 1.0, source recall 1.0, precision 0.943, leaks 0, "insufficient" answers 0 |
| Production migration (`public`) | 2 migrations applied; re-run = no-op; isolation check passed (125 unrelated tables) |
| `npm run db:verify -- --schema public` | **23/23 checks passed** |
| Live smoke test (compiled server on `public`) | `/health/ready` = degraded (no OpenAI key), admin 401 without/with forged token, chat answers |
| Secret scan of repository | credentials only in `server/.env` (git-ignored) |

## Database isolation (production)

* Fresh read-only baseline taken immediately before migrating (`inventory/before-public.raw.json`).
* Created: 22 `website_with_rag_*` tables, 6 `website_with_rag_*` functions, prefixed indexes and
  triggers. RLS enabled on all; 0 policies; `anon`/`authenticated` hold no table or function privileges.
* Supabase REST API with the publishable key: HTTP 401 for `website_with_rag_listings`,
  `…_conversations`, `…_admins` and the retrieval RPC.
* Compared with the baseline: no unrelated table added/removed, RLS flags, 14 functions, 65 policies,
  extensions (incl. `vector@0.8.0`, not modified) and 3 storage buckets unchanged; row counts of the
  other 125 tables identical to the baseline at verification time.
* Data written to production: reference taxonomy only (Barbados + 11 parishes + 6 towns, 12
  categories), and one smoke-test chat conversation. **No businesses were seeded.**
* Integration tests used the separate `website_with_rag_test` schema (same guarded migrations).

## Client regression: "How do I find pharmacies to sell test strips to?"

With the fixture directory (2 published pharmacies, 1 draft, 1 archived, private notes, an internal
document and a prompt-injection document):

* intent `business_prospecting`, category Pharmacies, product phrase "test strips" preserved;
* evidence `strong`; answer lists **Harbour Lights Pharmacy** and **Westside Chemist** with their
  public contact details and states that the directory doesn't say whether they buy test strips;
* draft/archived pharmacies, private notes, the internal document and the injected phone number never
  appear; the word "insufficient" never appears;
* the same holds through the LLM path (fake model), where a fabricated phone number from the model
  is rejected and replaced by the extractive answer;
* all 17 variations from the brief are covered, plus memory follow-ups, topic switches, named
  listing details, unknown businesses, out-of-scope, live-data and injection prompts.

On the production database today (no listings yet) the same question returns an honest, specific
"the directory doesn't have information about who buys test strips" message — not "insufficient".

## Not verified / limitations

* **No `OPENAI_API_KEY` was provided.** Real embeddings and real model answers were not exercised;
  the LLM path is tested with a deterministic fake that uses the real pgvector SQL. Once a key is
  set: restart, `POST /admin/sync/reindex-all`, then `npm run eval:rag -- --openai` to confirm the
  embedding dimensions (1536) and calibrate `RETRIEVAL_MIN_SIMILARITY` on real vectors.
* The original backend that produced the "insufficient" bug was not in this repository, so the
  exact faulty line could not be identified; the known causes are each covered by tests.
* Supabase Auth sign-in with a real admin user was not exercised end-to-end (no test user
  credentials). Token rejection was tested against the real Supabase Auth endpoint; authorisation
  logic was tested with a fake verifier.
* The admin (`admin/`) and public (`client/`) frontends still use mock services; they were not
  modified. docs/API.md is the integration contract.
* File uploads support .txt/.md/.csv only; PDF/DOCX are rejected with 415 (not silently accepted).
* Rate limiting is per process (in-memory).
