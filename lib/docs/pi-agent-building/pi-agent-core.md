# pi-agent-core Reference for Agent Runtime Design

`@earendil-works/pi-agent-core` is the stateful runtime that wraps `pi-ai` into a controllable agent loop.

## What it gives you

- Stateful `Agent` class
- Turn-based loop with message/tool lifecycle events
- Built-in tool execution orchestration
- `parallel` or `sequential` tool batches
- Queue controls (`steer`, `followUp`)
- Lifecycle hooks (`beforeToolCall`, `afterToolCall`)
- Low-level loop APIs for custom orchestration

## Quick start

```ts
import { Agent } from "@earendil-works/pi-agent-core";
import { getModel } from "@earendil-works/pi-ai";

const agent = new Agent({
  initialState: {
    systemPrompt: "You are a helpful engineering assistant.",
    model: getModel("openai", "gpt-4o-mini"),
  },
  toolExecution: "parallel",
});

agent.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

await agent.prompt("Plan an API refactor.");
```

## Tool orchestration model

- Tool args are validated before execution.
- `beforeToolCall` can block execution.
- Tool `execute` can stream updates.
- `afterToolCall` can post-process output or request termination.
- In `parallel` mode, execution completion order can differ from source order; persisted tool results remain in assistant source order.

## Hook examples

```ts
const agent = new Agent({
  // ...
  beforeToolCall: async ({ toolCall }) => {
    if (toolCall.name === "bash") return { block: true, reason: "Shell disabled in this environment" };
  },
  afterToolCall: async ({ toolCall, result, isError }) => {
    if (!isError && toolCall.name === "notify_done") return { terminate: true };
    return { details: { ...result.details, audited: true } };
  },
});
```

## Steering and follow-up control

```ts
agent.steer({
  role: "user",
  content: "Stop current approach and summarize blockers first.",
  timestamp: Date.now(),
});

agent.followUp({
  role: "user",
  content: "Now produce a final action list.",
  timestamp: Date.now(),
});
```

## Custom message types

Use declaration merging + `convertToLlm` to carry app-specific messages while only passing valid LLM messages to providers.

```ts
import type { Message } from "@earendil-works/pi-ai";
import { Agent } from "@earendil-works/pi-agent-core";

declare module "@earendil-works/pi-agent-core" {
  interface CustomAgentMessages {
    notification: { role: "notification"; text: string; timestamp: number };
  }
}

const agent = new Agent({
  convertToLlm: (messages): Message[] =>
    messages.flatMap((m) => (m.role === "notification" ? [] : [m])),
});
```

## Low-level loop (advanced)

For custom runtimes, use `agentLoop` / `agentLoopContinue` directly and handle emitted events yourself.

