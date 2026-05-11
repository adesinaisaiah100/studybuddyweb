# Chat Compaction Implementation Spec

## Goal

Implement `lib/studyagent/chatCompaction.ts` with `triggerCompaction(sessionId)` so we can reduce agent context size without deleting stored chat history.

Compaction in this project means:

- keep all `chat_messages` rows in the database
- generate and store a rolling summary on `chat_sessions.summary`
- preserve normal chat turn structure inside the summary
- stop passing older raw messages into the agent context
- continue fetching the full raw message history for UI display

This separates:

- `prompt context` for the model
- `display history` for the user interface

## Final Behavior

After compaction:

- the UI can still fetch and render the very first message, first response, and all later messages from `chat_messages`
- the agent will receive:
  - the base system prompt
  - the compacted summary transcript from `chat_sessions.summary`
  - only the most recent raw turns after the compaction boundary
  - the current user message

The agent will not receive the older raw messages that were already compacted.

## Compaction Strategy

### Retention Rule

Keep the most recent `4` turns uncompressed.

Definition of a turn:

- one `user` message
- one `assistant` message

This means compaction should summarize everything except the most recent `2-4` turns, with the first implementation fixed to `4` turns for consistency.

### Summary Format

The saved summary must preserve chat structure and read like a shortened transcript.

Required format:

```text
User: ...
Assistant: ...
User: ...
Assistant: ...
```

The summary is not a bullet list of facts.
It is a compressed conversation memory in normal chat format.

### Data Preservation Rule

Compaction must never delete chat messages.

All messages remain available for:

- UI display
- debugging
- future audits
- re-compaction if needed

## Schema Changes Required

## Existing Fields Already Present

Current `chat_sessions` already contains:

- `summary`
- `is_compacted`
- `total_tokens`

## New Field Required

Add this field to `chat_sessions`:

```sql
compacted_through_message_id uuid null references public.chat_messages(id) on delete set null
```

### Purpose

This marks the last raw message already represented inside `summary`.

Messages at or before this boundary:

- remain in the database
- must not be passed into agent context again

Messages after this boundary:

- remain raw
- can still be passed into the agent as recent context

## Optional Future Fields

Not required for the first implementation, but useful later:

- `compacted_at timestamptz null`
- `summary_tokens integer not null default 0`

## File to Implement

Create:

- `lib/studyagent/chatCompaction.ts`

## Public API

```ts
triggerCompaction(sessionId: string): Promise<ChatCompactionResult>
```

## Return Shape

```ts
type ChatCompactionResult = {
  success: boolean;
  skipped: boolean;
  reason?:
    | "session_not_found"
    | "not_enough_messages"
    | "nothing_new_to_compact"
    | "already_up_to_date";
  sessionId: string;
  compactedMessageCount: number;
  retainedRecentMessageCount: number;
  compactedThroughMessageId: string | null;
  summary: string | null;
};
```

This shape can be adjusted slightly during implementation, but the utility must return:

- whether compaction happened
- why it skipped if it did
- how many messages were summarized
- how many recent raw messages were retained
- the resulting compaction boundary

## Internal Steps for `triggerCompaction(sessionId)`

### 1. Load the Session

Fetch from `chat_sessions`:

- `id`
- `summary`
- `is_compacted`
- `compacted_through_message_id`
- `course_id`
- `total_tokens`

If not found:

- return `skipped: true`
- reason: `session_not_found`

### 2. Load All Messages for the Session

Fetch `chat_messages` ordered by `created_at asc`.

Include:

- `id`
- `role`
- `content`
- `tokens`
- `created_at`

For the first version, only `user` and `assistant` messages should participate in compaction logic.

### 3. Determine the Compactable Window

Rules:

- keep the most recent `4` turns raw
- summarize everything before those retained turns
- if there are not enough messages to leave a useful retained window and still summarize older content, skip compaction

Practical first-version rule:

- if total eligible messages are too few to meaningfully compact, skip
- if no messages exist before the retained recent window, skip

### 4. Respect Prior Compaction

If `compacted_through_message_id` already exists:

- find that message in the ordered list
- only compact messages after that boundary and before the retained recent window
- merge newly compacted content into the existing summary

This makes compaction incremental.

### 5. Build the Transcript to Summarize

Convert only the newly compactable messages into transcript text:

```text
User: ...
Assistant: ...
User: ...
Assistant: ...
```

If an existing summary already exists, it must be provided to the compactor model as prior summarized transcript.

### 6. Generate the New Summary

Use a dedicated compaction prompt, not the main Study Buddy teaching prompt.

The compactor must:

- preserve turn order
- preserve user intent
- preserve what the assistant explained
- preserve formulas, definitions, examples, corrections, and unresolved follow-ups
- merge old summary plus newly compacted raw turns into one coherent summarized transcript

### 7. Save the Result

Update `chat_sessions` with:

- `summary = <new summarized transcript>`
- `is_compacted = true`
- `compacted_through_message_id = <last message id included in the new summary>`

No `chat_messages` rows are deleted.

### 8. Leave Recent Raw Messages Untouched

The retained recent messages remain in `chat_messages` and continue to be used for agent context until a later compaction run moves the boundary forward.

## Exact Summary Prompt

## System Prompt

```text
You are compacting a study chat session for future reuse.

Your job is to rewrite the conversation into a shorter transcript that preserves the original back-and-forth structure.

Rules:
- Keep the output in chat format only.
- Alternate turns as:
  User: ...
  Assistant: ...
- Summarize each turn faithfully.
- Preserve important academic content:
  - definitions
  - formulas
  - assumptions
  - examples
  - corrections
  - unresolved questions
  - study goals or preferences from the user
- Preserve course-specific context when present.
- Do not invent turns that did not happen.
- Do not add commentary outside the transcript.
- Compress aggressively, but keep enough detail so a future assistant can continue the conversation naturally.
- If an earlier summary exists, merge it with the new messages into one coherent summarized transcript.
- Summarize only the provided older messages.
- Do not reference later turns that are not included.
```

## User Prompt Template

```text
Existing summarized transcript:
{{existingSummary || "None"}}

Messages to compact:
{{formattedTranscript}}

Return the new compacted transcript only.
```

## Expected Output Shape

```text
User: Asked for a simple explanation of Bernoulli’s principle and wanted a relatable analogy.
Assistant: Explained Bernoulli’s principle as energy balance in fluid flow, used a water-pipe analogy, and highlighted the pressure-speed tradeoff.

User: Asked how friction changes the ideal equation and whether Darcy-Weisbach is involved.
Assistant: Clarified that Bernoulli is idealized, introduced head loss and Darcy-Weisbach, and explained where the loss term fits conceptually.
```

## Retrieval Logic Change in `app/api/chat/route.ts`

The chat route must support two different retrieval paths:

## 1. UI History Retrieval

Purpose:

- display the full conversation to the user

Behavior:

- fetch all `chat_messages` for the session in chronological order
- do not hide compacted messages
- do not filter by compaction boundary

This is for rendering only.

## 2. Agent Context Retrieval

Purpose:

- build the smaller message list passed into `StudyBuddyAgent`

Behavior:

1. fetch the `chat_sessions` row
2. read:
   - `summary`
   - `compacted_through_message_id`
3. fetch prior `chat_messages` in chronological order
4. if there is no compaction boundary:
   - use the normal prior `user` and `assistant` messages as agent history
5. if there is a compaction boundary:
   - ignore all messages at or before `compacted_through_message_id`
   - use only later messages as raw agent history
6. pass `summary` separately into `StudyBuddyAgent`
7. save the current user message first, but do not duplicate it into the history array before calling the agent

## Important Separation

`chat_messages` fetched for display:

- full session history

`StudyBuddyChatHistoryMessage[]` passed to the agent:

- only post-compaction raw messages

`chat_sessions.summary` passed to the agent:

- compacted prior transcript memory

## Agent Contract Change

`StudyBuddyAgent` already supports:

- `history`
- `sessionSummary`

That behavior must remain:

- `history` contains only non-compacted recent raw messages
- `sessionSummary` contains the summarized prior transcript

## Compaction Trigger Behavior

The utility should be callable from:

- the main chat route when the threshold is crossed
- future maintenance tasks
- future background jobs

First version recommendation:

- do not run compaction before every request
- call it only when session token usage crosses the configured threshold

## Total Token Semantics

After compaction, `total_tokens` should represent active context pressure, not total historical storage volume.

For the first version, acceptable approaches are:

### Option A

Recompute `total_tokens` using:

- summary token estimate
- retained recent raw message token totals

### Option B

Leave current `total_tokens` behavior as-is initially, then refine after compaction is wired in.

Recommended approach:

- use Option A when implementing compaction, because it matches actual future prompt size more closely

## Edge Cases

`triggerCompaction` should skip safely when:

- the session does not exist
- there are too few messages to compact
- there is no new message window before the retained recent turns
- the session is already compacted up to the latest possible boundary

It must never:

- delete messages
- overwrite summary with empty output
- move the boundary past retained recent messages

## Implementation Order

1. Add `compacted_through_message_id` to `chat_sessions`
2. Implement `lib/studyagent/chatCompaction.ts`
3. Update `app/api/chat/route.ts` so agent history respects the compaction boundary
4. Add threshold-based invocation from the chat route
5. Later add optional background compaction for stale sessions

## First-Version Constants

Use these fixed values for the first implementation:

- retained raw turns: `4`
- compaction output format: transcript only
- storage model: keep all `chat_messages`
- compaction boundary: `compacted_through_message_id`

These can be extracted into config later if needed.
