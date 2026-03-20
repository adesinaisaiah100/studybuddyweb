# Document Ingestion & Embedding Pipeline

This document shows both:
- the **current implementation** (async queue with client-triggered polling), and
- the **target production architecture** (server-side worker).

## 1) Current Implementation (Async Queue + Client Trigger)

```mermaid
flowchart TD
    A[Course Dashboard Upload] --> B[User Selects File + Material Type]

    subgraph Client Browser Workload
    B -->|Parse locally via Web Worker| C{Is it Scanned?}
    C -->|No: PDF.js / Mammoth| D[Extract Digital Text]
    C -->|Yes: Tesseract.js| E[Run WebAssembly OCR locally]
    D --> F[Raw Text Extracted]
    E --> F
    end

    B --> G{material_type}
    G -->|primary_slide| H[Upload Original File]
    G -->|other types| I[Convert Raw Text to .txt Blob]

    H --> J[Supabase Storage: course-materials]
    I --> J
    J --> K[Save metadata in course_materials]

    F -->|POST /api/process-jobs/enqueue| L[processing_jobs row: queued]

    subgraph Client-Driven Processing Loop
    M[Dashboard polls /api/process-jobs/status] --> N{Pending jobs?}
    N -->|Yes| O[POST /api/process-jobs/run-next]
    O --> P[Worker logic in route handler]
    P --> Q[Split text + Embeddings + Insert course_embeddings]
    Q --> R[Update job status: extracting/vectorizing/completed]
    R --> M
    end

    R --> S[Material badge: Queued / Extracting / Vectorizing / Ready / Failed]
```

### Summary (Current)
- Upload returns quickly after file save + enqueue.
- Users can leave the page and return; status is persisted in `processing_jobs`.
- Dashboard polling provides coarse milestones and ETA range.
- Current limitation: processing is still kicked by client traffic (`run-next` calls).

## 2) Target Production Architecture (Server-Side Worker)

```mermaid
flowchart TD
    A[Course Dashboard Upload] --> B[Client extracts raw text]
    B --> C[Upload file to Storage + save course_materials]
    C --> D[POST /api/process-jobs/enqueue]
    D --> E[(processing_jobs: queued)]

    subgraph Server Worker Plane
    F[Cron / Queue Trigger] --> G[Worker fetches oldest queued job]
    G --> H[Mark extracting + started_at]
    H --> I[Optional cache lookup by content_hash]
    I -->|hit| J[Clone prior embeddings]
    I -->|miss| K[Split text + Embeddings API]
    K --> L[Insert course_embeddings]
    J --> M[Mark completed + completed_at]
    L --> M
    M --> N[Clear raw_text or keep TTL-limited copy]
    end

    E --> F
    O[Dashboard polling /api/process-jobs/status] --> P[Render status badges + retries]
    M --> O
```

### Summary (Server-Side Worker)
- Client is fully decoupled from long-running embedding work.
- Processing continues even if user closes browser.
- Better reliability, throughput, and cost control (concurrency + retry policy).
- Recommended for production with large files and many concurrent users.

## 3) Migration Plan (Current → Server Worker)

1. **Prepare worker path (no cutover yet)**
    - Deploy server-side worker trigger (cron/queue) that calls the same processing logic.
    - Keep current client-triggered `run-next` flow active.

2. **Add idempotency guardrails**
    - Enforce single active job per `material_id`.
    - Keep `content_hash` reuse enabled to avoid duplicate embedding cost.

3. **Shadow run in low traffic window**
    - Let server worker process new `queued` jobs while client fallback still exists.
    - Compare success rate, average completion time, and failure reasons for 24–48 hours.

4. **Soft cutover**
    - Stop client from calling `run-next` automatically.
    - Keep dashboard polling/status unchanged (UI stays stable for users).

5. **Stabilization + rollback window**
    - Monitor queue depth, retries, and failed jobs.
    - If error rate spikes, re-enable client trigger temporarily as fallback.

6. **Finalize**
    - Remove client-triggered worker loop.
    - Keep enqueue + status endpoints and server worker as the only processing path.
