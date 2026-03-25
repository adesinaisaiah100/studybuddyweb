# Phase 06 - API Integration

Goal: expose orchestrator through API contract for UI consumption.

## Scope
- Add API route handler for study buddy chat.
- Validate request payload and normalize errors.
- Return `StudyBuddyOrchestratorOutput` shape.

## Deliverables
- [ ] `app/api/study-buddy/chat/route.ts`
- [ ] orchestrator invocation wiring
- [ ] request validation and safe error responses

## Validation
- [ ] Typecheck passes.
- [ ] Route returns expected output schema.
- [ ] Empty-retrieval and tool-failure behavior verified.

## Notes
- Keep transport concerns in API route; keep agent logic in orchestrator module.
