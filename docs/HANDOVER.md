# AI Bajan: handover guide

This guide moves AI Bajan onto accounts the owner controls: the website and admin on the owner's domain (aibajan.com), with hosting, database, source code and the OpenAI connection in the owner's own accounts. It is written so the move can happen without interrupting the live site: the new setup is built alongside the current one and the domain is switched last.

## 1. What AI Bajan is made of

| Part | What it is | Where it runs now |
|---|---|---|
| Public website | React site (`client/`) | Vercel project `ai-bajan-tourism-directory` |
| Admin dashboard | React app (`admin/`) | Vercel project `ai-bajan-tourism-directory-admin` |
| API and AI assistant | Node.js server with retrieval (`server/`) | Vercel project `ai-bajan-tourism-directory-server` |
| Database and admin sign-in | Supabase (Postgres with pgvector, and Supabase Auth) | Developer's Supabase project, shared with other projects |
| AI model | OpenAI API: chat model `gpt-4o-mini`, embeddings `text-embedding-3-small` | Developer's OpenAI account |
| Source code | Git repository | GitHub `Waqas56jb/ai-bajan-tourism-directory` |

## 2. Accounts the owner needs

1. **GitHub**: to receive the repository.
2. **Vercel**: to host the three projects. Vercel's free Hobby plan is for non-commercial use; a public service with advertising or paid listings needs the **Pro** plan.
3. **Supabase**: a new project for AI Bajan's database and admin sign-in. AI Bajan's data is about 470 MB (mostly the AI knowledge base), which nearly fills the free plan's 500 MB, so use the **Pro** plan.
4. **OpenAI Platform** (platform.openai.com): an organisation with billing enabled and an API key.
5. **Domain registrar** for aibajan.com: access to the DNS settings.

Check current prices on each provider's pricing page before subscribing.

## 3. OpenAI: running cost and control

- Each question uses roughly 4,000–6,000 input tokens (the question plus the sources it found) and up to about 500 output tokens with `gpt-4o-mini`; at OpenAI's published `gpt-4o-mini` prices this is about **US$1 per 1,000 questions**. Re-indexing the whole knowledge base (about 19,000 passages) with `text-embedding-3-small` costs well under US$1. Verify against OpenAI's current pricing page.
- In the OpenAI dashboard, set a **monthly budget limit** and email alerts, and create one API key named for AI Bajan's server.
- The key is stored only in the server's environment (`OPENAI_API_KEY` in Vercel), never in the website or admin code. To change the key later, replace that variable and redeploy the server.

## 4. Moving to the owner's accounts

1. **Repository**: transfer the GitHub repository to the owner (GitHub → Settings → Transfer ownership), or the owner creates a repository and the code is pushed to it.
2. **Database**: create a new Supabase project, then:
   - set the server's database variables to the new project and run `npm run db:migrate -- --schema public` from `server/` (the migrations are safe to run on an empty database and build every table, index and search function);
   - copy AI Bajan's data (the `website_with_rag_*` tables only) from the current database to the new one. The knowledge base keeps its embeddings, so nothing needs re-indexing;
   - create the owner's administrator account in Supabase Auth, then grant it the super-admin role with `npm run admin:grant`.
3. **Hosting**: in the owner's Vercel account, import the repository three times (root directories `client`, `admin` and `server`), or transfer the existing projects to the owner's Vercel team. Copy the environment variables listed in section 6.
4. **OpenAI**: put the owner's API key in the server's `OPENAI_API_KEY` and redeploy.
5. **Check before switching the domain**: run the checks in section 7 against the new deployment.

## 5. Connecting aibajan.com

Suggested addresses:

| Address | Serves |
|---|---|
| `aibajan.com` and `www.aibajan.com` | Public website |
| `admin.aibajan.com` | Admin dashboard |
| `api.aibajan.com` | API and AI assistant |

Steps:
1. In each Vercel project, open Settings → Domains and add its address(es). Vercel then shows the exact DNS records to create.
2. At the domain registrar, create those records (typically an `A` record for `aibajan.com` and `CNAME` records for `www`, `admin` and `api`, pointing to Vercel). Vercel issues HTTPS certificates automatically once the records resolve.
3. Update the settings that contain addresses, then redeploy:
   - website: `VITE_API_BASE_URL=https://api.aibajan.com/api/v1`, `VITE_SITE_URL` / `VITE_PUBLIC_SITE_URL=https://aibajan.com`;
   - admin: `VITE_API_BASE_URL=https://api.aibajan.com/api/v1`, `VITE_PUBLIC_SITE_URL=https://aibajan.com`;
   - server: `FRONTEND_ORIGINS=https://aibajan.com,https://www.aibajan.com,https://admin.aibajan.com`;
   - Supabase → Authentication → URL configuration: site URL `https://admin.aibajan.com` (used in password-reset emails).
4. Keep the old Vercel addresses working until the new ones are confirmed, so nothing is interrupted.

## 6. Settings (environment variables)

Only names are listed; values are entered in Vercel, never committed to the repository.

- **Server**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DB_SCHEMA=public`, `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`, `OPENAI_EMBEDDING_MODEL`, `FRONTEND_ORIGINS`, `SESSION_SECRET`, `CRON_SECRET`, plus the optional tuning variables in `server/.env.example`.
- **Website and admin**: `VITE_DATA_MODE=live`, `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SITE_URL` / `VITE_PUBLIC_SITE_URL`.

The daily jobs (checking source websites for changes at 03:00, indexing at 05:00) are defined in `server/vercel.json` and need `CRON_SECRET`.

## 7. Checks after any move or change

1. `https://api.aibajan.com/health/ready` shows `database: ok`, `schema: ok`, `llm: configured`.
2. Sign in to the admin, open the Dashboard, Verified answers and Questions report.
3. Ask AI Bajan a question on the website and check the answer cites its sources.
4. From `server/`, run `npm run eval:regression -- --api https://api.aibajan.com/api/v1`. It re-asks 100 test questions and checks each answer against verified facts.

## 8. Keeping the knowledge accurate

- **Verified answers** (Admin → AI Knowledge → FAQs): each has a supporting source, approval record and review date. They override other sources until their review date.
- **Questions report** (Admin → AI Assistant → Questions Report): most-asked questions and those answered poorly; add a verified answer for any recurring weak question.
- **Source websites** are re-checked daily; `npm run knowledge:crawl` adds pages and `npm run knowledge:repair` tidies imported pages.
