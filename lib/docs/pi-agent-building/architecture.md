# Architecture: Building an Agent with pi-ai + pi-agent-core

## System design at a glance

```text
User/App UI
   ↓
Your App Service (state, auth, business logic)
   ↓
Agent Runtime (@earendil-works/pi-agent-core)
   ↓
LLM API Layer (@earendil-works/pi-ai)
   ↓
Provider APIs (OpenAI / Anthropic / Google / etc.)
```

## Responsibilities by layer

### `pi-ai` (LLM and provider layer)

- Model/provider registry (`getModel`, `getModels`, `getProviders`)
- Normalized message/content primitives across providers
- Streaming event protocol (`text_delta`, `toolcall_delta`, etc.)
- Tool schema handling and argument validation
- Cost/token metadata normalization
- Cross-provider context compatibility

### `pi-agent-core` (agent runtime layer)

- Conversation state + lifecycle (`Agent.state`)
- Multi-turn loop (`agentLoop`, `Agent.prompt`, `Agent.continue`)
- Tool orchestration with execution policy (`parallel` or `sequential`)
- Runtime hooks (`beforeToolCall`, `afterToolCall`)
- Event stream for UI (`message_update`, `tool_execution_*`, etc.)
- Steering and follow-up queues for live control

### Your app (product layer)

- Domain-specific tools and policies
- User/session auth, persistence, and audit trails
- UI rendering and interaction model
- Guardrails and business logic

## Recommended project layout

```text
src/
  agent/
    runtime.ts         # Agent construction and config
    tools/             # Tool definitions + execute handlers
    prompts/           # System prompt templates
    policies/          # beforeToolCall / afterToolCall policies
    adapters/          # convertToLlm / transformContext
  api/
    chat.ts            # Endpoint(s) that call agent.prompt/continue
  ui/
    chat-stream.tsx    # Event-based rendering
```

## Data flow pattern

1. App receives user input.
2. `Agent.prompt()` appends user message and starts run.
3. `pi-ai` streams assistant deltas/events.
4. `pi-agent-core` emits lifecycle events and executes tools.
5. Tool results are added as `toolResult` messages.
6. Loop continues until stop condition.
7. App persists transcript + usage/cost metadata.

## Extensibility strategy

- Add tools by declaring `AgentTool` objects with TypeBox schemas.
- Add custom message types via declaration merging and `convertToLlm`.
- Add provider-specific behavior via `model` metadata and options.
- Add execution policy centrally in `beforeToolCall` / `afterToolCall`.
- Switch transport and models per task without changing app protocol.

