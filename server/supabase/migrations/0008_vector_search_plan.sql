-- Semantic search must use the HNSW index. As a SQL function the search ran as a generic plan
-- (its LIMIT is an expression of a parameter), so the planner chose to score every chunk, which
-- slowed down as the knowledge base grew. Building the query with the actual values (EXECUTE …
-- USING) gives the planner the real limit, so it uses the halfvec HNSW index. Same contract.
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
language plpgsql stable set search_path = {{schema}}, extensions, pg_catalog as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 30), 1), 100);
begin
  return query execute format(
    'select c.id, c.source_type, c.source_id, c.source_version, c.chunk_kind, c.title, c.chunk_text,
            c.metadata, c.category_ids, c.location_ids, 1 - (c.embedding <=> $1) as similarity
       from website_with_rag_knowledge_chunks c
      where c.is_active
        and c.embedding is not null
        and ($2::text[] is null or c.source_type = any ($2))
        and ($3::uuid[] is null or c.category_ids && $3)
        and ($4::uuid[] is null or c.location_ids && $4)
      order by c.embedding::halfvec(%s) <=> $1::halfvec(%s)
      limit %s',
    {{embedding_dims}}, {{embedding_dims}}, v_limit)
  using p_embedding, p_source_types, p_category_ids, p_location_ids;
end;
$$;
