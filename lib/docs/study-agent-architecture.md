# StudyBuddy Agent — Architecture Overview

This document summarizes the current StudyBuddy agent code organization, the RAG (retrieval-augmented generation) architecture, and the tools/subagents implemented in the repository.

## High-level components

- **Main agent**: `lib/studyagent/agent.ts` — coordinates tools and subagents, orchestrates queries, and implements the study agent's decision logic.
- **Tool & subagent directory**: `lib/studyagent/` — contains specialized tool modules used by the agent:
  - `ragSearchTool.ts` — RAG search utilities and query orchestration.
  - `stimulationSubAgent.ts` — stimulation subagent orchestration (purpose: run or lookup simulations).
  - `stimulationlookupTool.ts` — lookup helper that queries Supabase RPC for saved simulations.
  - `stimulationpersitencetool.ts` — persistence helpers for saving simulations (name indicates storage responsibilities).
  - `resolveCourseId.ts`, `ragSearchTool.ts`, and other helpers for connecting domain logic to the agent.

## Data & embeddings

- Supabase is used as primary backend for data and persistence. Key files:
  - Supabase clients: [lib/supabase/client.ts](lib/supabase/client.ts) and [lib/supabase/server.ts](lib/supabase/server.ts)
  - Database migrations (embeddings / functions): `supabase/migrations/` (for example: `20260320_course_embeddings_rls.sql`, `20260424_match_course_embeddings_function.sql`).

## RAG flow (how it appears implemented)

- Documents and course material are indexed (embeddings) and stored in Supabase (or similar) via ingestion code under `lib/ai/` and ingestion helpers.
- `ragSearchTool.ts` is responsible for constructing retrieval queries, calling the vector-match SQL / RPC functions, and returning relevant contexts to the agent.
- The main agent composes prompts by combining retrieved context (from RAG) with generation calls (OpenAI) and higher-level orchestration in `lib/studyagent/agent.ts`.

## Where agent interacts with app routes

- Server/API routes that may trigger agent flows live under `app/api/` (for example: `process-document/route.ts`, `process-jobs/enqueue/route.ts`, `search/route.ts`). These are entrypoints for ingestion and job orchestration.

## Notable supporting code

- Domain extraction and ingestion: `lib/ai/*` (e.g., `extract-courses.ts`, `process-material.ts`, `extract-document-text.ts`).
- Hooks & UI helpers: `lib/hooks/*` and `app/components/*` for front-end integration (dashboard, onboarding, uploads).

## What's implemented vs. likely TODOs

- Implemented: Supabase-backed storage & RPC functions for vector matching; RAG search helper; a stimulation subagent and lookup tool interface (`stimulationlookupTool.ts` exists and exposes `findMatchingSimulationByTargetVariables`).
- Likely TODOs: formal tool registration for the agent (if not already centralized in `agent.ts`), explicit API wrappers for subagents, and thorough unit tests for subagent integration.

## Key files (quick links)

- Main agent: [lib/studyagent/agent.ts](lib/studyagent/agent.ts)
- RAG search: [lib/studyagent/ragSearchTool.ts](lib/studyagent/ragSearchTool.ts)
- Stimulation lookup: [lib/studyagent/stimulationlookupTool.ts](lib/studyagent/stimulationlookupTool.ts)
- Stimulation orchestration: [lib/studyagent/stimulationSubAgent.ts](lib/studyagent/stimulationSubAgent.ts)
- Supabase client/server: [lib/supabase/client.ts](lib/supabase/client.ts) | [lib/supabase/server.ts](lib/supabase/server.ts)
- API routes: [app/api/](app/api/)

---
_If you want, I can expand any section with diagrams, call flows, or code excerpts._
