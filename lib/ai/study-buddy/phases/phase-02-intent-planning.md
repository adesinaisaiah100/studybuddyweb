# Phase 02 - Intent + Planning

Goal: implement intent analysis and deterministic tool planning with hybrid algorithmic/LLM approach.

## Implementation Summary

### Hybrid Intent Detection (Algorithmic First, LLM Fallback)

The `intent-detector.ts` module implements a two-stage detection system:

#### Stage 1: Algorithmic Keyword Matching (Fast)
- Tokenizes user input and checks for intent-specific keywords
- **Learn Intent**: "why", "what", "explain", "describe", "how does", "understand"
- **Solve Intent**: "solve", "calculate", "compute", "find", "work out"
- **Quiz Intent**: "quiz", "test", "practice", "challenge", "check my knowledge"
- **Revise Intent**: "revise", "review", "recap", "summarize", "refresh"
- **Explore Intent**: "explore", "show", "demonstrate", "example", "imagine"

Multi-word keyword detection for phrases like "how does", "work out", "figure out"

**Confidence Score**: 0.80 for single-word matches, 0.85 for multi-word phrases

#### Stage 2: LLM Fallback (When No Keywords Match)
- Triggered if algorithmic detection finds no matching keywords
- Uses OpenRouter LLM with structured JSON output
- LLM confidence capped at 0.75 to prevent overconfidence
- Returns: intent, topic, difficulty level

### Tool Planning with Confidence Policy

The `planner.ts` module generates execution plans based on confidence levels:

#### Confidence Policy
- **≥ 0.75 (High)**: Execute full tool plan
- **0.45 to < 0.75 (Medium)**: Execute minimal subset (retriever + primary tool)
- **< 0.45 (Low)**: Conservative answer path (retriever only)

#### Intent-Specific Tool Chains

| Intent | Primary Tool | Secondary Tools | Strategy |
|--------|-------------|-----------------|----------|
| learn | explainer | example-generator (if medium+ confidence) | explain-simple |
| solve | problem-solver | validator | step-by-step |
| quiz | quiz-generator | - | assessment |
| revise | summarizer | quiz-generator | step-by-step |
| explore | example-generator | visualization (if medium+ confidence) | visual |
| unclear | clarifier | - | mixed |

### Graph Nodes

1. **init**: Initialize iteration counter and max loops
2. **intent**: Detect user intent using hybrid algorithmic/LLM approach
3. **planner**: Generate `ToolPlan` with confidence-based tool selection

### Execution Flow

```
START → init → intent → planner → END
```

## Code Files

- `orchestrator/intent-detector.ts`: Hybrid intent detection logic
- `orchestrator/planner.ts`: Tool plan generation and LLM enhancement
- `orchestrator/index.ts`: Graph definition with intent and planner nodes

## Features Implemented

- [x] `intent_node` with hybrid algorithmic/LLM detection
- [x] `planner_node` with confidence-based tool selection
- [x] Confidence policy enforcement (0.75, 0.45 thresholds)
- [x] Intent-specific tool recommendations with priority
- [x] LLM plan enhancement for medium-confidence cases
- [x] Multi-word keyword detection
- [x] Topic extraction from query
- [x] TypeScript strict mode compliance

## Validation

- [x] TypeScript compilation passes
- [x] High-confidence algorithmic path (no LLM call)
- [x] Medium-confidence LLM enhancement path
- [x] Low-confidence conservative fallback
- [x] Tool recommendations include reason + priority metadata

## Next Steps (Phase 03)

- Tool execution against course materials and retrieval
- Handling tool result aggregation
- Integration with retrieval system (vector + keyword search)

