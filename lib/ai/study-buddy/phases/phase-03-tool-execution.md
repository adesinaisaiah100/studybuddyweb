# Phase 03 - Tool Execution

Goal: execute allowlisted tools with budgets and normalized outputs.

## Implementation Summary
- Added `tool_exec` node to the graph pipeline: `START -> init -> intent -> planner -> tool_exec -> END`.
- Implemented allowlisted tool registry in `orchestrator/tool-registry.ts`.
- Added budget policy module in `orchestrator/tool-policy.ts`.
- Enforced max calls and timeout budget per execution run.
- Normalized all executions into `ToolResult[]` with `{ tool, success, output, latencyMs }`.
- Added graceful fallback to retrieval-only mode when needed.
- Attached used tools and normalized outputs to `draft` state.

## Scope
- Build `tool_exec` node.
- Implement allowlist for MVP tools.
- Enforce max calls and timeout budget.
- Normalize tool outputs into `ToolResult[]`.

## Deliverables
- [x] tool registry module
- [x] allowlist + budget policy
- [x] `tool_exec` node wired
- [x] graceful failure fallback to retrieval-only mode

## Validation
- [x] Typecheck passes.
- [x] Tool failure does not break final response path.
- [x] Used tool list is attached to draft state.

## Notes
- Never expose internal stack traces to user-facing response.
