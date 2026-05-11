# Implementation Recipes (Different Cases)

Use these patterns as templates for real agent features.

## 1) Basic chat agent (no tools)

```ts
import { Agent } from "@earendil-works/pi-agent-core";
import { getModel } from "@earendil-works/pi-ai";

const agent = new Agent({
  initialState: {
    systemPrompt: "You are a coding mentor.",
    model: getModel("anthropic", "claude-sonnet-4-20250514"),
  },
});

await agent.prompt("Explain async/await with a short example.");
```

## 2) Tool-calling code assistant

```ts
import { Type } from "@earendil-works/pi-ai";

const readFileTool = {
  name: "read_file",
  label: "Read File",
  description: "Read UTF-8 file contents",
  parameters: Type.Object({ path: Type.String() }),
  execute: async (_id: string, params: { path: string }) => {
    const content = await fs.promises.readFile(params.path, "utf8");
    return { content: [{ type: "text", text: content }], details: { path: params.path } };
  },
};

agent.state.tools = [readFileTool];
await agent.prompt("Open tsconfig.json and summarize compiler options.");
```

## 3) Policy-restricted execution

```ts
const agent = new Agent({
  initialState: { model, systemPrompt: "Follow org security policy strictly." },
  beforeToolCall: async ({ toolCall, args }) => {
    if (toolCall.name === "write_file" && String((args as any).path).includes(".env")) {
      return { block: true, reason: "Writing secrets/config files is blocked." };
    }
  },
});
```

## 4) Parallel-safe tools + progress UI

```ts
agent.subscribe((event) => {
  if (event.type === "tool_execution_update") {
    console.log(`[${event.toolName}]`, event.partialResult);
  }
});

agent.toolExecution = "parallel";
```

## 5) Retry/continue after transient failure

```ts
try {
  await agent.prompt("Refactor the module and run checks.");
} catch {
  // when run interrupted, continue from current transcript state
  await agent.continue();
}
```

## 6) Model switch in same conversation

```ts
agent.state.model = getModel("openai", "gpt-5-mini");
await agent.prompt("Now verify the plan with stronger reasoning.");
```

## 7) Browser-safe architecture

- Keep `Agent` and provider API keys on server.
- Stream events to browser via SSE/WebSocket.
- Browser renders deltas (`message_update`) and tool progress.

## 8) Deterministic tests with faux provider

Use `registerFauxProvider()` from `pi-ai` to script deterministic assistant/tool sequences for CI tests.

## 9) Persist chat messages to Supabase

```ts
import { createClient } from "@supabase/supabase-js";
import { Agent } from "@earendil-works/pi-agent-core";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

agent.subscribe(async (event) => {
  if (event.type === "message_end") {
    const msg = event.message as any;
    await supabase.from("agent_messages").insert({
      session_id: currentSessionId,
      role: msg.role,
      content: msg.content,
      created_at: new Date(msg.timestamp ?? Date.now()).toISOString(),
      model: msg.model ?? null,
      provider: msg.provider ?? null,
      stop_reason: msg.stopReason ?? null,
      is_error: msg.role === "toolResult" ? Boolean(msg.isError) : false,
    });
  }
});
```

## 10) Stream to UI with SSE (Next.js route handler style)

```ts
// app/api/agent/stream/route.ts
export async function POST(req: Request) {
  const { prompt } = await req.json();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(`event: ${event}\n`);
        controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
      };

      const unsubscribe = agent.subscribe((evt) => {
        if (evt.type === "message_update" && evt.assistantMessageEvent.type === "text_delta") {
          send("text_delta", { delta: evt.assistantMessageEvent.delta });
        } else if (evt.type === "tool_execution_update") {
          send("tool_progress", evt);
        } else if (evt.type === "message_end") {
          send("message_end", evt.message);
        }
      });

      try {
        await agent.prompt(prompt);
        send("done", { ok: true });
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : String(err) });
      } finally {
        unsubscribe();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

