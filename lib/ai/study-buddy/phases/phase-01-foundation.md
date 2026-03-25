# Phase 01 - Foundation

Goal: establish orchestrator scaffolding and runtime state model.

## Scope
- Create orchestrator module structure.
- Define LangGraph state annotations.
- Set loop limits and pass-threshold constants.
- Add shared helpers for model client creation.

## Deliverables
- [x] `lib/ai/study-buddy/orchestrator/state.ts`
- [x] `lib/ai/study-buddy/orchestrator/constants.ts`
- [x] `lib/ai/study-buddy/orchestrator/llm.ts`
- [x] `lib/ai/study-buddy/orchestrator/index.ts` (skeleton only)

## Validation
- [x] Typecheck passes (`npx tsc --noEmit`).
- [x] No API route changes in this phase.

## Notes
- Keep this phase minimal: structure first, behavior later.
