create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  summary text,
  is_compacted boolean not null default false,
  total_tokens integer not null default 0 check (total_tokens >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  tokens integer not null default 0 check (tokens >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_sessions_user_updated_at
  on public.chat_sessions(user_id, updated_at desc);

create index if not exists idx_chat_sessions_course_updated_at
  on public.chat_sessions(course_id, updated_at desc);

create index if not exists idx_chat_messages_session_created_at
  on public.chat_messages(session_id, created_at asc);

create or replace function public.update_chat_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trigger_chat_sessions_updated_at on public.chat_sessions;
create trigger trigger_chat_sessions_updated_at
  before update on public.chat_sessions
  for each row
  execute function public.update_chat_sessions_updated_at();

alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "chat_sessions_select_own" on public.chat_sessions;
create policy "chat_sessions_select_own"
on public.chat_sessions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "chat_sessions_insert_own" on public.chat_sessions;
create policy "chat_sessions_insert_own"
on public.chat_sessions
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.courses c
    where c.id = chat_sessions.course_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "chat_sessions_update_own" on public.chat_sessions;
create policy "chat_sessions_update_own"
on public.chat_sessions
for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.courses c
    where c.id = chat_sessions.course_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "chat_sessions_delete_own" on public.chat_sessions;
create policy "chat_sessions_delete_own"
on public.chat_sessions
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "chat_messages_select_own" on public.chat_messages;
create policy "chat_messages_select_own"
on public.chat_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.chat_sessions s
    where s.id = chat_messages.session_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists "chat_messages_insert_own" on public.chat_messages;
create policy "chat_messages_insert_own"
on public.chat_messages
for insert
to authenticated
with check (
  exists (
    select 1
    from public.chat_sessions s
    where s.id = chat_messages.session_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists "chat_messages_update_own" on public.chat_messages;
create policy "chat_messages_update_own"
on public.chat_messages
for update
to authenticated
using (
  exists (
    select 1
    from public.chat_sessions s
    where s.id = chat_messages.session_id
      and s.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.chat_sessions s
    where s.id = chat_messages.session_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists "chat_messages_delete_own" on public.chat_messages;
create policy "chat_messages_delete_own"
on public.chat_messages
for delete
to authenticated
using (
  exists (
    select 1
    from public.chat_sessions s
    where s.id = chat_messages.session_id
      and s.user_id = auth.uid()
  )
);

grant select, insert, update, delete on public.chat_sessions to authenticated;
grant select, insert, update, delete on public.chat_messages to authenticated;
