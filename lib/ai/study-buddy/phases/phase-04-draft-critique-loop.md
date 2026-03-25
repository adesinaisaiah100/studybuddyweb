# Phase 04 - Draft + Critique Loop

Goal: produce grounded answers with iterative quality repair.

## Scope
- Build `response_node` for grounded answer generation.
- Build `critique_node` with granular scoring:
  - clarity
  - correctness
  - pedagogy
- Add loop transition policy and fallback node.

## Deliverables
- [ ] response prompt v1
- [ ] critique prompt v1
- [ ] critique threshold logic
- [ ] loop limit and fallback behavior

## Validation
- [ ] Typecheck passes.
- [ ] Failing critique re-enters draft with feedback delta.
- [ ] Exhausted loops trigger safe fallback answer.

## Notes
- Avoid blind retries: each retry must incorporate critique feedback.
