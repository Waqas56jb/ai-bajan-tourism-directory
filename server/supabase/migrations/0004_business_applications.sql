-- Business sign-ups / content-provider applications and "Verified by AI Bajan" status.
-- Additive and idempotent; only website_with_rag_* objects.

alter table {{schema}}.website_with_rag_listings
  add column if not exists verified boolean not null default false;
alter table {{schema}}.website_with_rag_listings
  add column if not exists verified_at timestamptz;
alter table {{schema}}.website_with_rag_listings
  add column if not exists info_confirmed_at date;

create table if not exists {{schema}}.website_with_rag_applications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('business', 'content_provider')),
  plan text not null default 'free'
    check (plan in ('free', 'verified', 'business_plus', 'professional_partner', 'sponsored_category', 'contributor')),
  status text not null default 'new' check (status in ('new', 'in_review', 'approved', 'rejected')),
  organisation_name text not null check (length(btrim(organisation_name)) between 2 and 160),
  contact_name text not null check (length(btrim(contact_name)) between 2 and 120),
  contact_role text not null default '',
  contact_email text not null,
  contact_phone text not null default '',
  -- Full submitted details (validated by the API before storage).
  details jsonb not null default '{}' check (jsonb_typeof(details) = 'object'),
  consent_to_use boolean not null check (consent_to_use),
  consented_at timestamptz not null default now(),
  listing_id uuid references {{schema}}.website_with_rag_listings(id) on delete set null,
  review_note text not null default '',
  reviewed_by uuid references {{schema}}.website_with_rag_admins(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists website_with_rag_applications_status_idx on {{schema}}.website_with_rag_applications (status, created_at desc);
create index if not exists website_with_rag_applications_listing_idx on {{schema}}.website_with_rag_applications (listing_id);

create or replace trigger website_with_rag_applications_touch before update on {{schema}}.website_with_rag_applications
  for each row execute function {{schema}}.website_with_rag_touch_updated_at();
