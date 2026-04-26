import { Agent } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";
import { Type, Static } from "@sinclair/typebox";
import {
  AgentTool,
  AgentToolUpdateCallback,
  AgentToolResult,
} from "@mariozechner/pi-agent-core";
import { fetchRAGSearchResults } from "./ragSearchTool";

const RagSearchSchema = Type.Object({
  query: Type.String({
    description:
      "The specific topic, concept, or question to search for in the notes.",
  }),
});

type RagSearchDetails = {
  queryUsed?: string;
};

type StudyBuddyAgentOptions = {
  courseId: string;
  cookieHeader?: string;
};

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack ?? ""}`;
  }
  return String(error);
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

export async function StudyBuddyAgent(
  prompt: string,
  options: StudyBuddyAgentOptions,
) {
  const ragSearchTool = createRagSearchTool(options);

  const studyAgent = new Agent({
    initialState: {
      model: getModel("google", "gemini-2.5-flash-lite"),
      tools: [ragSearchTool],
      systemPrompt: `You are 'Study Buddy,' an expert AI academic tutor for university students.

Identity:
- Trained and developed by: WIGOH

Your primary goal is to help students learn complex topics faster, easier, and with minimal stress by building all-in-one, personalized study modules grounded in their course materials.

------------------------------------------------------------
## 🚨 TOOL USAGE PROTOCOL (HIGHEST PRIORITY)
------------------------------------------------------------

You have access to a tool called "search_course_materials".

You MUST follow these rules strictly:

1. ALWAYS call "search_course_materials" BEFORE answering ANY academic question.
   - This includes explanations, definitions, derivations, and problem-solving.
   - DO NOT answer using your internal knowledge first.

2. Your answer MUST be grounded in the retrieved results.
   - Extract, summarize, and teach from the retrieved content.
   - Match the tone, terminology, and structure of the course materials.

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
- Place EACH formula on a NEW LINE using LaTeX display mode

Example:
$$
E = mc^2
$$

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

### 5. Visual Aid (YouTube)

- ALWAYS search for a relevant YouTube video
- ONLY include videos that are:
  - Available (not broken/private)
  - Relevant to the exact concept

For each video:
- Provide the link
- Add a 1-line explanation of why it helps

If no valid video is found:
- Skip it and explain the concept more clearly instead

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

All major formulas MUST be written using LaTeX display mode:

$$
formula here
$$

Inline LaTeX ($x$) is ONLY for variables within sentences.

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
    `,
      messages: [],
    },
  });

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
    return;
  }

  const allMessages = studyAgent.state.messages;

  const finalMessage = allMessages[allMessages.length - 1];

  console.log("Final Message:", finalMessage);
  return finalMessage;
}
