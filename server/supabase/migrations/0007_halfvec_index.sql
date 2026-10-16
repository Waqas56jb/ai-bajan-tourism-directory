-- Faster semantic search on a larger knowledge base. A half-precision (halfvec) HNSW index is half
-- the size of the full-precision one, so it stays in memory and searches stay fast as the Trusted
-- Information Network grows; ranking quality is effectively unchanged. Embeddings are still
-- stored at full precision. Additive: the full-precision index is left in place.
create index if not exists website_with_rag_chunks_embedding_half_idx
  on {{schema}}.website_with_rag_knowledge_chunks
  using hnsw ((embedding::extensions.halfvec({{embedding_dims}})) extensions.halfvec_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Same contract as before; candidates are found with the halfvec index and the reported
-- similarity is computed at full precision.
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
   order by c.embedding::halfvec({{embedding_dims}}) <=> p_embedding::halfvec({{embedding_dims}})
   limit least(greatest(coalesce(p_limit, 30), 1), 100)
$$;
