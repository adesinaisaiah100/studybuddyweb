# Phase 05 - Understanding + Telemetry

Goal: update mastery and add observability for quality tuning.

## Scope
- Build `update_node` to produce `UnderstandingState`.
- Add request-level telemetry for retrieval/planning/tools/critique.
- Track loop and score metrics for dashboarding.

## Deliverables
- [ ] understanding update helper
- [ ] telemetry instrumentation hooks
- [ ] error counters and latency logging

## Validation
- [ ] Typecheck passes.
- [ ] Output includes `understandingUpdate` when available.
- [ ] Core metrics are logged for each request.

## Notes
- Keep telemetry payload structured and low-noise.
