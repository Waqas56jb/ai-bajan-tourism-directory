# AI Bajan API reference (v1)

Base URL: `/api/v1`. All bodies are JSON (`Content-Type: application/json`, max 200 KB) except the
document upload (multipart). Every response carries an `X-Request-Id` header.

## Conventions

**Errors** — always:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Some fields are invalid.", "requestId": "…", "details": [{ "field": "contact.website", "message": "Must be a full http(s) URL" }] } }
```

| Status | Code examples |
| --- | --- |
| 400 | `BAD_REQUEST`, `MALFORMED_JSON` |
| 401 | `UNAUTHENTICATED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND`, `ROUTE_NOT_FOUND` |
| 409 | `CONFLICT` (duplicate slug, stale `expectedVersion`, record in use) |
| 413 / 415 | `PAYLOAD_TOO_LARGE`, `FILE_TOO_LARGE`, `UNSUPPORTED_TYPE`, `NOT_TEXT` |
| 422 | `VALIDATION_ERROR` (unknown fields are rejected — strict schemas) |
| 429 | `RATE_LIMITED` |
| 5xx | `INTERNAL_ERROR`, `DB_UNAVAILABLE`, `DB_TIMEOUT`, `AUTH_UNAVAILABLE` (no stack traces, no SQL) |

**Pagination** — `?page=1&pageSize=20` (max 100). Responses: `{ items, page, pageSize, total, totalPages }`.

**Lists in query strings** — comma separated, e.g. `?status=published,pending`.

## Authentication

* **Admin routes** (`/api/v1/admin/*`): `Authorization: Bearer <Supabase access token>`.
  The token is verified with Supabase Auth on every request, then the user must have an **active**
  row in `website_with_rag_admins`. Role and permissions come only from that row.
* **Chat visitors**: anonymous signed token in `X-Visitor-Token` (returned as `visitorToken` by
  `POST /chat` or `POST /chat/session`). It proves ownership of conversations.

Permissions per role are defined in `src/auth/permissions.ts`.

## Health

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health/live` | Process is up. |
| GET | `/health/ready` | DB reachable + migrations present. `status: ready` / `degraded` (no LLM key) / `not_ready` (503). |

## Public (no auth)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/public/listings?q&category=<slug>&location=<slug>&featured&sort=featured\|name\|newest&page&pageSize` | Published listings only, public shape (no private notes, review data, owner; address only when the listing allows it). |
| GET | `/public/listings/:slug` | 404 unless published. |
| GET | `/public/categories`, `/public/locations` | Active values only. |
| GET | `/public/faqs` | Published + approved. |
| GET | `/public/ads?placement=…` | Running ads; no internal notes/counters. |
| GET | `/public/settings/chatbot` | Widget display settings. |
| POST | `/chat/session` | Issues a visitor token. |
| POST | `/chat` | See below. Rate limited per visitor. |
| GET | `/chat/conversations/:id` | Visitor's own transcript (`X-Visitor-Token` required; others → 404). |
| POST | `/feedback` | Ratings/reports. Conversation feedback only from its owner. Rate limited. |

### POST /chat

Request:

```json
{ "message": "How do I find pharmacies to sell test strips to?", "conversationId": "uuid (optional)", "language": "en", "clientMessageId": "retry-key-123 (optional)", "context": { "listingId": "uuid (optional, page the visitor is viewing)" } }
```

Response:

```json
{
  "conversationId": "…", "messageId": "…",
  "answer": "Here are pharmacies listed in the AI Bajan directory that you could contact about test strips:\n- Harbour Lights Pharmacy (…)…",
  "sources": [{ "id": "…", "type": "listing", "title": "Harbour Lights Pharmacy", "url": "/listings/harbour-lights-pharmacy" }],
  "needsClarification": false,
  "fallbackUsed": false,
  "status": "answered",
  "meta": { "intent": "business_prospecting", "evidence": "strong", "generation": "llm", "usedConversationContext": false },
  "visitorToken": "v1.… (only when a new session was minted)"
}
```

`status` is one of `answered`, `partial`, `clarification`, `no_evidence`, `out_of_scope`, `refused`,
`limitation`, `greeting`, `technical_failure`. A technical failure is never reported as "no evidence".
Re-sending the same `clientMessageId` returns the original answer (idempotent).

## Admin (`/api/v1/admin`, bearer token required)

| Area | Endpoints | Permission |
| --- | --- | --- |
| Me | `GET /me` | any admin |
| Listings | `GET /listings` (q, status, categoryId, locationId, featured, includeInChatbot, sort, dir, page, pageSize) · `GET /listings/slug-available?slug&excludeId` · `GET /listings/:id` · `GET /listings/:id/preview` · `GET /listings/:id/revisions` | `listings:read` |
| | `POST /listings` (status draft/pending only) · `PATCH /listings/:id` (optional `expectedVersion`) · `POST /listings/:id/featured` | `listings:write` |
| | `POST /listings/:id/status` `{status, reason?, feedback?}` (reject needs reason) | `listings:publish` |
| | `DELETE /listings/:id` | `listings:delete` |
| | `POST /listings/bulk` `{action: publish\|archive\|draft\|feature\|unfeature\|delete, ids[≤100]}` — atomic | per action |
| Categories | `GET/POST /categories`, `GET/PATCH/DELETE /categories/:id` (`?reassignTo=` when in use) | read: `listings:read`; write: `taxonomy:write` |
| Locations | `GET/POST /locations`, `GET/PATCH/DELETE /locations/:id` (hierarchy enforced in DB) | same |
| FAQs | `GET/POST /faqs`, `GET/PATCH/DELETE /faqs/:id`, `POST /faqs/bulk-status` | `knowledge:read/write`; publishing/approval `knowledge:publish` |
| Documents | `GET/POST /knowledge/documents`, `POST /knowledge/documents/upload` (multipart `file`: .txt/.md/.csv ≤ 2 MB), `GET/PATCH/DELETE /knowledge/documents/:id`, `GET /knowledge/documents/:id/chunks`, `POST /knowledge/documents/:id/reindex` | as FAQs; reindex `sync:manage` |
| Sync | `GET /sync/jobs`, `GET /sync/summary`, `POST /sync/jobs/:id/retry`, `POST /sync/reindex-all {confirm:true}` | `knowledge:read`, `sync:manage` |
| Conversations | `GET /conversations`, `GET /conversations/:id` (messages, notes, retrieval diagnostics), `POST /conversations/:id/review`, `POST /conversations/:id/notes`, `GET /conversations/:id/export` | `conversations:read/review/export` |
| Feedback | `GET /feedback`, `PATCH /feedback/:id` `{status?, priority?, note?}` | `feedback:read/manage` |
| Ads | `GET/POST /ads`, `GET/PATCH/DELETE /ads/:id` | `ads:read/write` |
| Featured | `GET/POST /featured`, `PATCH/DELETE /featured/:id` (published listings only; no overlapping placement) | `ads:read/write` |
| Users | `GET /users`, `GET/PATCH /users/:id` | `users:read/manage` |
| Administrators | `GET/POST /administrators` (invite), `PATCH /administrators/:id` (not yourself; last super admin protected) | `admins:manage` |
| Activity | `GET /activity` (audit log) | `logs:read` |
| Analytics | `GET /analytics/dashboard?days=30` | `analytics:read` |
| Monitoring | `GET /monitoring/health`, `GET/PATCH /monitoring/errors`, `GET /monitoring/retrieval-logs` | `logs:read` |
| Settings | `GET /settings/:key`, `PUT /settings/:key` (`chatbot`, `general`) | `settings:read/write` |

### Listing shape (admin)

Matches the admin dashboard's model: `{ id, name, slug, shortDescription, description, listingType, categoryId, secondaryCategoryIds, status, featured, location: { countryId, regionId, cityId, neighborhoodId, address, postalCode, lat, lng, displayPreference }, contact: { phone, email, website, whatsapp, bookingUrl, socials[] }, details: { openingHours[{day,hours}], priceRange, amenities[], accessibility, languages[], audiences[], bookingRequirements, notes }, media: { featuredImage, featuredAlt, gallery[] }, seo, ai: { includeInChatbot, includeContact, indexingStatus, lastIndexedAt, chunkCount }, review, version, createdAt, updatedAt, publishedAt, archivedAt }`.
Supplying only the deepest location id (e.g. `cityId`) fills in the rest of the path.
