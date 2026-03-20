create table if not exists public.course_outlines (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  material_id uuid references public.course_materials(id) on delete set null,
  status text not null default 'ready' check (status in ('ready','partial','failed')),
  outline_json jsonb not null,
  youtube_status text,
  web_status text,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(course_id)
);

create table if not exists public.course_module_resources (
  id uuid primary key default gen_random_uuid(),
  outline_id uuid not null references public.course_outlines(id) on delete cascade,
  module_slug text not null,
  module_title text not null,
  resource_type text not null check (resource_type in ('web','youtube')),
  title text not null,
  url text not null,
  source text not null,
  score numeric not null default 0,
  metadata jsonb,
  created_at timestamptz not null default now(),
  unique(outline_id, url)
);

create index if not exists course_module_resources_outline_idx
  on public.course_module_resources(outline_id, module_slug, score desc);

create or replace function public.set_course_outlines_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists course_outlines_set_updated_at on public.course_outlines;
create trigger course_outlines_set_updated_at
before update on public.course_outlines
for each row
execute function public.set_course_outlines_updated_at();

alter table public.course_outlines enable row level security;
alter table public.course_module_resources enable row level security;

drop policy if exists "course_outlines_select_own" on public.course_outlines;
create policy "course_outlines_select_own"
on public.course_outlines
for select
to authenticated
using (
  exists (
    select 1 from public.courses c
    where c.id = course_outlines.course_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "course_outlines_insert_own" on public.course_outlines;
create policy "course_outlines_insert_own"
on public.course_outlines
for insert
to authenticated
with check (
  exists (
    select 1 from public.courses c
    where c.id = course_outlines.course_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "course_outlines_update_own" on public.course_outlines;
create policy "course_outlines_update_own"
on public.course_outlines
for update
to authenticated
using (
  exists (
    select 1 from public.courses c
    where c.id = course_outlines.course_id
      and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.courses c
    where c.id = course_outlines.course_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "course_outlines_delete_own" on public.course_outlines;
create policy "course_outlines_delete_own"
on public.course_outlines
for delete
to authenticated
using (
  exists (
    select 1 from public.courses c
    where c.id = course_outlines.course_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "course_module_resources_select_own" on public.course_module_resources;
create policy "course_module_resources_select_own"
on public.course_module_resources
for select
to authenticated
using (
  exists (
    select 1
    from public.course_outlines co
    join public.courses c on c.id = co.course_id
    where co.id = course_module_resources.outline_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "course_module_resources_insert_own" on public.course_module_resources;
create policy "course_module_resources_insert_own"
on public.course_module_resources
for insert
to authenticated
with check (
  exists (
    select 1
    from public.course_outlines co
    join public.courses c on c.id = co.course_id
    where co.id = course_module_resources.outline_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "course_module_resources_update_own" on public.course_module_resources;
create policy "course_module_resources_update_own"
on public.course_module_resources
for update
to authenticated
using (
  exists (
    select 1
    from public.course_outlines co
    join public.courses c on c.id = co.course_id
    where co.id = course_module_resources.outline_id
      and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.course_outlines co
    join public.courses c on c.id = co.course_id
    where co.id = course_module_resources.outline_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "course_module_resources_delete_own" on public.course_module_resources;
create policy "course_module_resources_delete_own"
on public.course_module_resources
for delete
to authenticated
using (
  exists (
    select 1
    from public.course_outlines co
    join public.courses c on c.id = co.course_id
    where co.id = course_module_resources.outline_id
      and c.user_id = auth.uid()
  )
);
