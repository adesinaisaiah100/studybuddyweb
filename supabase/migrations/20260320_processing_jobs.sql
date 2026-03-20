create table if not exists public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  material_id uuid not null references public.course_materials(id) on delete cascade,
  title text,
  material_type text,
  raw_text text,
  content_hash text,
  status text not null default 'queued' check (status in ('queued', 'extracting', 'vectorizing', 'completed', 'failed')),
  milestone text not null default 'uploaded' check (milestone in ('uploaded', 'extracting', 'vectorizing', 'complete', 'failed')),
  eta_range text,
  attempts int not null default 0,
  max_attempts int not null default 3,
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (material_id)
);

create index if not exists processing_jobs_user_course_idx
  on public.processing_jobs(user_id, course_id, created_at desc);

create index if not exists processing_jobs_status_idx
  on public.processing_jobs(status, created_at asc);

create index if not exists processing_jobs_hash_idx
  on public.processing_jobs(user_id, course_id, content_hash)
  where content_hash is not null;

create or replace function public.set_processing_jobs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists processing_jobs_set_updated_at on public.processing_jobs;
create trigger processing_jobs_set_updated_at
before update on public.processing_jobs
for each row
execute function public.set_processing_jobs_updated_at();

alter table public.processing_jobs enable row level security;

drop policy if exists "processing_jobs_select_own" on public.processing_jobs;
create policy "processing_jobs_select_own"
on public.processing_jobs
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "processing_jobs_insert_own" on public.processing_jobs;
create policy "processing_jobs_insert_own"
on public.processing_jobs
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "processing_jobs_update_own" on public.processing_jobs;
create policy "processing_jobs_update_own"
on public.processing_jobs
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "processing_jobs_delete_own" on public.processing_jobs;
create policy "processing_jobs_delete_own"
on public.processing_jobs
for delete
to authenticated
using (auth.uid() = user_id);
