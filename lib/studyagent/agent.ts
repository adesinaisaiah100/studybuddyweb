import { Agent } from "@mariozechner/pi-agent-core";
import {
  getModel,
  type Api,
  type AssistantMessage,
  type Message,
  type Model,
} from "@mariozechner/pi-ai";
import { Type, Static } from "@sinclair/typebox";
import {
  AgentTool,
  AgentToolUpdateCallback,
  AgentToolResult,
} from "@mariozechner/pi-agent-core";
import { fetchRAGSearchResults } from "./ragSearchTool";
import { resolveStimulationViaApi } from "./stimulationResolveApiTool";
import { extractTextFromAssistantMessage } from "./chatUtils";


const RagSearchSchema = Type.Object({
  query: Type.String({
    description:
      "The specific topic, concept, or question to search for in the notes.",
  }),
});

type RagSearchDetails = {
  queryUsed?: string;
};

const ResolveStimulationSchema = Type.Object({
  contextSnippet: Type.String({
    description:
      "A compact context summary describing what the user wants to simulate.",
  }),
  targetVariables: Type.Array(Type.String(), {
    minItems: 1,
    description:
      "List of variables that define the simulation signature to look up (for example: RPM, viscosity, temperature).",
  }),
  conceptName: Type.Optional(
    Type.String({
      description:
        "Optional concept/domain name to narrow matching (for example: bernoulli principle).",
    }),
  ),
});

type ResolveStimulationDetails = {
  success?: boolean;
  source?: "lookup" | "generated" | null;
};

export type StudyBuddyAgentOptions = {
  courseId: string;
  cookieHeader?: string;
  history?: StudyBuddyChatHistoryMessage[];
  sessionSummary?: string | null;
};

export type StudyBuddyChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
  createdAt?: string | null;
};

export type StudyBuddyAgentResult = {
  finalMessage: AssistantMessage;
  text: string;
  messages: Message[];
};

const STUDY_BUDDY_SYSTEM_PROMPT = `You are 'Study Buddy,' an expert AI academic tutor for university students.

Identity:
- Trained and developed by: WIGOH

Your primary goal is to help students learn complex topics faster, easier, and with minimal stress by building all-in-one, personalized study modules grounded in their course materials.

------------------------------------------------------------
## 🚨 TOOL USAGE PROTOCOL (HIGHEST PRIORITY)
------------------------------------------------------------

You have access to a tool called "search_course_materials".
You also have access to a tool called "resolve_stimulation_module".

You MUST follow these rules strictly:

1. ALWAYS call "search_course_materials" BEFORE answering ANY academic question.
   - This includes explanations, definitions, derivations, and problem-solving.
   - DO NOT answer using your internal knowledge first.

2. Your answer MUST be grounded in the retrieved results.
   - Extract, summarize, and teach from the retrieved content.
   - Don't nessasarily match the retrieved content verbatim, but ensure your explanation is based on it.

3. If retrieved results are:
   - ✅ Highly relevant → Use them as your PRIMARY source.
   - ⚠️ Partially relevant → Combine them with your own knowledge.
   - ❌ Empty or insufficient → THEN use your internal knowledge as fallback.

4. NEVER skip the tool call unless:
   - The user is engaging in casual conversation (non-academic)
   - OR the query is a greeting

5. When calling the tool:
   - Convert the user’s question into a structured academic query
   - Include keywords like: definition, explanation, examples, formula (if applicable)

   Example:
   User: "explain entropy like I'm 5"
   Tool Query: "entropy thermodynamics definition explanation examples disorder energy"

6. If the question involves multiple concepts:
   - You MAY call the tool multiple times with different queries

7. Always assume the course materials contain the most accurate and preferred explanation.

8. If the user asks for an interactive simulation, simulator, or dynamic visual model or you think a stimulation would help explain the concept:
  - Call "resolve_stimulation_module" with contextSnippet + target variables inferred from the user request.
  - If the tool returns success, continue your normal teaching response and note that the simulation module is prepared.
  - Do NOT print or expose raw simulation code in your answer.
9. Always include examples to help students understand better, and ensure examples are relevant to the discussion.
10. Include Analogies you think a student would relate to

------------------------------------------------------------
## 🧩 RESPONSE GROUNDING RULE
------------------------------------------------------------

When using retrieved content:

- DO NOT copy chunks verbatim
- SIMPLIFY and TEACH clearly
- PRESERVE:
  - Key definitions
  - Important terminology
  - Logical structure from the notes

Your explanation should feel like:
"A clearer, smarter, student-friendly version of the original lecture notes"

------------------------------------------------------------
## 🎯 TRIAGE USER INTENT
------------------------------------------------------------

1. Quick Answer Mode:
If the user includes:
- "concise:"
- "quick answer:"
- "short:"

→ Provide ONLY a direct, short answer
→ STILL call the tool first, but summarize briefly

2. Full Study Module (Default):
For all academic questions, generate a complete structured study module.

------------------------------------------------------------
## 🧠 MODULE STRUCTURE (DEFAULT MODE)
------------------------------------------------------------

Format your response using clean Markdown:

### 1. Overview
- A simple 1–2 sentence explanation answering the question directly

### 2. Key Concepts
- Break concepts into bullet points
- Use simple explanations and relatable analogies (preferably Nigerian context)

### 3. Formulas & Equations (if applicable)
- Place EACH formula on a NEW LINE

Example(at least 2 examples of question and solution or answer):

E = mc^2


- NEVER put formulas inline with text

### 4. Problem-Solving Steps (for calculations)

Step 1: Given
- List known variables clearly

Step 2: Formula
- Write the formula on a separate line

Step 3: Calculation
- Show substitutions clearly

Step 4: Answer
- Final answer with correct units

### 6. Conceptual Visualization (if needed)

Use simple structured steps like:

Process Flow:
1. Step one
2. Step two
3. Step three

### 7. Key Definition
- Provide a clear academic definition (textbook-style)

### 8. Summary for Notes
- 2–3 concise sentences for revision


### 9. Tips for exams(when necessary)
- Bullet point tips on how to approach questions on this topic in exams

------------------------------------------------------------
## 🎯 ADAPTATION RULES
------------------------------------------------------------

- Match the user's requested level:
  - Easy → Simple explanations + analogies
  - Intermediate → Balanced explanation
  - Advanced → Technical precision

- Tone:
  - Clear
  - Supportive
  - Patient

------------------------------------------------------------
## 📚 CONTEXT PRIORITY ORDER
------------------------------------------------------------

Always prioritize:

1. Retrieved course materials (via tool) ← PRIMARY
2. Uploaded files (if present)
3. Course/university context (if provided)
4. Internal knowledge (LAST RESORT)

------------------------------------------------------------
## ⚠️ STRICT RESPONSE RULES
------------------------------------------------------------

- NEVER skip the tool call for academic queries
- NEVER overcrowd responses with formulas
- ALWAYS separate formulas onto new lines using LaTeX
- ALWAYS ground explanations in retrieved material first
- NEVER hallucinate course-specific details

------------------------------------------------------------
## 🧮 MATH RULE
------------------------------------------------------------
- For math-related questions, ALWAYS provide a step-by-step solution with clear explanations for each step.
- NEVER just provide the final answer without showing the work.

-Always format formulas using LaTeX and place them on separate lines for clarity.

------------------------------------------------------------
## 🎓 FINAL GOAL
------------------------------------------------------------

Your job is NOT just to answer.

Your job is to:
- Teach
- Simplify
- Mirror the student’s actual course materials
- Reduce study stress
- Replace the need for multiple tabs

You are a personalized academic tutor powered by the student's own notes.

------------------------------------------------------------
`;

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack ?? ""}`;
  }
  return String(error);
}

function buildSystemPrompt(sessionSummary?: string | null): string {
  if (!sessionSummary?.trim()) {
    return STUDY_BUDDY_SYSTEM_PROMPT;
  }

  return `${STUDY_BUDDY_SYSTEM_PROMPT}

------------------------------------------------------------
## 📝 COMPACTED SESSION SUMMARY
------------------------------------------------------------

Use this summary as prior conversation context for the current chat session:

${sessionSummary.trim()}
`;
}

function buildHistoryMessages(
  history: StudyBuddyChatHistoryMessage[] | undefined,
  model: Model<Api>,
): Message[] {
  if (!history?.length) {
    return [];
  }

  return history.map((message, index) => {
    const timestamp = message.createdAt
      ? new Date(message.createdAt).getTime()
      : Date.now() + index;

    if (message.role === "user") {
      return {
        role: "user",
        content: message.content,
        timestamp,
      };
    }

    return {
      role: "assistant",
      content: [{ type: "text", text: message.content }],
      api: model.api,
      provider: model.provider,
      model: model.id,
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0,
        },
      },
      stopReason: "stop",
      timestamp,
    };
  });
}

//TOOL1: RAG Search Tool - Searches course materials for relevant information based on the user's query.
const createRagSearchTool = (options: StudyBuddyAgentOptions): AgentTool<
  typeof RagSearchSchema,
  RagSearchDetails
> => ({
  name: "search_course_materials",
  label: "Search Notes & Materials", // Used for UI display if needed
  description:
    "Searches the student's uploaded documents, lecture notes, and course materials for relevant information to answer their question.",

  // Define the arguments the LLM must provide
  parameters: RagSearchSchema,

  // The function that runs when the LLM decides to use this tool
  execute: async (
    toolCallId: string,
    params: Static<typeof RagSearchSchema>, // <-- Explicitly tell TS what params is
    signal: AbortSignal | undefined,
    onUpdate: AgentToolUpdateCallback | undefined,
  ): Promise<AgentToolResult<RagSearchDetails>> => {
    try {
      // Optional: You can stream progress to the UI using onUpdate
      onUpdate?.({
        content: [
          { type: "text", text: `Searching notes for: "${params.query}"...` },
        ],
        details: {},
      });

      // Call your actual RAG API
      const ragResults = await fetchRAGSearchResults(
        params.query,
        options.courseId,
        5,
        options.cookieHeader,
      );

      if (!ragResults || ragResults.trim() === "") {
        return {
          content: [
            {
              type: "text",
              text: "No relevant information found in the course materials.",
            },
          ],
          details: {},
        };
      }

      // Return the chunks to the LLM
      return {
        content: [{ type: "text", text: ragResults }],
        details: { queryUsed: params.query }, // Optional debug metadata
      };
    } catch (error) {
      console.error("[ToolError] search_course_materials failed", {
        toolCallId,
        query: params.query,
        error: formatError(error),
      });

      // Throwing an error automatically reports the failure back to the LLM
      throw new Error(
        `Failed to search materials: ${(error as Error).message}, please try again.`,
      );
    }
  },
});

const createResolveStimulationTool = (
  options: StudyBuddyAgentOptions,
): AgentTool<typeof ResolveStimulationSchema, ResolveStimulationDetails> => ({
  name: "resolve_stimulation_module",
  label: "Resolve Stimulation Module",
  description:
    "Resolves a stimulation module by trying lookup first, then generation if lookup misses.",
  parameters: ResolveStimulationSchema,
  execute: async (
    toolCallId: string,
    params: Static<typeof ResolveStimulationSchema>,
    signal: AbortSignal | undefined,
    onUpdate: AgentToolUpdateCallback | undefined,
  ): Promise<AgentToolResult<ResolveStimulationDetails>> => {
    try {
      onUpdate?.({
        content: [{ type: "text", text: "Resolving stimulation module..." }],
        details: {},
      });

      const result = await resolveStimulationViaApi(
        {
          contextSnippet: params.contextSnippet,
          targetVariables: params.targetVariables,
          conceptName: params.conceptName,
        },
        options.cookieHeader,
      );

      if (!result.success) {
        return {
          content: [
            {
              type: "text",
              text: "Stimulation module resolution failed.",
            },
          ],
          details: {
            success: false,
            source: result.source,
          },
        };
      }

      return {
        content: [
          {
            type: "text",
            text: "Stimulation module resolved successfully.",
          },
        ],
        details: {
          success: true,
          source: result.source,
        },
      };
    } catch (error) {
      console.error("[ToolError] resolve_stimulation_module failed", {
        toolCallId,
        params,
        error: formatError(error),
      });

      throw new Error(
        `Failed to resolve stimulation module: ${(error as Error).message}`,
      );
    }
  },
});


//TOOL 2 search stimulation tool - this tools query the database to search if stimualtion for a particular query exist




export function createStudyBuddyRuntime(options: StudyBuddyAgentOptions) {
  const ragSearchTool = createRagSearchTool(options);
  const resolveStimulationTool = createResolveStimulationTool(options);
  const model = getModel("google", "gemini-2.5-flash-lite");

  return new Agent({
    initialState: {
      model,
      tools: [ragSearchTool, resolveStimulationTool],
      systemPrompt: buildSystemPrompt(options.sessionSummary),
      messages: buildHistoryMessages(options.history, model),
    },
  });
}

export async function StudyBuddyAgent(
  prompt: string,
  options: StudyBuddyAgentOptions,
): Promise<StudyBuddyAgentResult> {
  const studyAgent = createStudyBuddyRuntime(options);

  await studyAgent.prompt(prompt);

  const messages = studyAgent.state.messages;

  // Find all tool results
  const toolResults = messages.filter((msg) => msg.role === "toolResult");

  toolResults.forEach((resultMsg) => {
    console.log("Tool Name:", resultMsg);
    console.log("Tool Output:", resultMsg.content);
  });

  if (studyAgent.state.errorMessage) {
    console.error("Agent failed with error:", studyAgent.state.errorMessage);
    throw new Error(studyAgent.state.errorMessage);
  }

  const allMessages = studyAgent.state.messages;
  const finalMessage = allMessages[allMessages.length - 1];

  if (!finalMessage || finalMessage.role !== "assistant") {
    throw new Error("Study Buddy did not return a final assistant message.");
  }

  console.log("Final Message:", finalMessage);
  return {
    finalMessage,
    text: extractTextFromAssistantMessage(finalMessage),
    messages: allMessages,
  };
}
