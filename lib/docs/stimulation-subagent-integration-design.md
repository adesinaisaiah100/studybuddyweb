# Stimulation Subagent — Integration Design

This document outlines options to connect the stimulation subagent (and related lookup/persistence tools) into the main StudyBuddy agent. No implementation is included — this file compares approaches and gives a recommended path and next steps.

## Existing relevant code

- Lookup helper: [lib/studyagent/stimulationlookupTool.ts](lib/studyagent/stimulationlookupTool.ts) — exposes `findMatchingSimulationByTargetVariables(...)` which calls a Supabase RPC.
- Subagent orchestrator: [lib/studyagent/stimulationSubAgent.ts](lib/studyagent/stimulationSubAgent.ts) — orchestrates simulation logic (review this file for current API).
- Persistence helpers: `stimulationpersitencetool.ts` (same folder) — saving simulations and related utilities.

## Integration goals

- Allow the main agent to invoke stimulation functionality as a tool.
- Keep security and auth correct for user-specific lookups (Supabase auth currently used in `stimulationlookupTool.ts`).
- Keep latency reasonable for interactive flows.
- Maintain testability and ability to run subagent in isolation if needed.

## Option A — Direct import (same-process tool)

Description
- Import stimulation helpers/subagent directly inside `lib/studyagent/agent.ts` (or agent's tool registry) and call functions synchronously/awaited.

Pros
- Lowest latency (no HTTP or RPC overhead).
- Simpler to implement and test when dev server and agent share runtime.
- Easier to share types and function signatures.

Cons
- Tightly couples subagent to the agent's runtime and dependencies.
- If simulation code needs sandboxing or heavy compute, may impact agent process.

When to use
- Agent and subagent run on same Node process (e.g., serverless function or a single backend service), and there are no isolation/sandbox concerns.

Implementation notes (no code)
- Add a thin wrapper in the agent's tool registry that calls `findMatchingSimulationByTargetVariables(...)` and normalizes the returned shape.
- Ensure server-side Supabase client (`lib/supabase/server.ts`) is used so secrets are not leaked to the browser.

## Option B — Internal API endpoint (HTTP RPC)

Description
- Expose stimulation functionality via one internal orchestration API route (e.g., `app/api/stimulation/resolve/route.ts`). The route handles lookup-first and generate-on-miss. The agent calls the route via internal HTTP (or via fetch) with server-to-server auth.

Pros
- Good isolation between agent and subagent implementation.
- Easier to enforce auth, rate limits, and quotas at the endpoint.
- Enables running subagent on a different service or scaling independently.

Cons
- Adds network overhead and more moving parts (endpoints, auth tokens).
- Slightly more complex to test in local dev (but still straightforward).

When to use
- If you expect the stimulation subagent to be resource-heavy, or you want to run it in a separate service/process, or if you need explicit HTTP-layer auth.

Implementation notes (no code)
- Create a protected orchestration API route that validates the user session (use Supabase session), performs lookup, and if no match exists, triggers generation.
- Agent calls this single route with internal server auth (no browser-exposed secrets) and only consumes success/status output.

## Option C — Message queue / job-based invocation

Description
- Agent enqueues a job (e.g., via `process-jobs/enqueue`) and an async worker processes the stimulation request and returns results via a callback or DB row.

Pros
- Good for long-running simulation runs and retries.
- Decouples runtime for heavy compute.

Cons
- Higher latency and added complexity.
- Not ideal for synchronous interactive flows where the agent expects an immediate response.

When to use
- Simulations are computationally heavy or must be persisted and processed offline.

## Recommendations

- Default (recommended): Start with **Option A — Direct import** if the agent and stimulation code run in the same server runtime. It's simplest and fastest to validate behavior.
- If isolation, independent scaling, or stricter auth boundaries are required, implement **Option B — Internal API endpoint**.
- Use **Option C** only for long-running or batch simulations.

## Suggested non-code next steps (implementation plan)

1. Audit `lib/studyagent/stimulationSubAgent.ts` and `stimulationlookupTool.ts` to confirm public function signatures and side effects.
2. Create a thin agent-tool adapter (no change yet) that documents the wrapper signature and expected response shape.
3. Decide between Option A or B based on deployment (single Node process vs microservice). I can help implement either.
4. Add tests that simulate Supabase responses (mock RPC) and verify agent behavior.
5. Add minimal telemetry/logging and error handling patterns (timeouts, retries).

---
If you'd like, I can now implement Option A (direct import wrapper) or prepare the internal API route for Option B — tell me which you prefer and I will implement with tests.
