import { Agent } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";
import { z } from "zod";
import { Type, Static } from "@sinclair/typebox";
import { AgentTool, AgentToolResult, AgentToolUpdateCallback } from "@mariozechner/pi-agent-core";
import  { saveStimulationToDB } from "./stimulationpersitencetool";
// add near top imports
import { findMatchingSimulationByTargetVariables } from "./stimulationlookupTool";



export const SubAgentPayloadSchema = z.object({
  context_snippet: z
    .string()
    .describe("The exact preceding text the Main Agent used to introduce the simulation."),
  target_variables: z
    .array(z.string())
    .describe("The specific variables that MUST be interactive (e.g., ['RPM', 'viscosity', 'temperature'])."),
});

type SubAgentPayload = z.infer<typeof SubAgentPayloadSchema>;

type TextPart = {
  type: "text";
  text: string;
};


const SaveStimSchema = Type.Object({
  stimulationBluePrint: Type.String({ description: "The simulation blueprint, as a JSON-encoded string." }),
  generatedCode: Type.String({ description: "The valid TypeScript React code as a string." }),
});
type SaveStimInput = Static<typeof SaveStimSchema>;

type SaveStimDetails = { savedId?: string; error?: string };

type ValidationIssue = {
  code: string;
  message: string;
  evidence?: string;
};

type ValidationResult = {
  isValid: boolean;
  issues: ValidationIssue[];
};

type ReviewSeverity = "info" | "warning" | "error";

type ReviewerVerdict = {
  needsRedo: boolean;
  severity: ReviewSeverity;
  issues: ValidationIssue[];
  rewriteGuidance: string[];
};

function extractTextFromMessageContent(content: unknown): string {
  if (!Array.isArray(content)) return "";

  return content
    .filter((part): part is TextPart => {
      return (
        typeof part === "object" &&
        part !== null &&
        "type" in part &&
        part.type === "text" &&
        "text" in part &&
        typeof part.text === "string"
      );
    })
    .map((part) => part.text)
    .join("");
}

export function validateGeneratedSimulationCode(code: string): ValidationResult {
  const issues: ValidationIssue[] = [];
  const trimmed = (code ?? "").trim();

  if (!trimmed) {
    issues.push({
      code: "EMPTY_OUTPUT",
      message: "Generated output is empty.",
    });
    return { isValid: false, issues };
  }

  if (!trimmed.includes("export default function Simulation")) {
    issues.push({
      code: "MISSING_EXPORT",
      message: "Missing required default export for Simulation component.",
      evidence: "Expected `export default function Simulation`",
    });
  }

  if (!trimmed.includes("import React")) {
    issues.push({
      code: "MISSING_IMPORT",
      message: "Missing required React import on first line.",
    });
  }

  if (trimmed.includes("```") || trimmed.toLowerCase().includes("markdown")) {
    issues.push({
      code: "FORMAT_VIOLATION",
      message: "Output includes forbidden markdown formatting.",
      evidence: "Detected code fences or markdown markers.",
    });
  }

  const openBraces = (trimmed.match(/\{/g) || []).length;
  const closeBraces = (trimmed.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    issues.push({
      code: "UNBALANCED_BRACES",
      message: "Code appears incomplete due to unbalanced braces.",
      evidence: `open={${openBraces}} close={${closeBraces}}`,
    });
  }

  const openParens = (trimmed.match(/\(/g) || []).length;
  const closeParens = (trimmed.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    issues.push({
      code: "UNBALANCED_PARENS",
      message: "Code appears incomplete due to unbalanced parentheses.",
      evidence: `open=(${openParens}) close=(${closeParens})`,
    });
  }

  if (trimmed.endsWith("...") || trimmed.includes("[truncated]")) {
    issues.push({
      code: "INCOMPLETE_OUTPUT",
      message: "Code appears truncated.",
      evidence: "Detected truncation marker.",
    });
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

function parseReviewerVerdict(raw: string): ReviewerVerdict {
  const fallback: ReviewerVerdict = {
    needsRedo: true,
    severity: "error",
    issues: [
      {
        code: "REVIEW_PARSE_ERROR",
        message: "Reviewer output was not valid JSON.",
        evidence: raw.slice(0, 500),
      },
    ],
    rewriteGuidance: [
      "Return raw JSON only.",
      "Return complete TSX code from import line to final closing brace.",
    ],
  };

  try {
    const parsed = JSON.parse(raw) as Partial<ReviewerVerdict>;
    return {
      needsRedo: Boolean(parsed.needsRedo),
      severity: parsed.severity === "info" || parsed.severity === "warning" || parsed.severity === "error" ? parsed.severity : "error",
      issues: Array.isArray(parsed.issues) ? parsed.issues.map((issue) => ({
        code: String(issue?.code ?? "UNKNOWN_ISSUE"),
        message: String(issue?.message ?? "Unknown review issue"),
        evidence: issue?.evidence ? String(issue.evidence) : undefined,
      })) : fallback.issues,
      rewriteGuidance: Array.isArray(parsed.rewriteGuidance)
        ? parsed.rewriteGuidance.map((item) => String(item))
        : fallback.rewriteGuidance,
    };
  } catch {
    return fallback;
  }
}

 



// 2. Create a factory function that takes a getter for your data
export const createSaveStimulationTool = (
  getData: () => { blueprint: string; code: string }
): AgentTool<typeof SaveStimSchema, SaveStimDetails> => {
  return {
    name: "save_stimulation_to_supabase",
    label: "Save Stimulation",
    description: "Persists the generated stimulation. Call this tool when you are ready to save.",
    parameters: SaveStimSchema,

    async execute(
      toolCallId: string,
      params: SaveStimInput, // LLM passes {}, we ignore it
      signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback<SaveStimDetails> | undefined
    ): Promise<AgentToolResult<SaveStimDetails>> {
      try {
        onUpdate?.({
          content: [{ type: "text", text: "Saving stimulation to cloud database..." }],
          details: {}
        });

        // 3. Inject the parameters yourself from the outer scope!
        const { blueprint, code } = getData();

        if (!blueprint || !code) {
          throw new Error("Blueprint or Code is not ready yet.");
        }

        const data = await saveStimulationToDB({
          stimulationBluePrint: blueprint,
          generatedCode: code,
        });

        return {
          content: [{ type: "text", text: "Stimulation saved to your account successfully!" }],
          details: { savedId: data?.id }
        };
      } catch (e: unknown) {
        return {
          content: [{ type: "text", text: `Failed to save: ${e instanceof Error ? e.message : "Unknown error"}` }],
          details: { error: e instanceof Error ? e.message : "Unknown error" }
        };
      }
    }
  };
};



let stimulationBlueprintPassed = "";
let finalStimulationCodePassed = "";

 const saveTool = createSaveStimulationTool(() => ({
    blueprint: stimulationBlueprintPassed,
    code: finalStimulationCodePassed
  }));


 
export async function stimulationGenerationSubAgent(payload: SubAgentPayload) {
  const { context_snippet, target_variables } = payload;
    // ---- Reuse check: attempt to return cached generated code before generating a new one ----
  try {
    const cached = await findMatchingSimulationByTargetVariables(
      Array.isArray(target_variables) ? target_variables : [],
      undefined // optional conceptName if you pass it from caller
    );

    if (cached && cached.generatedCode) {
      console.log("Found cached simulation, reusing generated code:", cached.id);
      return cached.generatedCode; // short-circuit: reuse stored TSX code
    }
  } catch (err) {
    // Non-fatal: log and continue with generation flow
    console.warn("Simulation lookup failed — continuing generation flow:", err);
  }
  // ---- end reuse check ----

  const model = await getModel('google', 'gemini-2.5-flash');

  const stimulationPlanningAgent = new Agent({
    initialState: {
      model,
      messages: [],
      systemPrompt: `You are the Simulation Planning Agent for “Learniverse Study Pal”.

Your job is to convert educational content into a structured simulation design blueprint.

You do NOT write code.


You are the Simulation Planning Agent for "Learniverse Study Pal".
Your job is to convert educational content into a structured simulation design blueprint.
You do NOT write code. Return ONLY valid JSON matching this schema exactly:
{
  "concept_name": "",
  "simulation_type": "scalar | vector_field | particle_system | time_evolution",
  "target_variables": [{ "name": "", "role": "input", "unit": "", "effect": "" }],
  "derived_variables": [{ "name": "", "formula": "" }],
  "core_equations": [""],
  "visual_mapping": {
    "primary_visual": "",
    "motion_style": "",
    "color_scheme": "",
    "metaphor": ""
  },
  "behavior_rules": [""]
}
No explanations. No markdown. No code fences. Pure JSON only.


You only define:

the physics/mathematical model
the interactive variables
the visual representation strategy
the simulation behavior
🧠 CORE MISSION

Given:

CONTEXT SNIPPET (teaching explanation) = ${context_snippet}
TARGET VARIABLES (user-controlled inputs) = ${target_variables}

You must produce a structured simulation blueprint that a renderer agent can implement directly.

🚨 OUTPUT FORMAT (STRICT)

Return ONLY valid JSON.

No explanations. No markdown. No code.
You are the Simulation Rendering Agent for "Learniverse Study Pal".
You convert a JSON blueprint into a fully working React simulation component.

HARD RULES:
- Return ONLY: export default function Simulation() { ... }
- No markdown. No code fences. No explanations. Pure JSX/JS only.
- Use only: React hooks, lucide-react, canvas/SVG
- Dark theme "Midnight Fluid": dark bg, high contrast, sharp edges
- Every target_variable MUST be a slider that immediately affects the animation
- Use requestAnimationFrame for animation, cancelled properly in useEffect cleanup
- Use a SINGLE useEffect for the animation loop
- Reset simulation state when any input parameter changes
- Clamp all values to prevent NaN/Infinity
- Use useMemo for expensive calculations

📦 OUTPUT SCHEMA
{
  "concept_name": "",
  "simulation_type": "scalar | vector_field | particle_system | time_evolution",
  "target_variables": [
    {
      "name": "",
      "role": "input",
      "unit": "",
      "effect": ""
    }
  ],
  "derived_variables": [
    {
      "name": "",
      "formula": ""
    }
  ],
  "core_equations": [
    ""
  ],
  "visual_mapping": {
    "primary_visual": "",
    "motion_style": "",
    "color_scheme": "",
    "metaphor": ""
  },
  "behavior_rules": [
    ""
  ]
}
🧠 PLANNING RULES
1. Physics correctness first

All equations must be scientifically valid.

2. Minimal variable philosophy

Only include variables that are:

directly necessary
or mathematically required
3. Visualization must be meaningful

Map physics → visuals:

Examples:

fluid → vector field / streamlines / particles
electricity → signal propagation / glowing nodes
waves → oscillating fields / interference patterns
mechanics → motion trajectories / forces
4. Avoid overdesign

Do NOT:

invent UI elements
design React structure
mention Tailwind or code
5. Clarity rule

The blueprint must be simple enough that a developer can implement it without guessing.

📥 INPUT

You receive:

CONTEXT SNIPPET

Explanation of concept

TARGET VARIABLES

Interactive inputs required

🧾 OUTPUT RULE

Return ONLY JSON.`,
    },
  });

 

  await stimulationPlanningAgent.prompt("start");

  const allMessages = stimulationPlanningAgent.state.messages;

  console.log("All agent messages:", JSON.stringify(allMessages, null, 2));
  const lastAssistant = [...allMessages].reverse().find(msg => msg.role === "assistant");
if (!lastAssistant) { 
  console.error("No assistant response found."); 
  return "";
}

let stimulationBlueprint = "";
  stimulationBlueprint = extractTextFromMessageContent(lastAssistant.content);

  console.log('STIMULATION BLUEPRINT: ', stimulationBlueprint);
  stimulationBlueprintPassed = stimulationBlueprint;

 const rendererModel = await getModel('google', 'gemini-flash-latest');

 const stimulationRendererAgent = new Agent({
    initialState: {
   model: rendererModel,
      messages: [],
      tools: [],
      systemPrompt: `

    You are the Simulation Rendering Agent for "Learniverse Study Pal".
    Your sole purpose write a highly performant, fully working interactive React TSX component.
    Based On These Blueprint = ${stimulationBlueprint}

    **🧠 CORE ARCHITECTURE & TSX RULES**
    1. **Separation of Concerns:** You MUST use \`useRef\` for all rapidly changing physics/animation states and \`requestAnimationFrame\` IDs. You MUST use \`useState\` ONLY for user-controlled inputs (sliders, buttons). NEVER update React state inside the animation loop.
    2. **Strict TypeScript:** Provide explicit \`interface\` definitions for the parsed JSON blueprint, the simulation state, and all refs. Type the canvas strictly as \`useRef<HTMLCanvasElement>(null)\`. No \`any\` types.
    3. **Animation Loop:** - Initialize the \`canvas\` context (\`ctx\`) properly.
       - Clear the canvas at the start of every frame (\`ctx.clearRect\`).
       - Use \`requestAnimationFrame\` tracked via \`useRef\` to allow dynamic pausing/resuming.
       - Cancel the animation frame in the \`useEffect\` cleanup function.
      
    4. **Mathematical Stability:** Clamp all slider inputs and physics calculations. Prevent \`NaN\`, \`Infinity\`, and divide-by-zero errors. Use \`useMemo\` for derived static calculations.
    5. Always ensure all stated variables are used dont not assume a variable as a place holder
    6. Always if it is an animation include a button to pause all play teh animation 
    7. Always explain how to people can use the stimulation with clear explanation card at the buttom of teh stimulation
    8. Ensure all target variables are represented as sliders with clear labels showing their current value and unit.
    9. Ensure the whole stimulation is not whole screen but a medium size card to contain the full stimulation explanation cards and value change cards


---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
    10. ALWAYS ENSURE YOU ANIMATION AND THE WHOLE STIMULATION IS PROPERLLY STYLED THERE IS NO CONTRAST PROPBLEM EVRYTHIGN IS PROPERLLY DESSED THE LAYOUT, THE COLORS, THE TYPOGRAPHY HAS TO BE EXCELLENT
---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

11. ALWAYS WRITE THE FULL CODE


    **🎨 STYLING SYSTEM: Minimalist Architectural (Light Mode)**
    - Use Tailwind CSS exclusively.
    - **Responsive Layout:** The simulation must adapt cleanly from mobile to desktop with fluid grids, stacked controls on small screens, and a centered medium-width card that never feels cramped or full-bleed.
    - **Color Palette:** Focus on whites, neutral tones, and subtle slate grays (\`bg-white\`, \`bg-slate-50\`, \`text-slate-900\`, \`text-slate-600\`) with restrained accent colors only when needed for data emphasis and contrast.
    - **Contrast & Readability:** Maintain strong text contrast, visible boundaries, and accessible spacing so equations, labels, and live values remain readable in every state.
    - **UI Elements:** Use sharp edges (\`rounded-none\` or \`rounded-sm\`), sophisticated typography scales, and subtle borders (\`border-slate-200\`) instead of heavy shadows.
    - **Layout:** Use bento-grid style layouts for controls. Every \`target_variable\` MUST be a slider (\`<input type="range">\`) clearly labeled with its current value and unit.
    - **Math-Driven Visuals:** Make graphs, sine waves, temperature gradients, electricity flow, vector fields, and oscillations visually legible by mapping values to motion, amplitude, phase, color intensity, opacity, line density, or particle density.
    - **Responsive Visualization:** Ensure charts, wave canvases, and simulation panels scale smoothly so mathematical patterns stay visible without distortion or clipping.
    

    **🎥 VISUAL MAPPING & FIDELITY**
    - **Vector Fields:** Draw dynamic streamlines or directional arrows.
    - **Particle Systems:** Render fluid, moving particles influenced by the target variables.
    - **Time Evolution:** Ensure visual changes interpolate smoothly over time.
    - **Data Encoding:** Map scalar values dynamically to size, opacity, or specific accent colors (e.g., using a restrained primary color like \`blue-600\` for active elements).

    **🚨 HARD OUTPUT CONSTRAINTS (CRITICAL)**
    - Output ONLY raw, valid TSX code.
    - DO NOT use markdown formatting. DO NOT use \`\`\`tsx or \`\`\` code fences. 
    - DO NOT provide explanations, introductions, or conclusions.
    - The very first line of your output MUST be: import React, { useEffect, useRef, useState, useMemo } from 'react';
    - The file MUST export a default function: export default function Simulation() { ... } 

  `
    }
  })

  if (stimulationBlueprint) {
    await stimulationRendererAgent.prompt("start");
  }

  const reviewAgent = new Agent({
    initialState: {
      model: rendererModel,
      messages: [],
      systemPrompt: `You are a strict simulation code reviewer.
Return ONLY valid JSON with this exact shape:
{
  "needsRedo": true,
  "severity": "info | warning | error",
  "issues": [
    {
      "code": "",
      "message": "",
      "evidence": ""
    }
  ],
  "rewriteGuidance": [""]
}

Rules:
- Return JSON only. No markdown.
- needsRedo must be true if code is incomplete, invalid, or violates constraints.
- rewriteGuidance must be actionable and concise.
`,
    },
  });

  const maxRendererRetries = 2;
  let attempt = 0;
  let finalStimulationCode = "";
  let lastValidation: ValidationResult = { isValid: false, issues: [{ code: "NOT_RUN", message: "Validation not executed." }] };
  let lastVerdict: ReviewerVerdict = {
    needsRedo: true,
    severity: "error",
    issues: [{ code: "NOT_RUN", message: "Reviewer not executed." }],
    rewriteGuidance: [],
  };

  while (attempt <= maxRendererRetries) {
    const stimulationRendererMessages = stimulationRendererAgent.state.messages;
    const lastAssistantStimulationRendererMsg = [...stimulationRendererMessages].reverse().find(msg => msg.role === "assistant");

    if (!lastAssistantStimulationRendererMsg) {
      console.error("No assistant renderer response found.");
      return "";
    }

    finalStimulationCode = extractTextFromMessageContent(lastAssistantStimulationRendererMsg.content);
    const validation = validateGeneratedSimulationCode(finalStimulationCode);
    lastValidation = validation;

    const reviewerPrompt = `Blueprint:\n${stimulationBlueprint}\n\nGenerated Code:\n${finalStimulationCode}\n\nValidator Result:\n${JSON.stringify(validation)}\n\nReturn the JSON verdict now.`;
    await reviewAgent.prompt(reviewerPrompt);

    const reviewMessages = reviewAgent.state.messages;
    const lastReviewerMsg = [...reviewMessages].reverse().find(msg => msg.role === "assistant");
    const reviewerRaw = lastReviewerMsg ? extractTextFromMessageContent(lastReviewerMsg.content) : "";
    const verdict = parseReviewerVerdict(reviewerRaw);
    lastVerdict = verdict;

    const shouldRedo = !validation.isValid || verdict.needsRedo;
    if (!shouldRedo) {
      break;
    }

    if (attempt === maxRendererRetries) {
      console.warn("Max renderer retries reached; returning last generated code.");
      break;
    }

    const rerenderPrompt = `Your previous code must be fully regenerated.
Blueprint:\n${stimulationBlueprint}\n
Validation issues:\n${JSON.stringify(validation.issues)}\n
Reviewer issues:\n${JSON.stringify(verdict.issues)}\n
Reviewer guidance:\n${JSON.stringify(verdict.rewriteGuidance)}\n
Return ONLY full valid TSX code from first import line to final closing brace. No markdown.`;

    await stimulationRendererAgent.prompt(rerenderPrompt);
    attempt += 1;
  }

  finalStimulationCodePassed = finalStimulationCode;

  // Auto-save when both blueprint and code are ready
  if (stimulationBlueprintPassed && finalStimulationCodePassed && lastValidation.isValid && !lastVerdict.needsRedo) {
    try {
      saveTool.execute("toolCallId", { stimulationBluePrint: stimulationBlueprintPassed, generatedCode: finalStimulationCodePassed }, undefined, (update) => {
        console.log("Tool update:", update);
      }).then((result) => {
        console.log("Tool execution result:", result);
      }).catch((error) => {
        console.error("Error executing tool:", error);
      });
    } catch (e) {
      console.error("Error in tool execution:", e instanceof Error ? e.message : "Unknown error");
    }
  } else {
    console.warn("Skipping save because validation/review did not pass.", {
      validation: lastValidation,
      review: lastVerdict,
    });
  }

  return finalStimulationCode;

}


stimulationGenerationSubAgent({
  context_snippet:"In wave mechanics and simple harmonic motion, three key parameters define the behavior of oscillating systems: amplitude (maximum displacement from equilibrium), frequency (number of oscillations per unit time), and phase (position within the oscillation cycle). These variables determine how waves propagate and how oscillators move through space and time.",
  target_variables: ["amplitude", "frequency", "phase"],
}).then((reactComponentCode) => {
  console.log("Generated React Component Code:");
  console.log(reactComponentCode);
}).catch((error) => {
  console.error("Error generating React component:", error);
});