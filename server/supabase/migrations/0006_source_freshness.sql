-- Trusted Information Network: keep each imported web page's own "last updated" date and track
-- the regular checks for changes. Additive and idempotent.
alter table {{schema}}.website_with_rag_knowledge_documents
  add column if not exists source_updated_at date,
  add column if not exists last_checked_at timestamptz,
  add column if not exists check_failures int not null default 0;

create index if not exists website_with_rag_knowledge_documents_checked_idx
  on {{schema}}.website_with_rag_knowledge_documents (last_checked_at nulls first)
  where source_reference like 'http%';
