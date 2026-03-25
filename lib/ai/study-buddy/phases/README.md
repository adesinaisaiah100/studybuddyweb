# Study Buddy Implementation Phases

This folder tracks the step-by-step implementation plan for the Study Buddy orchestration system.

How to use this folder:
- Work through phases in order.
- Edit each phase file as implementation evolves.
- Mark checklist items as complete when shipped.
- Keep decisions and tradeoffs in the Notes section of each phase.

## Phase Index

1. `phase-01-foundation.md` - runtime foundation, state schema, graph skeleton
2. `phase-02-intent-planning.md` - intent analysis and planning policy
3. `phase-03-tool-execution.md` - allowlisted tool execution, budgets, normalization
4. `phase-04-draft-critique-loop.md` - drafting, critique scoring, repair loops, fallback
5. `phase-05-understanding-telemetry.md` - mastery updates and observability
6. `phase-06-api-integration.md` - API route wiring and UI contract delivery

## Working Rules

- Keep contracts aligned with `lib/ai/study-buddy/types.ts`.
- Prefer strict schemas for planner and critique outputs.
- Preserve safe behavior when retrieval is empty or tools fail.
- Keep implementation incremental and test after each phase.
