# Stimulation Resolve API And Tool Contract

This document defines the single orchestration API and single main-agent tool for stimulation resolution.

## API Route

- Route: `POST /api/stimulation/resolve`
- Auth: Required (server-side Supabase user context)
- Behavior: Lookup first; if lookup misses, generate via stimulation subagent.

### Request JSON

```json
{
  "contextSnippet": "Simulate viscosity effects on pressure drop in a pipe",
  "targetVariables": ["viscosity", "flow rate", "pipe diameter"],
  "conceptName": "fluid dynamics"
}
```

Rules:
- `contextSnippet` is required.
- `targetVariables` is required and must be non-empty.
- `conceptName` is optional.

### Success Response JSON

```json
{
  "success": true,
  "source": "lookup",
  "generatedCode": "import React ..."
}
```

or

```json
{
  "success": true,
  "source": "generated",
  "generatedCode": "import React ..."
}
```

### Error Response JSON

```json
{
  "success": false,
  "source": null,
  "generatedCode": null,
  "error": "error message"
}
```

## Main Agent Tool

- Tool name: `resolve_stimulation_module`
- Registered in: `lib/studyagent/agent.ts`

### Tool Parameters

```json
{
  "contextSnippet": "...",
  "targetVariables": ["...", "..."],
  "conceptName": "..."
}
```

### Tool Behavior

- Calls internal API via `resolveStimulationViaApi(...)`.
- Returns only success/status signaling to the main agent.
- Does not expose raw generated code in tool output content.

## Source Files

- `app/api/stimulation/resolve/route.ts`
- `lib/studyagent/stimulationResolveApiTool.ts`
- `lib/studyagent/agent.ts`
