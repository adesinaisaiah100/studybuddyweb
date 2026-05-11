# Study Pal Chat Feature - Implementation Plan

## 1. Database Schema & Migrations (Supabase)
We will create a new migration file (`20260508_chat_system.sql`) introducing two primary tables:

### `chat_sessions` Table
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key to `auth.users`)
- `title` (Text) - Auto-generated based on the first query.
- `summary` (Text, Nullable) - Holds the summarized context once a session is compacted.
- `is_compacted` (Boolean) - Defaults to `false`.
- `total_tokens` (Integer) - Keeps a running tally of tokens used in this session to easily trigger compaction.
- `created_at` (Timestamptz)
- `updated_at` (Timestamptz)

### `chat_messages` Table
- `id` (UUID, Primary Key)
- `session_id` (UUID, Foreign Key to `chat_sessions` on delete cascade)
- `role` (Enum/Text: 'user', 'assistant', 'system')
- `content` (Text)
- `tokens` (Integer) - Estimated token count for this specific message.
- `created_at` (Timestamptz)

## 2. Auto-Compaction Logic
Compaction ensures we don't blow up the LLM token context limit and saves database space. We only preserve the *summary* (individual messages get deleted/archived).

### Triggers For Compaction
1. **Size/Context Threshold:** During a chat, if the session's `total_tokens` exceeds a limit (e.g., 6,000 tokens), the system intercepts and triggers compaction inline or asynchronously.
2. **Time Threshold (14 Days):** A scheduled background job (via Supabase pg_cron or checking on load) finds any active session where `updated_at` is older than 14 days and `is_compacted = false`.

### Execution Flow
1. The backend fetches all `chat_messages` for the target session.
2. It sends these to an AI model with the prompt: *"Summarize the key takeaways, facts, and context of this study conversation exhaustively."*
3. We update `chat_sessions.summary` with this generated summary.
4. We set `chat_sessions.is_compacted = true` and reset `total_tokens`.
5. We **delete** the underlying rows from `chat_messages`.
6. Upon resuming that session, the AI is seeded with a `system` instruction containing the `summary`, essentially picking up where they left off without loading all previous messages.

## 3. Files Required to Implement

### Backend / API
- `app/api/chat/route.ts`: Main endpoint. Saves user message, checks token count, generates AI response, saves assistant message, updates `total_tokens`.
- `lib/studyagent/chatCompaction.ts`: Utility module with `triggerCompaction(sessionId)` logic. Can be called during active chats or standard tasks.
- `app/api/chat/sessions/route.ts`: Endpoint to fetch the session list history for the sidebar.

### Frontend (React/Next.js UI)
- `app/dashboard/study-pal/page.tsx`: The main page layout containing the chat UI.
- `components/chat/ChatLayout.tsx`: Wrapper holding the Sidebar (left) and Active Chat (right).
- `components/chat/ChatSidebar.tsx`: Renders the list of previous `chat_sessions` sorted by `updated_at`.
- `components/chat/ChatArea.tsx`: The main messaging interface (input box, streaming bubble renderer). Uses Vercel AI SDK `useChat`.
- `components/chat/MessageBubble.tsx`: Renders individual Markdown-supported messages with KaTeX math rendering.
