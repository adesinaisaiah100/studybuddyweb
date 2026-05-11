# Supabase Persistence + UI Streaming

This guide covers two production-critical concerns:

1. Persisting agent conversation/events to Supabase
2. Streaming assistant updates to UI in real time

## Recommended Supabase schema

```sql
create table if not exists agent_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references agent_sessions(id) on delete cascade,
  role text not null,                -- user | assistant | toolResult | custom
  content jsonb not null,
  model text,
  provider text,
  stop_reason text,
  is_error boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists agent_tool_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references agent_sessions(id) on delete cascade,
  tool_call_id text not null,
  tool_name text not null,
  phase text not null,               -- start | update | end
  payload jsonb,
  created_at timestamptz not null default now()
);
```

## Persistence integration pattern

Hook into `agent.subscribe()` and write durable records on event boundaries:

- `message_end` -> insert into `agent_messages`
- `tool_execution_start/update/end` -> insert into `agent_tool_events`
- `turn_end` -> update session metadata (updated_at, token/cost rollups if tracked)

### Example: write final messages

```ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

agent.subscribe(async (event) => {
  if (event.type !== "message_end") return;

  const m = event.message as any;
  await supabase.from("agent_messages").insert({
    session_id: sessionId,
    role: m.role,
    content: m.content,
    model: m.model ?? null,
    provider: m.provider ?? null,
    stop_reason: m.stopReason ?? null,
    is_error: m.role === "toolResult" ? Boolean(m.isError) : false,
    created_at: new Date(m.timestamp ?? Date.now()).toISOString(),
  });
});
```

## Real-time UI streaming patterns

### Option A: Server-Sent Events (SSE) for web chat

- Good default for one-way server -> UI streams
- Easy to implement with `ReadableStream`
- Works well for text deltas + tool progress events

### Option B: WebSocket for bidirectional live control

- Use when UI must send immediate controls (pause, steer, follow-up)
- Keep event protocol aligned with `AgentEvent` to avoid adapter complexity

## Event mapping from runtime to UI

Map these events directly:

- `message_update` with `text_delta` -> append assistant text
- `tool_execution_update` -> render tool progress card
- `message_end` -> commit final message bubble
- `turn_end` -> enable next user input, show summary stats
- `agent_end` -> mark run complete

## Frontend state strategy

- Maintain a `draftAssistant` buffer for deltas.
- On `message_end`, move draft into persistent message list.
- Keep `toolEvents` keyed by `tool_call_id` for incremental updates.
- Reconcile with Supabase records when reconnecting after disconnect.

## Reliability tips

- Use server-side Supabase key only on backend routes.
- Persist final messages on `message_end` (not per delta) to reduce write volume.
- Optionally buffer deltas in memory and flush snapshots every N seconds.
- Include a `session_id` and monotonic event index for replay safety.

