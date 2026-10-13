# AI Bajan — Public Website (`client/`)

The public-facing frontend for **AI Bajan**, a Barbados tourism discovery platform and business directory with an AI travel assistant.

This folder is a standalone React + Vite single-page app. It runs on its own today using bundled **demo data**, and is structured to switch to the future Node.js API (`server/`) through configuration. The admin dashboard (`admin/`) and the backend (`server/`) are separate projects and are not part of this folder.

---

## Contents

- [Quick start](#quick-start)
- [Scripts](#scripts)
- [Environment variables](#environment-variables)
- [What's included](#whats-included)
- [Folder structure](#folder-structure)
- [Data: demo mode vs live mode](#data-demo-mode-vs-live-mode)
- [Connecting the Node.js API](#connecting-the-nodejs-api)
- [Search and relevance rules](#search-and-relevance-rules)
- [AI chatbot](#ai-chatbot)
- [Images and licensing](#images-and-licensing)
- [Testing](#testing)
- [Deploying to Vercel](#deploying-to-vercel)
- [SEO limitations](#seo-limitations)
- [Accessibility and performance notes](#accessibility-and-performance-notes)
- [Known limitations / before launch](#known-limitations--before-launch)

---

## Quick start

Requirements: **Node.js 18.18+** (developed on Node 24) and npm 9+.

```bash
cd client
npm install
cp .env.example .env      # optional — defaults work out of the box
npm run dev               # http://localhost:5173
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server with hot reload |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally (http://localhost:4173) |
| `npm run lint` | ESLint (flat config, React + hooks rules) |
| `npm run format` | Prettier over `src/` |
| `npm run test` | Unit + integration tests (Vitest + React Testing Library) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | Playwright end-to-end tests (builds and serves the app automatically) |

First-time E2E setup: `npx playwright install chromium`.

## Environment variables

All variables are **public** — anything prefixed `VITE_` is compiled into the browser bundle. Never put secrets (OpenAI keys, database credentials, admin tokens) here.

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_DATA_MODE` | `mock` | `mock` = bundled demo data (clearly labelled). `live` = call the API. |
| `VITE_API_BASE_URL` | — | Base URL of the Node.js API, e.g. `http://localhost:5000/api` in development. Only used in live mode. |
| `VITE_SITE_URL` | `https://aibajan.example.com` | Public origin for canonical URLs and Open Graph tags. |
| `VITE_SOCIAL_INSTAGRAM` / `_FACEBOOK` / `_X` | empty | Footer social links. Hidden unless set to an `https://` URL. |
| `VITE_MAP_TILE_URL` / `VITE_MAP_ATTRIBUTION` | OpenStreetMap | Map tile provider for Leaflet maps. |

## What's included

**Routes**

| Route | Page |
| --- | --- |
| `/` | Homepage: hero + search, categories, featured listings, destinations carousel, experiences, local gems, AI assistant intro, sponsored placements, guides, business-owner CTA, newsletter |
| `/businesses` | Searchable directory (search, filters, chips, sort, grid / list / map, pagination) |
| `/category/:slug` | Category landing page (`restaurants`, `hotels`, `tours`, `attractions`, `shopping`, `transportation`, `culture`, `wellness`) |
| `/business/:slug` | Business detail: gallery + lightbox, info, amenities, hours, location, contact panel, "Ask AI Bajan", related listings |
| `/places/:slug` | Destination page (`holetown`, `bridgetown`, `speightstown`, `oistins`, `bathsheba`, `st-lawrence-gap`, `christ-church`, `hastings`) |
| `/discover` | Editorial "Discover Barbados" page |
| `/guides`, `/guides/:slug` | Travel guide listing (topic filter + search) and article pages (TOC, share, related) |
| `/about`, `/contact`, `/faq`, `/privacy`, `/terms` | Brand, contact form, FAQ accordion, draft legal pages |
| `*` | Not-found page |

**Cross-cutting:** sticky header with mega-menu, mobile drawer navigation, global search dialog, floating AI chatbot, page metadata, loading skeletons, error boundaries, empty states, toasts, reduced-motion support.

## Folder structure

```
client/
  public/              favicon, hero images (local, responsive), OG image, fallback illustration
  e2e/                 Playwright specs (smoke across routes/widths, key user flows)
  src/
    components/
      layout/          Header, DesktopNavigation, MobileNavigation, SearchDialog, Footer, Breadcrumbs, PageContainer
      home/            Homepage sections
      directory/       DirectoryExplorer (the full directory UI), filters, chips, cards, map, pagination
      business/        Gallery/lightbox, contact panel, details, related listings
      chatbot/         Launcher, window, messages, composer, suggestions, sources
      guides/          GuideCard
      forms/           Newsletter form (lazy-loaded)
      common/          Buttons, badges, fields, overlays (Radix), states, image-with-fallback, SafeMarkdown…
    pages/             One file per route (lazy-loaded except the homepage)
    data/              Demo businesses, categories, destinations, guides, FAQ, placements, legal drafts
    hooks/             Data hooks (TanStack Query), URL-synced filters, chat state, utilities
    lib/
      services/        API facade + mock adapter + live adapter
      chat/            Demo chat engine (rules-based, not AI)
      search.js        Search / filter / facet / sort / paginate logic
      apiClient.js     fetch wrapper (timeouts, safe errors)
      imageSources.js  Image registry with credits and licence notes
      seo.jsx, structuredData.js, routes.js, safeUrl.js, validation.js, config.js
    context/           UI + chat providers
    styles/            Tailwind entry, design tokens (CSS variables), component CSS, animations
    test/              Test setup + integration tests
```

Small deviations from the original brief's file list: related components are grouped where that keeps things simpler — e.g. `common/States.jsx` holds `ErrorState`, `EmptyState` and `LoadingSpinner`; `common/Overlays.jsx` holds `Modal` and `Drawer`; `common/Fields.jsx` holds `SearchInput`, `SelectField` and `TextField`.

## Data: demo mode vs live mode

**Demo mode (default).** `src/lib/services/mockAdapter.js` serves the files in `src/data/` with a short simulated delay so loading states are visible.

- 37 **fictional** businesses across 8 categories and 8 areas. Every record has `demoContent: true`, which shows a **"Demo"** badge and a notice on detail pages.
- Contact details use reserved values only: `example.com` websites/emails and `+1 246-555-01xx` phone numbers (the NANP range reserved for fiction).
- No ratings, reviews, verification badges or exact coordinates — none of that exists yet, so none is shown. `RatingDisplay` and the "Verified" badge render only when real, sourced data is present.
- Contact and newsletter forms validate input, then say plainly that **nothing was sent**.

**Live mode.** Set `VITE_DATA_MODE=live` and `VITE_API_BASE_URL`. The app calls the API through `src/lib/services/liveAdapter.js`. There is **no silent fallback** to demo data — if the API fails, visitors see an error state with a retry button.

### Business record shape

```js
{
  id, slug, name,
  category,            // primary category slug
  categories: [],      // all category slugs (used for filtering)
  businessType,        // e.g. "Guesthouse", "Seafood", "Catamaran Cruise"
  area, parish,        // area must match an entry in data/destinations.js `areas`
  shortDescription, description, highlights: [], keywords: [],
  images: [],          // image keys from lib/imageSources.js (or URLs once the CMS supplies them)
  website, email, phone, address,     // null when unknown — UI hides the related action
  coordinates,         // { lat, lng } or null — never invented
  openingHours,        // [{ days, hours }] or null
  amenities: [],       // keys from data/amenities.js
  isFeatured, isSponsored, isVerified,
  status: 'published',
  demoContent,
  // optional, only if genuine: rating, reviewCount, ratingSource
}
```

## Connecting the Node.js API

1. Implement the endpoints listed at the top of `src/lib/services/liveAdapter.js` (paths can be changed there — nowhere else):

   | Method & path | Returns |
   | --- | --- |
   | `GET /businesses?q&category&location&type&amenities&featured&sort&page&pageSize` | `{ items, total, page, pageCount, pageSize, facets }` |
   | `GET /businesses/all` | `Business[]` |
   | `GET /businesses/:slug` | `Business` (404 when missing) |
   | `GET /categories`, `GET /destinations`, `GET /destinations/:slug` | config records |
   | `GET /guides`, `GET /guides/:slug` | guide records |
   | `POST /chat` `{ message, history, context }` | `{ reply, businesses, sources, followUps, meta }` |
   | `POST /contact`, `POST /newsletter` | `{ ok }` |

   `facets` mirrors `searchDirectory()` in `src/lib/search.js`: `{ categories, locations, types, amenities, featured }` counts, where each dimension's counts ignore that dimension's own filter.

2. Set `VITE_DATA_MODE=live` and `VITE_API_BASE_URL` for the environment.
3. Errors: return JSON `{ message, code }` with a proper status. The client shows a safe message, retries 5xx/429 automatically (TanStack Query) and never shows stack traces.

Components never call `fetch` directly — they use hooks in `src/hooks/useBusinesses.js`, which call `src/lib/services`. Navigation-level taxonomy (categories, destinations) is bundled config today; `getCategories()` / `getDestinations()` exist for when it moves to the CMS.

## Search and relevance rules

Implemented in `src/lib/search.js` (the server should mirror these semantics):

- Structured filters (category, area/parish, type, amenities, featured) are **exact** field matches.
- Place names typed into the search box (e.g. "restaurants in holetown") become a location constraint.
- All meaningful words must match (AND). Filler words ("near", "show", "best"…) are ignored.
- Generic category words ("restaurants", "hotel", "shop") only match a listing's **category** — never incidental mentions in a description. A boutique that mentions "nearby restaurants" won't appear in a restaurant search. (There's a test for exactly this.)
- No results → an honest empty state with ways to broaden the search; unrelated listings are never used to fill space.
- Sorting: relevance, A–Z, Z–A, featured first. Rating/popularity sorts are deliberately absent until real data exists.

Filters live in the URL (`/businesses?q=fish&category=restaurants&location=Oistins&sort=name-asc&page=2&view=list`), so searches are shareable and survive refresh and back/forward navigation.

## AI chatbot

- **Frontend:** `src/components/chatbot/*`, state in `src/hooks/useChatbot.js` (provided app-wide so conversations survive navigation and can be opened with business context).
- **Demo mode:** `src/lib/chat/mockChatEngine.js` is a deterministic, rules-based retriever over the sample listings. It is **not** an AI model, and the UI says "Demo mode · answers from sample listings, not a live AI". It respects category, location and amenity constraints, offers only explicitly labelled same-parish fallbacks, and says when information (hours, prices, availability, weather) isn't available.
- **Try the error state:** type `simulate failure` to see the error + retry UI.
- **Live mode:** messages go to `POST /chat`. The server is responsible for retrieval (RAG), authorisation, OpenAI calls and validation. The client renders only returned fields; Markdown is rendered with raw HTML disabled and every link validated (`src/components/common/SafeMarkdown.jsx`, `src/lib/safeUrl.js`).
- The OpenAI key must live on the server only — never in a `VITE_` variable.
- Open/closed state is remembered for the browser session only; conversation history stays in memory.

## Images and licensing

All photography is registered in `src/lib/imageSources.js` with its source page, photographer (where known) and location.

- Source: **Pexels**, used under the [Pexels License](https://www.pexels.com/license/) (free for commercial use; attribution appreciated, not required). Credits are listed on the About page (`/about#photo-credits`).
- Only images whose Pexels page tags a **Barbados** location are marked `isBarbados: true` (e.g. Holetown beach aerial, Hunte's Gardens, the hero seascape). The rest are **illustrative** Caribbean/tropical photos and are never captioned as a specific Barbados place.
- The hero image is self-hosted in `public/images/` as responsive JPEG + WebP (768–2560 px). Other images use the Pexels CDN with `srcSet` widths 480–2400 px.
- Every image goes through `ImageWithFallback`, which reserves space (no layout shift), lazy-loads below the fold and swaps to an on-brand fallback illustration if a URL fails — no broken-image icons.
- **Before launch:** replace illustrative photos with licensed Barbados photography or client-supplied business photos, and consider self-hosting all critical images rather than relying on a third-party CDN.

## Testing

```bash
npm run test       # 67 unit + integration tests
npm run test:e2e   # 46 Playwright tests (desktop 1440px + Pixel 7)
```

- **Unit:** search/filter/sort/pagination, query interpretation, related listings, chat relevance (category + location + amenity constraints, honest "not found" and live-info answers).
- **Integration (React Testing Library, full app in memory router):** every route renders; header navigation; hero search → directory; category, location and combined filters; chip removal and clear-all; empty state; pagination; business detail, missing slug, contact actions hidden when data is absent; gallery lightbox with Escape; chatbot open/close, empty-message handling, relevant answers, retry; contact/newsletter validation and honest demo submission; mobile drawer; FAQ accordion state; accessible names on every button and link on the homepage.
- **E2E (Playwright):** each route loads with no console errors and no broken images; **no horizontal overflow** at 320, 375, 390, 430, 768, 1024, 1280, 1440 and 1920 px; search → detail flow; URL filter persistence across reload; chatbot flows; mobile menu.

## Deploying to Vercel

1. Import the repository in Vercel and set **Root Directory** to `client`.
2. Framework preset: **Vite** (build `npm run build`, output `dist` — also declared in `vercel.json`).
3. Add environment variables per environment (`VITE_SITE_URL`, and `VITE_DATA_MODE` / `VITE_API_BASE_URL` once the API exists).
4. `vercel.json` rewrites all paths to `index.html`, so refreshing `/businesses` or `/business/<slug>` works, and sets long-lived caching for hashed assets plus basic security headers.

This project has been prepared for Vercel but **has not been deployed** as part of this work.

## SEO limitations

Metadata (titles, descriptions, canonical URLs, Open Graph/Twitter tags, JSON-LD) is set per route with `react-helmet-async`. Because this is a **client-rendered SPA**:

- Google renders JavaScript and will see per-page metadata, but many social-preview bots and some crawlers will only see the defaults in `index.html`.
- **Recommended next step:** prerender public routes at build time (e.g. `vite-plugin-prerender`/`vite-ssg`, or a small prerender step on Vercel), or move to server rendering if SEO becomes a primary acquisition channel. Add a generated `sitemap.xml` once real listings exist.
- Structured data only uses real fields. Demo listings emit **no** `LocalBusiness` data and are marked `noindex`; draft legal pages are `noindex` too.

## Accessibility and performance notes

- Semantic landmarks, skip link, one `h1` per page, labelled forms with inline errors, visible focus rings, `aria-live` result counts and chat log.
- Dialogs, drawers, lightbox and accordion use Radix primitives (focus trap/return, Escape, ARIA state). Status is never conveyed by colour alone (badges include icons/text).
- `prefers-reduced-motion` is respected globally (Framer `MotionConfig` + CSS).
- Route-level code splitting; Leaflet, the Markdown renderer, the chat window and form libraries load only when needed. Current production build: initial JS ≈ 200 KB gzipped (app ≈ 97 KB + React ≈ 54 KB + Motion ≈ 38 KB + Query ≈ 11 KB). Lighthouse/Core Web Vitals have **not** been measured yet — do that against the deployed site.

## Known limitations / before launch

- All listings are fictional demo data; real records must come from the backend/admin.
- The chatbot is a demo retriever, not an AI model, until `POST /chat` is implemented.
- Contact and newsletter forms are not connected to any email service.
- Privacy policy and terms are **draft templates** and must be reviewed by a qualified professional.
- Many photos are illustrative rather than Barbados-specific (see above).
- The default OpenStreetMap tile server is not intended for heavy production traffic — configure a tile provider.
- No saved/favourites feature, accounts or booking flows (intentionally out of scope).
