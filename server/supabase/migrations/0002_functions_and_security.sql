-- Triggers, retrieval/queue functions and default settings for AI Bajan objects.
-- Additive/idempotent. Only touches objects named website_with_rag_*.

-- ---------------------------------------------------------------- triggers
create or replace trigger website_with_rag_categories_touch before update on {{schema}}.website_with_rag_categories
  for each row execute function {{schema}}.website_with_rag_touch_updated_at();
create or replace trigger website_with_rag_locations_touch before update on {{schema}}.website_with_rag_locations
  for each row execute function {{schema}}.website_with_rag_touch_updated_at();
create or replace trigger website_with_rag_locations_hierarchy before insert or update of parent_id, type
  on {{schema}}.website_with_rag_locations
  for each row execute function {{schema}}.website_with_rag_locations_check_hierarchy();
create or replace trigger website_with_rag_listings_touch before update on {{schema}}.website_with_rag_listings
  for each row execute function {{schema}}.website_with_rag_touch_updated_at();
create or replace trigger website_with_rag_listings_search before insert or update of name, short_description, description, amenities
  on {{schema}}.website_with_rag_listings
  for each row execute function {{schema}}.website_with_rag_listings_search_document();
create or replace trigger website_with_rag_faqs_touch before update on {{schema}}.website_with_rag_faqs
  for each row execute function {{schema}}.website_with_rag_touch_updated_at();
create or replace trigger website_with_rag_documents_touch before update on {{schema}}.website_with_rag_knowledge_documents
  for each row execute function {{schema}}.website_with_rag_touch_updated_at();
create or replace trigger website_with_rag_sync_jobs_touch before update on {{schema}}.website_with_rag_sync_jobs
  for each row execute function {{schema}}.website_with_rag_touch_updated_at();
create or replace trigger website_with_rag_conversations_touch before update on {{schema}}.website_with_rag_conversations
  for each row execute function {{schema}}.website_with_rag_touch_updated_at();
create or replace trigger website_with_rag_feedback_touch before update on {{schema}}.website_with_rag_feedback
  for each row execute function {{schema}}.website_with_rag_touch_updated_at();
create or replace trigger website_with_rag_ads_touch before update on {{schema}}.website_with_rag_ads
  for each row execute function {{schema}}.website_with_rag_touch_updated_at();
create or replace trigger website_with_rag_featured_touch before update on {{schema}}.website_with_rag_featured_listings
  for each row execute function {{schema}}.website_with_rag_touch_updated_at();
create or replace trigger website_with_rag_admins_touch before update on {{schema}}.website_with_rag_admins
  for each row execute function {{schema}}.website_with_rag_touch_updated_at();
create or replace trigger website_with_rag_users_touch before update on {{schema}}.website_with_rag_users
  for each row execute function {{schema}}.website_with_rag_touch_updated_at();

-- ---------------------------------------------------------------- retrieval
-- Keyword retrieval over ACTIVE chunks only. p_tsquery is built server-side from sanitised
-- tokens (letters/digits only) joined with | and <->, so to_tsquery cannot be fed raw user syntax.
create or replace function {{schema}}.website_with_rag_keyword_search(
  p_tsquery text,
  p_source_types text[] default null,
  p_category_ids uuid[] default null,
  p_location_ids uuid[] default null,
  p_limit int default 30
)
returns table (
  chunk_id uuid, source_type text, source_id uuid, source_version int, chunk_kind text, title text,
  chunk_text text, metadata jsonb, category_ids uuid[], location_ids uuid[], rank real
)
language sql stable set search_path = {{schema}}, pg_catalog as $$
  select c.id, c.source_type, c.source_id, c.source_version, c.chunk_kind, c.title, c.chunk_text,
         c.metadata, c.category_ids, c.location_ids, ts_rank_cd(c.fts, q, 1)::real as rank
    from website_with_rag_knowledge_chunks c, to_tsquery('english', p_tsquery) q
   where c.is_active
     and c.fts @@ q
     and (p_source_types is null or c.source_type = any (p_source_types))
     and (p_category_ids is null or c.category_ids && p_category_ids)
     and (p_location_ids is null or c.location_ids && p_location_ids)
   order by rank desc, c.id
   limit least(greatest(coalesce(p_limit, 30), 1), 100)
$$;

-- Semantic retrieval. Cosine distance (<=>); similarity = 1 - distance, higher is better.
create or replace function {{schema}}.website_with_rag_vector_search(
  p_embedding extensions.vector,
  p_source_types text[] default null,
  p_category_ids uuid[] default null,
  p_location_ids uuid[] default null,
  p_limit int default 30
)
returns table (
  chunk_id uuid, source_type text, source_id uuid, source_version int, chunk_kind text, title text,
  chunk_text text, metadata jsonb, category_ids uuid[], location_ids uuid[], similarity double precision
)
language sql stable set search_path = {{schema}}, extensions, pg_catalog as $$
  select c.id, c.source_type, c.source_id, c.source_version, c.chunk_kind, c.title, c.chunk_text,
         c.metadata, c.category_ids, c.location_ids, 1 - (c.embedding <=> p_embedding) as similarity
    from website_with_rag_knowledge_chunks c
   where c.is_active
     and c.embedding is not null
     and (p_source_types is null or c.source_type = any (p_source_types))
     and (p_category_ids is null or c.category_ids && p_category_ids)
     and (p_location_ids is null or c.location_ids && p_location_ids)
   order by c.embedding <=> p_embedding, c.id
   limit least(greatest(coalesce(p_limit, 30), 1), 100)
$$;

-- ---------------------------------------------------------------- durable queue
-- Claims due jobs (or jobs whose worker lease expired) with SKIP LOCKED so concurrent workers
-- never process the same job.
create or replace function {{schema}}.website_with_rag_claim_sync_jobs(
  p_worker text, p_limit int default 5, p_lease_seconds int default 120
)
returns setof {{schema}}.website_with_rag_sync_jobs
language sql volatile set search_path = {{schema}}, pg_catalog as $$
  update website_with_rag_sync_jobs j
     set status = 'running',
         attempts = j.attempts + 1,
         locked_by = p_worker,
         lease_expires_at = now() + make_interval(secs => p_lease_seconds),
         started_at = now()
   where j.id in (
     select id from website_with_rag_sync_jobs
      where (status = 'pending' and next_run_at <= now())
         or (status = 'running' and lease_expires_at < now())
      order by next_run_at, created_at
      limit least(greatest(p_limit, 1), 50)
      for update skip locked
   )
  returning j.*
$$;

-- ---------------------------------------------------------------- default settings (never overwrite)
insert into {{schema}}.website_with_rag_settings (key, value) values
  ('chatbot', jsonb_build_object(
     'enabled', true,
     'displayName', 'AI Bajan',
     'welcomeMessage', 'Hi! I can help you find places, food, stays and things to do in Barbados.',
     'fallbackMessage', 'I couldn''t find that in the AI Bajan directory yet.',
     'tone', 'friendly',
     'answerLength', 'concise',
     'showSources', true,
     'suggestedQuestions', jsonb_build_array('Where can I eat seafood on the west coast?', 'Which hotels are listed in Bridgetown?')
   )),
  ('general', jsonb_build_object(
     'siteName', 'AI Bajan',
     'supportEmail', '',
     'defaultLanguage', 'en',
     'timezone', 'America/Barbados'
   ))
on conflict (key) do nothing;

-- Access hardening (RLS + revokes) lives in supabase/policies/harden.sql and is re-applied by
-- src/database/migrate.ts after every run so that tables added later are always covered.
