-- AI Bajan core schema.
-- Additive and idempotent: every statement uses IF NOT EXISTS / CREATE OR REPLACE on objects that
-- carry the website_with_rag_ prefix. No DROP, TRUNCATE or ALTER of objects owned by other projects.
-- Placeholders substituted by src/database/migrate.ts:
--   {{schema}}          target schema (public in production, website_with_rag_test for tests)
--   {{embedding_dims}}  embedding vector dimensions (must match OPENAI_EMBEDDING_MODEL output)
-- pgvector is reused from the existing `extensions` schema; it is NOT installed or altered here.

-- ---------------------------------------------------------------- shared helpers
create or replace function {{schema}}.website_with_rag_touch_updated_at()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- administrators
create table if not exists {{schema}}.website_with_rag_admins (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  email text not null,
  display_name text not null default '',
  role text not null check (role in ('super_admin','administrator','content_manager','moderator','analyst')),
  status text not null default 'active' check (status in ('active','invited','suspended')),
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint website_with_rag_admins_email_lower check (email = lower(email))
);
create unique index if not exists website_with_rag_admins_email_key on {{schema}}.website_with_rag_admins (email);

-- ---------------------------------------------------------------- public site users (profiles only)
create table if not exists {{schema}}.website_with_rag_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  email text not null,
  display_name text not null default '',
  role text not null default 'visitor' check (role in ('visitor','business_owner','listing_manager')),
  status text not null default 'active' check (status in ('active','invited','suspended','deactivated')),
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint website_with_rag_users_email_lower check (email = lower(email))
);
create unique index if not exists website_with_rag_users_email_key on {{schema}}.website_with_rag_users (email);

-- ---------------------------------------------------------------- categories
create table if not exists {{schema}}.website_with_rag_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  icon text not null default '',
  image_url text not null default '',
  parent_id uuid references {{schema}}.website_with_rag_categories(id) on delete restrict,
  synonyms text[] not null default '{}',
  display_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint website_with_rag_categories_not_self check (parent_id is null or parent_id <> id)
);
create index if not exists website_with_rag_categories_parent_idx on {{schema}}.website_with_rag_categories (parent_id);

-- ---------------------------------------------------------------- locations
create table if not exists {{schema}}.website_with_rag_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  type text not null check (type in ('country','region','city','neighborhood')),
  parent_id uuid references {{schema}}.website_with_rag_locations(id) on delete restrict,
  description text not null default '',
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  aliases text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint website_with_rag_locations_not_self check (parent_id is null or parent_id <> id),
  constraint website_with_rag_locations_country_root check ((type = 'country') = (parent_id is null))
);
create index if not exists website_with_rag_locations_parent_idx on {{schema}}.website_with_rag_locations (parent_id);

-- Prevents circular hierarchies and parent/child type mismatches even if the API is bypassed.
create or replace function {{schema}}.website_with_rag_locations_check_hierarchy()
returns trigger language plpgsql set search_path = {{schema}}, pg_catalog as $$
declare
  parent_type text;
  cursor_id uuid;
  depth int := 0;
begin
  if new.parent_id is null then
    return new;
  end if;
  select type into parent_type from website_with_rag_locations where id = new.parent_id;
  if parent_type is null then
    raise exception 'Parent location does not exist' using errcode = '23503';
  end if;
  if (new.type, parent_type) not in (('region','country'),('city','region'),('neighborhood','city')) then
    raise exception 'A % cannot be placed under a %', new.type, parent_type using errcode = '23514';
  end if;
  cursor_id := new.parent_id;
  while cursor_id is not null loop
    if cursor_id = new.id then
      raise exception 'Location hierarchy would become circular' using errcode = '23514';
    end if;
    depth := depth + 1;
    if depth > 10 then
      raise exception 'Location hierarchy is too deep' using errcode = '23514';
    end if;
    select parent_id into cursor_id from website_with_rag_locations where id = cursor_id;
  end loop;
  return new;
end $$;

-- ---------------------------------------------------------------- listings
create table if not exists {{schema}}.website_with_rag_listings (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  short_description text not null default '',
  description text not null default '',
  listing_type text not null default 'Business',
  primary_category_id uuid references {{schema}}.website_with_rag_categories(id) on delete restrict,
  secondary_category_ids uuid[] not null default '{}',
  country_id uuid references {{schema}}.website_with_rag_locations(id) on delete restrict,
  region_id uuid references {{schema}}.website_with_rag_locations(id) on delete restrict,
  city_id uuid references {{schema}}.website_with_rag_locations(id) on delete restrict,
  neighborhood_id uuid references {{schema}}.website_with_rag_locations(id) on delete restrict,
  street_address text not null default '',
  postal_code text not null default '',
  address_display text not null default 'area' check (address_display in ('full','area','hidden')),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  phone text not null default '',
  email text not null default '',
  website_url text not null default '',
  whatsapp text not null default '',
  booking_url text not null default '',
  social_links jsonb not null default '[]' check (jsonb_typeof(social_links) = 'array'),
  opening_hours jsonb not null default '[]' check (jsonb_typeof(opening_hours) = 'array'),
  price_range text not null default '',
  amenities text[] not null default '{}',
  accessibility text not null default '',
  languages text[] not null default '{}',
  audiences text[] not null default '{}',
  booking_requirements text not null default '',
  images jsonb not null default '{}' check (jsonb_typeof(images) = 'object'),
  seo jsonb not null default '{}' check (jsonb_typeof(seo) = 'object'),
  status text not null default 'draft' check (status in ('draft','pending','published','rejected','archived')),
  featured boolean not null default false,
  include_in_chatbot boolean not null default true,
  chatbot_include_contact boolean not null default true,
  rejection_reason text not null default '',
  review_feedback text not null default '',
  private_notes text not null default '',
  owner_user_id uuid references {{schema}}.website_with_rag_users(id) on delete set null,
  created_by uuid references {{schema}}.website_with_rag_admins(id) on delete set null,
  updated_by uuid references {{schema}}.website_with_rag_admins(id) on delete set null,
  content_version int not null default 1,
  search_tsv tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  archived_at timestamptz
);
create index if not exists website_with_rag_listings_status_idx on {{schema}}.website_with_rag_listings (status, updated_at desc);
create index if not exists website_with_rag_listings_category_idx on {{schema}}.website_with_rag_listings (primary_category_id);
create index if not exists website_with_rag_listings_secondary_cat_idx on {{schema}}.website_with_rag_listings using gin (secondary_category_ids);
create index if not exists website_with_rag_listings_region_idx on {{schema}}.website_with_rag_listings (region_id);
create index if not exists website_with_rag_listings_city_idx on {{schema}}.website_with_rag_listings (city_id);
create index if not exists website_with_rag_listings_neighborhood_idx on {{schema}}.website_with_rag_listings (neighborhood_id);
create index if not exists website_with_rag_listings_owner_idx on {{schema}}.website_with_rag_listings (owner_user_id);
create index if not exists website_with_rag_listings_search_idx on {{schema}}.website_with_rag_listings using gin (search_tsv);
create index if not exists website_with_rag_listings_created_idx on {{schema}}.website_with_rag_listings (created_at desc);

-- private_notes and review fields are intentionally excluded from the search document.
create or replace function {{schema}}.website_with_rag_listings_search_document()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  new.search_tsv :=
    setweight(to_tsvector('english', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.short_description, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(new.amenities, ' ')), 'C') ||
    setweight(to_tsvector('english', coalesce(new.description, '')), 'D');
  return new;
end $$;

-- ---------------------------------------------------------------- FAQs
create table if not exists {{schema}}.website_with_rag_faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null check (length(btrim(question)) >= 5),
  answer text not null check (length(btrim(answer)) >= 2),
  category_id uuid references {{schema}}.website_with_rag_categories(id) on delete set null,
  location_id uuid references {{schema}}.website_with_rag_locations(id) on delete set null,
  related_listing_id uuid references {{schema}}.website_with_rag_listings(id) on delete set null,
  tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected')),
  include_in_chatbot boolean not null default true,
  display_order int not null default 0,
  content_hash text not null default '',
  content_version int not null default 1,
  created_by uuid references {{schema}}.website_with_rag_admins(id) on delete set null,
  updated_by uuid references {{schema}}.website_with_rag_admins(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists website_with_rag_faqs_status_idx on {{schema}}.website_with_rag_faqs (status, display_order);
create index if not exists website_with_rag_faqs_category_idx on {{schema}}.website_with_rag_faqs (category_id);
create index if not exists website_with_rag_faqs_location_idx on {{schema}}.website_with_rag_faqs (location_id);
create index if not exists website_with_rag_faqs_listing_idx on {{schema}}.website_with_rag_faqs (related_listing_id);

-- ---------------------------------------------------------------- knowledge documents
create table if not exists {{schema}}.website_with_rag_knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 3 and 200),
  summary text not null default '',
  content text not null default '',
  source_type text not null default 'article' check (source_type in ('guide','article','policy','upload')),
  source_reference text not null default '',
  category_id uuid references {{schema}}.website_with_rag_categories(id) on delete set null,
  location_id uuid references {{schema}}.website_with_rag_locations(id) on delete set null,
  related_listing_id uuid references {{schema}}.website_with_rag_listings(id) on delete set null,
  tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','review','published','archived')),
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected')),
  visibility text not null default 'public' check (visibility in ('public','internal')),
  include_in_chatbot boolean not null default true,
  file_name text not null default '',
  file_mime text not null default '',
  file_size_bytes int,
  extraction_status text not null default 'not_applicable'
    check (extraction_status in ('not_applicable','extracted','failed')),
  extraction_error text not null default '',
  content_hash text not null default '',
  content_version int not null default 1,
  created_by uuid references {{schema}}.website_with_rag_admins(id) on delete set null,
  updated_by uuid references {{schema}}.website_with_rag_admins(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists website_with_rag_documents_status_idx on {{schema}}.website_with_rag_knowledge_documents (status, updated_at desc);
create index if not exists website_with_rag_documents_hash_idx on {{schema}}.website_with_rag_knowledge_documents (content_hash);
create index if not exists website_with_rag_documents_category_idx on {{schema}}.website_with_rag_knowledge_documents (category_id);
create index if not exists website_with_rag_documents_location_idx on {{schema}}.website_with_rag_knowledge_documents (location_id);

-- ---------------------------------------------------------------- index state (one row per indexed source)
create table if not exists {{schema}}.website_with_rag_index_state (
  source_type text not null check (source_type in ('listing','faq','document')),
  source_id uuid not null,
  status text not null default 'pending'
    check (status in ('pending','processing','indexed','keyword_only','failed','excluded','removed')),
  indexed_version int,
  indexed_hash text,
  embedding_model text,
  chunk_count int not null default 0,
  last_indexed_at timestamptz,
  last_error text not null default '',
  updated_at timestamptz not null default now(),
  primary key (source_type, source_id)
);
create index if not exists website_with_rag_index_state_status_idx on {{schema}}.website_with_rag_index_state (status);

-- ---------------------------------------------------------------- knowledge chunks + embeddings
create table if not exists {{schema}}.website_with_rag_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('listing','faq','document')),
  source_id uuid not null,
  source_version int not null,
  chunk_index int not null check (chunk_index >= 0),
  chunk_kind text not null default 'body',
  title text not null default '',
  chunk_text text not null check (length(btrim(chunk_text)) > 0),
  content_hash text not null,
  embedding extensions.vector({{embedding_dims}}),
  embedding_model text,
  category_ids uuid[] not null default '{}',
  location_ids uuid[] not null default '{}',
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  is_active boolean not null default true,
  fts tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', chunk_text), 'B')
  ) stored,
  created_at timestamptz not null default now(),
  constraint website_with_rag_chunks_unique_seq unique (source_type, source_id, source_version, chunk_index)
);
create index if not exists website_with_rag_chunks_source_idx on {{schema}}.website_with_rag_knowledge_chunks (source_type, source_id, is_active);
create index if not exists website_with_rag_chunks_fts_idx on {{schema}}.website_with_rag_knowledge_chunks using gin (fts);
create index if not exists website_with_rag_chunks_categories_idx on {{schema}}.website_with_rag_knowledge_chunks using gin (category_ids);
create index if not exists website_with_rag_chunks_locations_idx on {{schema}}.website_with_rag_knowledge_chunks using gin (location_ids);
-- HNSW (cosine): good recall without a training step, works on an empty/small table, and stays
-- valid as rows are added (IVFFlat would need re-creation once data grows).
create index if not exists website_with_rag_chunks_embedding_idx on {{schema}}.website_with_rag_knowledge_chunks
  using hnsw (embedding extensions.vector_cosine_ops) with (m = 16, ef_construction = 64);

-- ---------------------------------------------------------------- sync jobs (durable queue)
create table if not exists {{schema}}.website_with_rag_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('listing','faq','document')),
  source_id uuid not null,
  operation text not null check (operation in ('upsert','delete')),
  source_version int not null default 0,
  status text not null default 'pending'
    check (status in ('pending','running','completed','failed','superseded')),
  attempts int not null default 0,
  max_attempts int not null default 5 check (max_attempts between 1 and 20),
  next_run_at timestamptz not null default now(),
  locked_by text,
  lease_expires_at timestamptz,
  last_error text not null default '',
  result jsonb not null default '{}',
  requested_by uuid references {{schema}}.website_with_rag_admins(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);
-- At most one queued job per source: new requests coalesce into it instead of piling up.
create unique index if not exists website_with_rag_sync_jobs_one_pending
  on {{schema}}.website_with_rag_sync_jobs (source_type, source_id) where status = 'pending';
create index if not exists website_with_rag_sync_jobs_claim_idx on {{schema}}.website_with_rag_sync_jobs (status, next_run_at);
create index if not exists website_with_rag_sync_jobs_source_idx on {{schema}}.website_with_rag_sync_jobs (source_type, source_id, created_at desc);

-- ---------------------------------------------------------------- conversations & messages
create table if not exists {{schema}}.website_with_rag_conversations (
  id uuid primary key default gen_random_uuid(),
  visitor_key text not null,
  user_id uuid references {{schema}}.website_with_rag_users(id) on delete set null,
  language text not null default 'en',
  status text not null default 'active' check (status in ('active','ended')),
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed','reviewed','flagged')),
  outcome text not null default 'answered' check (outcome in ('answered','partial','fallback','error')),
  message_count int not null default 0,
  summary text not null default '',
  memory_state jsonb not null default '{}' check (jsonb_typeof(memory_state) = 'object'),
  feedback_summary jsonb not null default '{}',
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists website_with_rag_conversations_visitor_idx on {{schema}}.website_with_rag_conversations (visitor_key, last_activity_at desc);
create index if not exists website_with_rag_conversations_activity_idx on {{schema}}.website_with_rag_conversations (last_activity_at desc);
create index if not exists website_with_rag_conversations_review_idx on {{schema}}.website_with_rag_conversations (review_status);

-- Messages are deleted with their conversation (retention purge only); nothing else cascades into them.
create table if not exists {{schema}}.website_with_rag_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references {{schema}}.website_with_rag_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  client_message_id text,
  sources jsonb not null default '[]' check (jsonb_typeof(sources) = 'array'),
  answer_meta jsonb not null default '{}' check (jsonb_typeof(answer_meta) = 'object'),
  error_code text,
  created_at timestamptz not null default now()
);
create index if not exists website_with_rag_messages_conversation_idx on {{schema}}.website_with_rag_messages (conversation_id, created_at);
create unique index if not exists website_with_rag_messages_client_id_key
  on {{schema}}.website_with_rag_messages (conversation_id, client_message_id) where client_message_id is not null;

create table if not exists {{schema}}.website_with_rag_conversation_notes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references {{schema}}.website_with_rag_conversations(id) on delete cascade,
  admin_id uuid references {{schema}}.website_with_rag_admins(id) on delete set null,
  note text not null check (length(btrim(note)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists website_with_rag_conversation_notes_conv_idx on {{schema}}.website_with_rag_conversation_notes (conversation_id);

-- ---------------------------------------------------------------- retrieval diagnostics
create table if not exists {{schema}}.website_with_rag_retrieval_logs (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  conversation_id uuid references {{schema}}.website_with_rag_conversations(id) on delete set null,
  message_id uuid references {{schema}}.website_with_rag_messages(id) on delete set null,
  normalized_query text not null default '',
  intent text not null default '',
  filters jsonb not null default '{}',
  methods text[] not null default '{}',
  candidate_count int not null default 0,
  selected_sources jsonb not null default '[]',
  scores jsonb not null default '{}',
  evidence_level text not null default '',
  outcome text not null default '',
  fallback_reason text not null default '',
  latency_ms jsonb not null default '{}',
  embedding_model text not null default '',
  chat_model text not null default '',
  config_version text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists website_with_rag_retrieval_logs_created_idx on {{schema}}.website_with_rag_retrieval_logs (created_at desc);
create index if not exists website_with_rag_retrieval_logs_conv_idx on {{schema}}.website_with_rag_retrieval_logs (conversation_id);
create index if not exists website_with_rag_retrieval_logs_outcome_idx on {{schema}}.website_with_rag_retrieval_logs (outcome, created_at desc);

-- ---------------------------------------------------------------- feedback
create table if not exists {{schema}}.website_with_rag_feedback (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('answer_rating','incorrect_answer','missing_info','incorrect_location','broken_link','outdated','general')),
  status text not null default 'new' check (status in ('new','reviewed','resolved','reopened')),
  priority text not null default 'medium' check (priority in ('high','medium','low')),
  helpful boolean,
  message text not null default '' check (length(message) <= 2000),
  conversation_id uuid references {{schema}}.website_with_rag_conversations(id) on delete set null,
  message_id uuid references {{schema}}.website_with_rag_messages(id) on delete set null,
  listing_id uuid references {{schema}}.website_with_rag_listings(id) on delete set null,
  page_url text not null default '',
  contact_email text not null default '',
  admin_notes jsonb not null default '[]' check (jsonb_typeof(admin_notes) = 'array'),
  resolved_by uuid references {{schema}}.website_with_rag_admins(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists website_with_rag_feedback_status_idx on {{schema}}.website_with_rag_feedback (status, created_at desc);
create index if not exists website_with_rag_feedback_conv_idx on {{schema}}.website_with_rag_feedback (conversation_id);
create index if not exists website_with_rag_feedback_listing_idx on {{schema}}.website_with_rag_feedback (listing_id);
create index if not exists website_with_rag_feedback_message_idx on {{schema}}.website_with_rag_feedback (message_id);

-- ---------------------------------------------------------------- advertising
create table if not exists {{schema}}.website_with_rag_ads (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 2 and 120),
  advertiser_name text not null default '',
  placement text not null check (placement in ('homepage_banner','category_page','featured_directory','sidebar')),
  status text not null default 'draft' check (status in ('draft','scheduled','active','paused','ended','archived')),
  start_date date not null,
  end_date date not null,
  image_url text not null default '',
  image_alt text not null default '',
  target_url text not null default '',
  listing_id uuid references {{schema}}.website_with_rag_listings(id) on delete set null,
  category_id uuid references {{schema}}.website_with_rag_categories(id) on delete set null,
  location_id uuid references {{schema}}.website_with_rag_locations(id) on delete set null,
  internal_notes text not null default '',
  impressions int not null default 0 check (impressions >= 0),
  clicks int not null default 0 check (clicks >= 0),
  created_by uuid references {{schema}}.website_with_rag_admins(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint website_with_rag_ads_dates check (end_date >= start_date)
);
create index if not exists website_with_rag_ads_placement_idx on {{schema}}.website_with_rag_ads (placement, status, start_date);
create index if not exists website_with_rag_ads_listing_idx on {{schema}}.website_with_rag_ads (listing_id);
create index if not exists website_with_rag_ads_category_idx on {{schema}}.website_with_rag_ads (category_id);
create index if not exists website_with_rag_ads_location_idx on {{schema}}.website_with_rag_ads (location_id);

-- A placement has no meaning without its listing, so it is removed with the listing.
create table if not exists {{schema}}.website_with_rag_featured_listings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references {{schema}}.website_with_rag_listings(id) on delete cascade,
  placement text not null check (placement in ('homepage','category','destination','chatbot')),
  position int not null default 1 check (position between 1 and 50),
  status text not null default 'scheduled' check (status in ('scheduled','active','paused','ended')),
  start_date date not null,
  end_date date not null,
  notes text not null default '',
  created_by uuid references {{schema}}.website_with_rag_admins(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint website_with_rag_featured_dates check (end_date >= start_date)
);
create index if not exists website_with_rag_featured_listing_idx on {{schema}}.website_with_rag_featured_listings (listing_id);
create index if not exists website_with_rag_featured_placement_idx on {{schema}}.website_with_rag_featured_listings (placement, start_date, end_date);

-- ---------------------------------------------------------------- audit, revisions, settings, errors
create table if not exists {{schema}}.website_with_rag_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_admin_id uuid references {{schema}}.website_with_rag_admins(id) on delete set null,
  actor_label text not null default '',
  action text not null,
  entity_type text not null,
  entity_id text not null default '',
  entity_name text not null default '',
  summary text not null default '',
  changes jsonb not null default '{}',
  status text not null default 'success' check (status in ('success','failure')),
  request_id text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists website_with_rag_audit_created_idx on {{schema}}.website_with_rag_audit_logs (created_at desc);
create index if not exists website_with_rag_audit_entity_idx on {{schema}}.website_with_rag_audit_logs (entity_type, entity_id);
create index if not exists website_with_rag_audit_actor_idx on {{schema}}.website_with_rag_audit_logs (actor_admin_id);

create table if not exists {{schema}}.website_with_rag_content_revisions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('listing','faq','document')),
  entity_id uuid not null,
  version int not null,
  snapshot jsonb not null,
  created_by uuid references {{schema}}.website_with_rag_admins(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint website_with_rag_revisions_unique unique (entity_type, entity_id, version)
);

create table if not exists {{schema}}.website_with_rag_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,60}$'),
  value jsonb not null,
  updated_by uuid references {{schema}}.website_with_rag_admins(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists {{schema}}.website_with_rag_error_events (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  severity text not null default 'error' check (severity in ('critical','error','warning','info')),
  code text not null default '',
  message text not null default '',
  route text not null default '',
  request_id text not null default '',
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists website_with_rag_error_events_created_idx on {{schema}}.website_with_rag_error_events (created_at desc);
