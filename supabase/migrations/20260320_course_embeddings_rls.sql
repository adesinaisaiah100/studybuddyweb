alter table public.course_embeddings enable row level security;

drop policy if exists "course_embeddings_select_own" on public.course_embeddings;
create policy "course_embeddings_select_own"
on public.course_embeddings
for select
to authenticated
using (
  exists (
    select 1
    from public.courses c
    where c.id = course_embeddings.course_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "course_embeddings_insert_own" on public.course_embeddings;
create policy "course_embeddings_insert_own"
on public.course_embeddings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.courses c
    where c.id = course_embeddings.course_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "course_embeddings_update_own" on public.course_embeddings;
create policy "course_embeddings_update_own"
on public.course_embeddings
for update
to authenticated
using (
  exists (
    select 1
    from public.courses c
    where c.id = course_embeddings.course_id
      and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.courses c
    where c.id = course_embeddings.course_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "course_embeddings_delete_own" on public.course_embeddings;
create policy "course_embeddings_delete_own"
on public.course_embeddings
for delete
to authenticated
using (
  exists (
    select 1
    from public.courses c
    where c.id = course_embeddings.course_id
      and c.user_id = auth.uid()
  )
);
