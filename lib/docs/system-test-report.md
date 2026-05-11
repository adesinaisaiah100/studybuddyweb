# System Test Button — Report

## Files changed
- app/dashboard/page.tsx — added "Run System Test" button, request logic, Streamdown rendering, and moved state hooks to top-level.
- docs/system-test-report.md — this report.

## What I implemented
- Dashboard now has a single test button (`Run System Test`) that opens `/dashboard/agent-test`.
- This keeps one testing flow and uses the same default prompt already configured on the agent-test page.
- The API `/api/agent-test` (existing) runs the `StudyBuddyAgent` and returns structured content.
- Agent response rendering remains on the dedicated agent-test page using `Streamdown` and its plugins.

## How the test works (end-to-end)
1. User clicks `Run System Test` on the dashboard.
2. User is taken to `/dashboard/agent-test`.
3. Agent-test page loads with the same default prompt value defined in that page.
4. User clicks `Run Study Agent` and the page POSTs `{ prompt, courseId }` to `/api/agent-test`.
5. The server authenticates the user from the session cookie and verifies the course belongs to the user.
6. The server calls `StudyBuddyAgent(prompt, { courseId, cookieHeader })` and returns `{ success, text, message }`.
7. Agent-test page renders the response with `Streamdown`.

## Files/folders created
- `docs/system-test-report.md` — this documentation file.

## Notes and next steps
- I moved the `useState` hooks to the top of the component to fix the React hooks rules-of-hooks error.
- I can run `npm run lint` and fix any linting errors. If you want, I can also add a small confirmation modal for longer runs or allow a custom prompt input on the dashboard.

## Lint status
- Ran `npm run lint` successfully after the changes.
- No ESLint rule violations were reported for the updated dashboard flow.

## What the "resolve API" does
The resolve API is `POST /api/stimulation/resolve` and it powers stimulation-module resolution for the study agent.

### Input
- `contextSnippet` (string): compact context for what should be simulated.
- `targetVariables` (string[]): required variable names that define the simulation signature.
- `conceptName` (string, optional): extra domain hint.

### Flow
1. Validates request body and requires non-empty `contextSnippet` and `targetVariables`.
2. Authenticates the logged-in user from Supabase session.
3. Tries lookup first via `findMatchingSimulationByTargetVariables(...)`.
4. If a match is found, returns `{ success: true, source: "lookup", generatedCode }`.
5. If no match exists, generates code with `stimulationGenerationSubAgent(...)`.
6. Returns `{ success: true, source: "generated", generatedCode }` on generation success.

### Where it is used
- `lib/studyagent/stimulationResolveApiTool.ts` calls this API.
- `lib/studyagent/agent.ts` registers the tool as `resolve_stimulation_module` so the agent can resolve modules during a conversation.

