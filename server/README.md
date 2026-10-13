# AI Bajan — backend API & RAG chatbot

Node.js 20+ · TypeScript · Express 5 · Supabase PostgreSQL + pgvector · OpenAI (optional at runtime).

* REST API for the public directory and the admin dashboard (`/api/v1`), see [docs/API.md](docs/API.md).
* Retrieval-augmented chatbot with hybrid retrieval, conversation memory, grounded answers and
  answer validation, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
* Durable knowledge synchronisation (database-backed queue + worker).
* Strict isolation inside a shared Supabase project — every object is prefixed `website_with_rag_`,
  see [docs/DATABASE.md](docs/DATABASE.md).
* Diagnosing a bad answer: [docs/DIAGNOSTICS.md](docs/DIAGNOSTICS.md). Verification results:
  [docs/VERIFICATION_REPORT.md](docs/VERIFICATION_REPORT.md).

## Setup

```bash
cd server
npm install
cp .env.example .env        # fill in values — never commit .env
npm run db:inventory -- inventory/before.raw.json   # read-only snapshot (baseline for verification)
npm run db:migrate -- --schema public                # additive, guarded, idempotent
npm run db:verify -- --schema public                 # isolation + RLS + REST-API checks
npm run db:seed:reference                            # Barbados parishes/towns + categories (no businesses)
npm run admin:grant -- --email you@example.com --role super_admin
npm run dev                  # API on PORT (default 4000)
npm run worker               # sync worker (separate terminal)
```

`.env` variables are documented in `.env.example`. All of them are server-only; none may be copied
into the React apps. The API does not need the Supabase service-role key (it uses a direct
database connection); `SUPABASE_ANON_KEY` is used only to verify user tokens with Supabase Auth.

### Without an OpenAI key

The service runs and answers questions: retrieval uses structured + full-text search and answers are
composed deterministically from the retrieved sources (`meta.generation = "extractive"`,
`/health/ready` reports `degraded`). After adding `OPENAI_API_KEY`, restart the API/worker and call
`POST /api/v1/admin/sync/reindex-all {"confirm":true}` to add embeddings, then run
`npm run eval:rag -- --openai` to calibrate `RETRIEVAL_MIN_SIMILARITY` on real vectors.

## Admin authentication

Admins sign in with **Supabase Auth** in the admin app and send the access token as
`Authorization: Bearer …`. The API verifies it with Supabase on every request and then requires an
active row in `website_with_rag_admins` — because the Supabase project is shared with other apps, a
valid Supabase login alone grants nothing. Bootstrap the first admin with `npm run admin:grant`;
further admins are invited via `POST /api/v1/admin/administrators`.

> The admin dashboard in `admin/` currently uses mock authentication and mock services. Integration
> contract: replace `admin/src/services/*` calls with fetches to the endpoints in docs/API.md and use
> `@supabase/supabase-js` (`signInWithPassword`) with the **publishable** key in the browser to obtain
> the access token. No service keys belong in the frontend.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | API (watch / compile / run compiled) |
| `npm run worker` / `worker:prod` | Sync worker |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Unit tests (no database or credentials needed) |
| `npm run test:integration` | Integration, RAG regression and security tests against the isolated `website_with_rag_test` schema |
| `npm run eval:rag` | Evaluation dataset + threshold sweep → `tests/evaluation/report.json` |
| `npm run db:inventory` / `db:migrate` / `db:verify` | Read-only inventory / guarded migrations / verification |

Integration tests create/refresh the `website_with_rag_test` schema via the same guarded migration
runner and only ever delete rows **inside that schema**. They never touch `public`.

## Retrieval configuration

All in `.env` (`RETRIEVAL_*`). Defaults: 30 candidates per method, 8 sources in context, equal
keyword/semantic weights, similarity floor 0.25, 9 000 context characters, 8 s per-method timeout.
Evidence thresholds (term coverage 0.34 partial / 0.6 strong) were chosen from the evaluation sweep
in `tests/evaluation/report.json`; the vector similarity floor is a starting value that must be
re-checked with real OpenAI embeddings (see above). The active configuration version is stored in
every retrieval log (`config_version`).

## Security notes

* Parameterised SQL everywhere; table/column names only from code; strict request schemas (unknown
  fields rejected); body limit 200 KB; upload limit 2 MB (.txt/.md/.csv, content-sniffed).
* CORS allow-list (`FRONTEND_ORIGINS`), Helmet headers, per-IP and per-visitor rate limits.
* Errors return `{code, message, requestId}` only; logs redact tokens, keys, passwords, cookies and
  connection strings; chat text is never logged (diagnostics store a redacted query).
* Retrieved content is treated as data (escaped, delimited); answers containing contact details
  not present in sources are rejected.
* Authorisation is enforced server-side per permission; RLS denies browser roles entirely.
