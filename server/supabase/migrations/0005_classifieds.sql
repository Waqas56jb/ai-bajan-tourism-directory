-- Jobs & classified advertisements (admin-approved, with expiry dates), searchable by the assistant.
-- Additive and idempotent; only website_with_rag_* objects.

create table if not exists {{schema}}.website_with_rag_classifieds (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('job', 'classified')),
  title text not null check (length(btrim(title)) between 3 and 140),
  description text not null check (length(btrim(description)) between 10 and 4000),
  category text not null default '',
  -- Jobs
  employer text not null default '',
  employment_type text not null default '',
  salary text not null default '',
  qualifications text not null default '',
  apply_url text not null default '',
  apply_deadline date,
  -- Classifieds
  price text not null default '',
  item_condition text not null default '',
  -- Where / who
  location_id uuid references {{schema}}.website_with_rag_locations(id) on delete set null,
  area text not null default '',
  contact_name text not null check (length(btrim(contact_name)) between 2 and 120),
  contact_phone text not null default '',
  contact_whatsapp text not null default '',
  contact_email text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired')),
  expires_at date,
  review_note text not null default '',
  reviewed_by uuid references {{schema}}.website_with_rag_admins(id) on delete set null,
  reviewed_at timestamptz,
  content_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint website_with_rag_classifieds_contact check (contact_phone <> '' or contact_whatsapp <> '' or contact_email <> '' or apply_url <> '')
);
create index if not exists website_with_rag_classifieds_status_idx on {{schema}}.website_with_rag_classifieds (status, kind, expires_at);
create index if not exists website_with_rag_classifieds_location_idx on {{schema}}.website_with_rag_classifieds (location_id);

create or replace trigger website_with_rag_classifieds_touch before update on {{schema}}.website_with_rag_classifieds
  for each row execute function {{schema}}.website_with_rag_touch_updated_at();

-- Allow 'classified' as a knowledge source (constraints on our own tables only).
alter table {{schema}}.website_with_rag_knowledge_chunks drop constraint if exists website_with_rag_knowledge_chunks_source_type_check;
alter table {{schema}}.website_with_rag_knowledge_chunks add constraint website_with_rag_knowledge_chunks_source_type_check
  check (source_type in ('listing', 'faq', 'document', 'classified'));
alter table {{schema}}.website_with_rag_index_state drop constraint if exists website_with_rag_index_state_source_type_check;
alter table {{schema}}.website_with_rag_index_state add constraint website_with_rag_index_state_source_type_check
  check (source_type in ('listing', 'faq', 'document', 'classified'));
alter table {{schema}}.website_with_rag_sync_jobs drop constraint if exists website_with_rag_sync_jobs_source_type_check;
alter table {{schema}}.website_with_rag_sync_jobs add constraint website_with_rag_sync_jobs_source_type_check
  check (source_type in ('listing', 'faq', 'document', 'classified'));
