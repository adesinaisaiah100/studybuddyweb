# Pi Agent Builder Docs

This folder documents how to build robust agents using:

- `@earendil-works/pi-ai` (`packages/ai`)
- `@earendil-works/pi-agent-core` (`packages/agent`)

It is focused on production-style usage: architecture, extensibility, event flow, tool execution, model/provider strategy, and concrete implementation snippets.

## What this stack provides

- Unified multi-provider LLM access with tool-calling support
- Streaming + non-streaming APIs
- Reasoning/thinking controls
- Cross-provider handoffs in the same conversation
- Structured tool schemas + tool-argument validation
- Stateful agent runtime with hooks, steering, follow-up queues, and lifecycle events
- Parallel or sequential tool execution modes
- Browser/proxy friendly patterns

## Start here

1. **Read `architecture.md`** for the overall design and layering.
2. **Read `pi-ai.md`** to understand model/provider integration and message/tool primitives.
3. **Read `pi-agent-core.md`** to implement the runtime loop and tool orchestration.
4. **Use `recipes.md`** for ready-to-copy patterns by use case.
5. **Read `supabase-ui-streaming.md`** for database persistence and real-time UI streaming patterns.

## Minimal install

```bash
npm install @earendil-works/pi-ai @earendil-works/pi-agent-core
```

