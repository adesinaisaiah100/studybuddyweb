create extension if not exists vector;

drop function if exists public.match_course_embeddings(
  p_course_id uuid,
  p_query_embedding vector,
  p_match_count integer,
  p_material_ids uuid[]
);

create or replace function public.match_course_embeddings(
  p_course_id uuid,
  p_query_embedding vector,
  p_match_count integer default 6,
  p_material_ids uuid[] default null
)
returns table (
  chunk_id uuid,
  material_id uuid,
  content text,
  metadata jsonb,
  score double precision
)
language sql
stable
set search_path = public
as $$
  select
    ce.id as chunk_id,
    ce.material_id,
    ce.content,
    ce.metadata,
    1 - (ce.embedding <=> p_query_embedding) as score
  from public.course_embeddings ce
  where ce.course_id = p_course_id
    and (
      p_material_ids is null
      or coalesce(array_length(p_material_ids, 1), 0) = 0
      or ce.material_id = any(p_material_ids)
    )
  order by ce.embedding <=> p_query_embedding
  limit greatest(coalesce(p_match_count, 6), 1);
$$;

grant execute on function public.match_course_embeddings(uuid, vector, integer, uuid[]) to authenticated;
grant execute on function public.match_course_embeddings(uuid, vector, integer, uuid[]) to service_role;
