# AI Bajan — Admin Dashboard (`admin/`)

The administration frontend for **AI Bajan**: directory listings, approvals, categories, locations, the AI knowledge base, chatbot conversations and settings, advertising, users, feedback, logs, monitoring and platform settings.

This is a **frontend-only** React + Vite app. Every screen works today against an in-browser **mock service layer** with realistic sample data, persisted to `localStorage`. The Node.js + Supabase backend will replace the mock services later — pages and components don't need rewriting.

> **Not production security.** Sign-in, roles and permissions in this app are demo behaviour only. Real authentication, authorization, validation and audit logging must be enforced by the backend.

---

## Quick start

Requirements: **Node.js 18.18+** (developed on Node 24), npm 9+.

```bash
cd admin
npm install
npm run dev          # http://localhost:5174
```

Sign in with the **demo account** shown on the login page: `admin.demo@example.com` and any password of 8+ characters. No password is stored; the "session" is a small JSON flag in session/local storage.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` / `npm run preview` | Production build / serve it on http://localhost:4174 |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run test` | 56 unit + integration tests (Vitest, React Testing Library) |
| `npm run test:e2e` | Playwright (desktop 1440px + Pixel 7). First run: `npx playwright install chromium` |

## Environment

Copy `.env.example` to `.env`. Only frontend-safe values belong here — anything prefixed `VITE_` is shipped to the browser. **Never** put Supabase service-role keys, OpenAI keys or database credentials in this app.

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_DATA_MODE` | `mock` | `mock` uses the in-browser demo services. `live` is reserved for the future API (services are not wired yet — see below). |
| `VITE_API_BASE_URL` | — | Future Node.js API base URL. |
| `VITE_PUBLIC_SITE_URL` | `http://localhost:5173` | Public website URL. |
| `VITE_MOCK_FAILURE_RATE` | `0` | 0–1 chance that mock writes fail, to exercise error states. |

## What's included

| Area | Routes | Highlights |
| --- | --- | --- |
| Auth | `/login`, `/forgot-password` | Validation, show/hide password, remember me, demo-only labelling, redirect back to the requested page |
| Dashboard | `/` | KPIs, date range (7/30/90 days), refresh, CSV export, listing growth, chatbot activity, status distribution, popular categories, top listings, recent activity, quick actions |
| Listings | `/listings`, `/listings/new`, `/listings/:id`, `/listings/:id/edit`, `/listings/:id/preview`, `/listings/submissions` | Search, status/category/location/featured/date filters with chips, sorting, column visibility, pagination, bulk publish/draft/archive/delete/export, status-aware row actions, 8-section form (A–H) with slug generation and duplicate check, dependent region → town → district selects, repeatable hours/socials/gallery, local image previews, SEO preview, chatbot-knowledge preview, unsaved-changes guard, detail tabs, public preview, submission queue with review drawer, approve / reject with reason / request changes, bulk approval |
| Categories | `/categories` | CRUD modal with icon picker, parent, order, visibility; view drawer with listings; deletion blocked while referenced unless listings are reassigned |
| Locations | `/locations` | Hierarchy tree + table, type-dependent parent selection, coordinates validation, associated listings, deletion blocked while in use |
| Knowledge | `/knowledge`, `/knowledge/new`, `/knowledge/:id`, `/knowledge/:id/edit`, `/knowledge/faqs` | KPIs, filters, editor with formatting toolbar + preview, publish/visibility/chatbot toggles, simulated indexing log and reindex/retry, drag-and-drop upload validation (PDF/TXT/DOCX/CSV ≤10 MB), FAQ editor with chatbot answer preview and bulk publish |
| AI assistant | `/chatbot`, `/chatbot/conversations`, `/chatbot/conversations/:id`, `/chatbot/settings`, `/knowledge/sync` | Sample metrics and charts, conversation filters and CSV export, transcript with fallback markers and source cards, internal notes, flag/review, copy/export transcript, settings in 5 tabs with live widget preview, sync queue with job drawer, retry and simulated "refresh queue" |
| Monetization | `/advertising`, `/advertising/featured` | Campaign CRUD with URL/date validation and image preview, activate/pause/archive; featured placements with searchable listing picker, duplicate prevention, "not published" warning, priority, expiry indicator, placement preview |
| Platform | `/users`, `/users/:id`, `/administrators`, `/feedback`, `/activity` | Role/status changes with confirmation, invite admin (demo), permission matrix, feedback triage with notes and resolution, activity log with drawer and CSV export |
| System | `/monitoring/health`, `/monitoring/errors`, `/settings/*` | Service cards clearly marked **Not connected**, sample incident chart, error log filters/drawer/copy/export, general/appearance/notification/account settings, maintenance-mode warning, light/dark/system theme, **Demo tools** (simulate failed saves, reset demo data) |

Cross-cutting: collapsible sidebar with live badges (pending submissions, failed sync jobs, new feedback), mobile drawer, breadcrumbs with record names, global search (Ctrl/⌘ + K, arrow keys, Enter), notifications menu, help dialog, toasts, confirm dialogs, skeletons, empty/error states, page transitions with reduced-motion support, 404 and 403 pages.

## Project structure

```
admin/
  src/
    app/            AppProviders, routeConfig (data router), RouteErrorBoundary
    layouts/        AdminLayout (guarded shell), AuthLayout
    components/
      layout/       Sidebar, SidebarGroup, Topbar, Breadcrumbs, PageHeader, MobileNavigation, GlobalSearch, NotificationsMenu, Logo
      common/       Button, IconButton, Card, Badge, Avatar, DataTable, Pagination, Fields (Text/TextArea/Select/Checkbox/Search),
                    DateRangePicker, FilterBar, ColumnToggle, States (Empty/Error/Loading/Skeleton/DemoNotice), ConfirmDialog,
                    Modal (+ Drawer), DropdownMenu, Tooltip, Tabs, Toggle, StatCard, SectionHeader, FileUpload,
                    ImageUploadPreview (+ ImageWithFallback), TagInput, CategoryIcon, ContentPreview, ToastProvider
      charts/       Charts (Area/Line/Bar/Donut cards), useChartColors
      listings/     ListingForm, listingSchema, ListingDetailsDrawer, ListingPreview, ListingStatusBadge, useListingActions
      chatbot/      ConversationList, ChatTranscript, SourceReferenceList, ChatbotPreview
      users/        UserActions
      forms/        SettingsShell (settings nav + form hook)
    pages/          One folder per section (see routes above)
    data/           Mock datasets (+ helpers for relative dates, seeded numbers, image URLs)
    services/       mockApi (persisted collections), db, and one service per domain
    hooks/          useApi (TanStack Query wrappers), useTableState, usePagination, useDebounce, useLocalStorage, useUnsavedChanges, useLookups, useToast
    context/        AuthContext, PreferencesContext (theme, sidebar), PageMetaContext (titles/breadcrumbs)
    utils/          formatDate, formatNumber, validation, constants, permissions, csv, storage
    config/         navigation, environment
  e2e/              Playwright specs
```

Deviations from the suggested file list are deliberate groupings: related small components share a file (e.g. `Fields.jsx`, `States.jsx`, `Modal.jsx` holds `Modal` and `Drawer`, `Charts.jsx` holds all chart cards).

## Mock data and persistence

- Datasets: 24 listings, 11 categories, 19 locations (country → parish → town → district), 14 knowledge documents, 16 FAQs, 12 sync jobs, 14 conversations, 9 campaigns, 9 featured placements, 18 users, 6 administrators, 16 feedback reports, 24 activity events, 12 error logs, 8 service-health cards. IDs are shared, so every cross-link (listing ↔ category ↔ location ↔ conversation ↔ document ↔ feedback) resolves.
- All businesses are **fictional**. Contact details use reserved values only (`example.com`, `+1 246-555-01xx`). Photos are Pexels images (Pexels License), several of them illustrative rather than of the specific place.
- Metrics (views, clicks, impressions, chatbot analytics, latency, incidents) are **sample values** and labelled as such in the UI.
- Changes persist to `localStorage` under keys prefixed **`ai_bajan_admin_demo_`** (e.g. `…demo_listings`, `…demo_settings`). Malformed or unavailable storage falls back to the seed data / memory.
- **Reset:** *General settings → Demo tools → Reset demo data* clears only keys with that prefix (you stay signed in; unrelated browser storage is untouched).
- **Error testing:** *Demo tools → Simulate failed saves*, or `VITE_MOCK_FAILURE_RATE`. Failed saves keep the user's input so they can retry.
- Nothing secret or sensitive is stored — no passwords, tokens or keys.

## Connecting the backend

Pages never touch mock data directly. They call service functions (via `hooks/useApi.js` + TanStack Query), e.g. `getListings()`, `getListingById(id)`, `createListing(data)`, `updateListing(id, data)`, `setListingStatus(id, status, meta)`, `deleteListing(id)`, `getCategories()`, `createCategory(data)`, `getKnowledgeDocuments()`, `updateKnowledgeDocument(id, data)`, `getConversations()`, `getDashboardStats({ days })`, `getActivityLogs()` …

To integrate:

1. Add an HTTP client (base URL from `config/environment.js`, auth headers from the real session) and replace each service's body with an API call that returns the same shape. Keep throwing errors shaped like `ApiError` (`message`, `status`, `code`, `retryable`) so toasts, retries and 404 pages keep working.
2. Replace `services/authService.js` with real authentication (e.g. Supabase Auth via the API). Keep secrets server-side; don't make privileged Supabase calls from the browser.
3. Move work that is *simulated* in the browser to the server: knowledge indexing and the sync queue (`knowledgeService`), activity/audit logging (`activityService`), health checks (`monitoringService.getSystemHealth` → `GET /health`), notifications, file uploads/parsing, invitations and password flows.
4. Enforce permissions server-side. `utils/permissions.js` only drives what the UI shows.
5. Remove the demo notices/badges once a screen shows real data (search for `DemoNotice` and `DemoBadge`).

## Accessibility

Semantic landmarks and headings, skip link, labelled fields with inline errors and `aria-invalid`, focus-visible rings, Radix primitives for dialogs, drawers, menus, tooltips, tabs and popovers (focus trapping, Escape, arrow keys), `aria-current` in navigation, `aria-sort` on sortable columns, accessible switch and combobox patterns, status text alongside colour, chart summaries for screen readers, and `prefers-reduced-motion` support.

## Quality checks performed

- ESLint clean; production build succeeds.
- 56 Vitest tests: service logic (CRUD, slug conflicts, approvals, reassign-before-delete, location hierarchy, duplicate placements, FAQ publish rules, sync retry, search, dashboard counts, demo login, storage reset scoping, malformed storage, CSV formula-injection escaping, URL safety) and UI flows (auth redirect, login validation, sidebar and breadcrumbs, 17 routes, listing search/filter/delete/create, reject-with-reason, FAQ validation, conversation notes/flag, chatbot settings save, global search).
- Playwright: every route renders with **no console errors**, **no horizontal overflow** at 1440 / 1280 / 1024 / 768 / 390 / 360 px, plus login redirect, approval, unsaved-changes guard + persistence across reload, keyboard search, mobile drawer and demo reset.

## Deployment

Standalone static SPA. On Vercel set **Root Directory** to `admin`; `vercel.json` rewrites all routes to `index.html` and adds `noindex` and basic security headers. Restrict access (e.g. Vercel password protection or SSO) until real authentication exists. Not deployed as part of this work.

## Known limitations

- No backend: data lives in the browser; there is no multi-user sync.
- Authentication, roles, invitations, password reset, 2FA and sessions are UI-only.
- Indexing, sync jobs, health checks, notifications and analytics are simulated and labelled as such.
- Local image/file selections are previews only and are not uploaded.
