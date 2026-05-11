alter table public.chat_sessions
add column if not exists compacted_through_message_id uuid null
references public.chat_messages(id) on delete set null;
