# pi-ai Reference for Agent Builders

`@earendil-works/pi-ai` is the normalized LLM interface layer for multi-provider agent systems.

## Core capabilities

- Unified provider/model access
- Tool-calling message protocol
- Streaming and non-streaming APIs
- Reasoning/thinking support across providers
- Token/cost usage metadata
- Context portability across providers
- Image input and image generation APIs
- OAuth + env-based auth handling

## Basic model usage

```ts
import { getModel, complete } from "@earendil-works/pi-ai";

const model = getModel("openai", "gpt-4o-mini");

const response = await complete(model, {
  systemPrompt: "You are a concise coding assistant.",
  messages: [{ role: "user", content: "Explain dependency injection briefly." }],
});
```

## Streaming pattern

```ts
import { getModel, stream } from "@earendil-works/pi-ai";

const model = getModel("anthropic", "claude-sonnet-4-20250514");
const s = stream(model, { messages: [{ role: "user", content: "Draft a plan." }] });

for await (const event of s) {
  if (event.type === "text_delta") process.stdout.write(event.delta);
  if (event.type === "toolcall_delta") {
    // partial tool JSON arrives here
  }
}

const final = await s.result();
```

## Tools with schema validation

```ts
import { Type, complete, validateToolCall } from "@earendil-works/pi-ai";

const tools = [{
  name: "read_file",
  description: "Read file content",
  parameters: Type.Object({
    path: Type.String(),
  }),
}];

const response = await complete(model, {
  messages: [{ role: "user", content: "Read package.json" }],
  tools,
});

for (const block of response.content) {
  if (block.type === "toolCall") {
    const args = validateToolCall(tools, block);
    // execute with validated args
  }
}
```

## Multi-provider handoff

```ts
import { getModel, complete } from "@earendil-works/pi-ai";

const context = { messages: [{ role: "user", content: "Solve 25*18." }] };

const claude = getModel("anthropic", "claude-sonnet-4-20250514");
context.messages.push(await complete(claude, context));

const gpt5 = getModel("openai", "gpt-5-mini");
context.messages.push({ role: "user", content: "Double-check the solution." });
context.messages.push(await complete(gpt5, context));
```

## Auth patterns

- **Node apps:** use environment variables (e.g. `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`).
- **Browser apps:** pass `apiKey` explicitly to calls (prefer backend proxy in production).
- **OAuth providers:** use `@earendil-works/pi-ai/oauth` for login and token refresh.

## When to use which API

- Use `stream` / `complete` for full event and control surface.
- Use `streamSimple` / `completeSimple` for simplified reasoning options.
- Use `generateImages` + `getImageModel` for image generation (not `complete`).

