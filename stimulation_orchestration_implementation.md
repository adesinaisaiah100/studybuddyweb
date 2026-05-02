# Stimulation Orchestration Implementation Status

## What has been implemented

### 1. Supabase RPC-based simulation lookup helper
File: [lib/studyagent/stimulationlookupTool.ts](lib/studyagent/stimulationlookupTool.ts)

Implemented a lookup helper that checks for an existing saved simulation before generating a new one.

Current behavior:
- Creates a Supabase server client using the existing server helper pattern.
- Gets the current authenticated user.
- Normalizes the incoming target variables.
- Calls the migrated Supabase RPC:
  - `find_simulation_by_target_signature`
- Passes:
  - `p_user_id`
  - `p_concept_name`
  - `p_target_variables`
- Returns a matching saved simulation row when one exists.
- Returns `null` when no match is found or when the input target variables are empty.

### 2. RPC-first matching strategy
The lookup no longer scans the `simulations` table row-by-row in application code.

Instead, matching is delegated to the database through the RPC, which is better for larger datasets and keeps the lookup logic centralized in SQL.

## What this means in practice

The intended flow is now:

1. The caller provides the target variables that will be sent to the stimulation generator.
2. The lookup helper checks whether a matching saved simulation already exists.
3. If a match is found, the saved `generated_code` can be reused.
4. If no match is found, the normal stimulation generation flow continues.

## Files involved so far

- [lib/studyagent/stimulationlookupTool.ts](lib/studyagent/stimulationlookupTool.ts)
- [lib/studyagent/stimulationSubAgent.ts](lib/studyagent/stimulationSubAgent.ts)
- Supabase migration already applied for `find_simulation_by_target_signature`

## Remaining work

### 1. Insert the early-return lookup into the stimulation subagent
The next step is to call the lookup helper at the start of `stimulationGenerationSubAgent(...)` and return cached code immediately when a match is found.

### 2. Optional: wire orchestration into the StudyBuddy agent call site
If you want the lookup to happen even earlier, the caller that decides to launch the stimulation subagent can check the cache first and skip the subagent entirely when a match exists.

## Notes

- The lookup helper currently follows the server-side RPC path already migrated in Supabase.
- The helper is ready for integration, but the early-return hook inside `stimulationSubAgent.ts` is still pending.
