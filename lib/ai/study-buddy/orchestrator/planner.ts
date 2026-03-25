import type {
  IntentAnalysis,
  ToolPlan,
  LearningStrategy,
  ToolExecutionStep,
} from "@/lib/ai/study-buddy/types";
import { applyConfidencePolicy } from "@/lib/ai/study-buddy/orchestrator/intent-detector";
import { createStudyBuddyLlm } from "@/lib/ai/study-buddy/orchestrator/llm";

/**
 * Strategy mapping based on intent
 */
const INTENT_TO_STRATEGY: Record<string, LearningStrategy> = {
  learn: "explain-simple",
  solve: "step-by-step",
  quiz: "assessment",
  revise: "step-by-step",
  explore: "visual",
  unclear: "mixed",
};

const LEARNING_STRATEGIES: LearningStrategy[] = [
  "explain-simple",
  "step-by-step",
  "visual",
  "interactive",
  "assessment",
  "mixed",
];

function isLearningStrategy(value: unknown): value is LearningStrategy {
  return typeof value === "string" && LEARNING_STRATEGIES.includes(value as LearningStrategy);
}

/**
 * Tool recommendations based on confidence level and intent
 */
function getTooSuggestions(
  intent: IntentAnalysis,
  policy: ReturnType<typeof applyConfidencePolicy>
): ToolExecutionStep[] {
  const baseTools: ToolExecutionStep[] = [];

  if (intent.intent === "quiz") {
    // Log quiz generation for tracking
    baseTools.push({
      tool: "memory",
      reason: "Log quiz creation for performance tracking",
      priority: 1,
      input: { action: "log_state", data: { intent: "quiz", topic: intent.topic } },
    });
  }

  // Always retrieve relevant materials
  baseTools.push({
    tool: "retriever",
    reason: `Fetch relevant course materials for ${intent.topic || "the query"}`,
    priority: 1,
    input: { query: intent.topic || "", limit: 5 },
  });

  // Intent-specific tools
  switch (intent.intent) {
    case "learn":
      baseTools.push({
        tool: "explainer",
        reason: "Provide detailed explanation",
        priority: 2,
        input: { style: "pedagogical", depth: "detailed" },
      });
      if (policy.level !== "low") {
        baseTools.push({
          tool: "example-generator",
          reason: "Show concrete examples for understanding",
          priority: 3,
          input: { count: 2 },
        });
      }
      break;

    case "solve":
      baseTools.push({
        tool: "problem-solver",
        reason: "Work through the problem step-by-step",
        priority: 2,
        input: { showIntermediateSteps: true },
      });
      baseTools.push({
        tool: "validator",
        reason: "Verify the solution",
        priority: 3,
        input: { checkAccuracy: true },
      });

      if (
        intent.topic &&
        (intent.topic.toLowerCase().includes("circuit") ||
          intent.topic.toLowerCase().includes("voltage") ||
          intent.topic.toLowerCase().includes("current") ||
          intent.topic.toLowerCase().includes("resistance"))
      ) {
        baseTools.push({
          tool: "circuit",
          reason: "Visualize the electrical circuit",
          priority: 4,
          input: {},
        });
      }
      break;

    case "quiz":
      baseTools.push({
        tool: "quiz-generator",
        reason: "Create assessment questions",
        priority: 2,
        input: { difficulty: intent.difficulty || "medium", count: 3 },
      });
      break;

    case "revise":
      baseTools.push({
        tool: "summarizer",
        reason: "Provide concise summary of key points",
        priority: 2,
        input: { style: "bullet-points" },
      });
      baseTools.push({
        tool: "quiz-generator",
        reason: "Self-assessment to check retention",
        priority: 3,
        input: { difficulty: "medium", count: 2 },
      });
      break;

    case "explore":
      baseTools.push({
        tool: "slide",
        reason: "Generate presentation slides for overview",
        priority: 2,
        input: { theme: "light" },
      });
      if (policy.level !== "low") {
        baseTools.push({
          tool: "diagram",
          reason: "Create visual diagrams",
          priority: 3,
          input: { diagramType: "mermaid" },
        });
      }

      if (
        intent.topic &&
        (intent.topic.toLowerCase().includes("simulation") ||
          intent.topic.toLowerCase().includes("physics") ||
          intent.topic.toLowerCase().includes("pendulum") ||
          intent.topic.toLowerCase().includes("projectile") ||
          intent.topic.toLowerCase().includes("financial") ||
          intent.topic.toLowerCase().includes("investment") ||
          intent.topic.toLowerCase().includes("interest") ||
          intent.topic.toLowerCase().includes("material") ||
          intent.topic.toLowerCase().includes("stress") ||
          intent.topic.toLowerCase().includes("load") ||
          intent.topic.toLowerCase().includes("property") ||
          intent.topic.toLowerCase().includes("valuation") ||
          intent.topic.toLowerCase().includes("growth") ||
          intent.topic.toLowerCase().includes("population") ||
          intent.topic.toLowerCase().includes("reaction") ||
          intent.topic.toLowerCase().includes("supply") ||
          intent.topic.toLowerCase().includes("demand") ||
          intent.topic.toLowerCase().includes("tax") ||
          intent.topic.toLowerCase().includes("spring") ||
          intent.topic.toLowerCase().includes("orbit") ||
          intent.topic.toLowerCase().includes("gas") ||
          intent.topic.toLowerCase().includes("optic") ||
          intent.topic.toLowerCase().includes("wave") ||
          intent.topic.toLowerCase().includes("fluid") ||
          intent.topic.toLowerCase().includes("sound") ||
          intent.topic.toLowerCase().includes("predator") ||
          intent.topic.toLowerCase().includes("epidemic") ||
          intent.topic.toLowerCase().includes("enzyme") ||
          intent.topic.toLowerCase().includes("genetic") ||
          intent.topic.toLowerCase().includes("photosynthesis") ||
          intent.topic.toLowerCase().includes("loan") ||
          intent.topic.toLowerCase().includes("retire") ||
          intent.topic.toLowerCase().includes("inflation") ||
          intent.topic.toLowerCase().includes("beam") ||
          intent.topic.toLowerCase().includes("heat") ||
          intent.topic.toLowerCase().includes("traffic") ||
          intent.topic.toLowerCase().includes("monte carlo") ||
          intent.topic.toLowerCase().includes("riemann") ||
          intent.topic.toLowerCase().includes("logic") ||
          intent.topic.toLowerCase().includes("neural") ||
          intent.topic.toLowerCase().includes("fractal"))
      ) {
        baseTools.push({
          tool: "simulation",
          reason: "Run interactive simulation",
          priority: 4,
          input: {},
        });
      }
      break;

    default:
      // unclear intent - conservative approach
      baseTools.push({
        tool: "clarifier",
        reason: "Ask for clarification",
        priority: 2,
      });
  }

  // Apply confidence policy to subset tools
  if (!policy.executeFullPlan) {
    if (policy.executionSubset === "conservative") {
      return baseTools.slice(0, 1); // Only retriever
    } else if (policy.executionSubset === "minimal") {
      return baseTools.slice(0, 2); // Retriever + primary tool
    }
  }

  return baseTools;
}

/**
 * Generates execution order from tool recommendations
 */
function generateExecutionOrder(tools: ToolExecutionStep[]): string[] {
  return tools
    .sort((a, b) => a.priority - b.priority)
    .map((tool) => tool.tool);
}

/**
 * Generates a rationale string explaining the plan
 */
function generateRationale(
  intentAnalysis: IntentAnalysis,
  strategy: LearningStrategy,
  policy: ReturnType<typeof applyConfidencePolicy>
): string {
  const confidenceNote =
    policy.level === "high"
      ? "high confidence - running full plan"
      : policy.level === "medium"
        ? "medium confidence - running minimal tools"
        : "low confidence - conservative answer path";

  return `Intent: ${intentAnalysis.intent} (${confidenceNote}). Strategy: ${strategy}. Topic: ${intentAnalysis.topic || "unspecified"}.`;
}

/**
 * Generates a ToolPlan based on intent analysis
 */
export function generateToolPlan(intentAnalysis: IntentAnalysis): ToolPlan {
  const strategy = INTENT_TO_STRATEGY[intentAnalysis.intent] || "mixed";
  const policy = applyConfidencePolicy(intentAnalysis.confidence);
  const recommendedTools = getTooSuggestions(intentAnalysis, policy);
  const executionOrder = generateExecutionOrder(recommendedTools);

  return {
    intent: intentAnalysis.intent,
    strategy,
    recommendedTools,
    executionOrder,
    answerMode:
      intentAnalysis.intent === "quiz"
        ? "quiz"
        : intentAnalysis.intent === "solve"
          ? "step-by-step"
          : "explain",
    teachingStyle:
      intentAnalysis.difficulty === "high"
        ? "challenging"
        : intentAnalysis.difficulty === "low"
          ? "simple"
          : "guided",
    followUpAction:
      intentAnalysis.intent === "quiz"
        ? "quiz"
        : intentAnalysis.intent === "solve"
          ? "example"
          : "none",
    rationale: generateRationale(intentAnalysis, strategy, policy),
    confidence: intentAnalysis.confidence,
  };
}

/**
 * LLM-enhanced planner for high-ambiguity cases
 */
export async function enhancePlanWithLLM(
  baseplan: ToolPlan,
  query: string,
  conversationContext?: string
): Promise<ToolPlan> {
  if (baseplan.confidence >= 0.75) {
    // High confidence - use base plan as-is
    return baseplan;
  }

  console.log("Enhancing plan with LLM due to medium/low confidence");

  const llm = createStudyBuddyLlm({ temperature: 0.3 });

  const systemPrompt = `You are a learning strategy expert. Given a query and initial plan, suggest tool adjustments.
Available tools: retriever, explainer, quiz-generator, slide, diagram, circuit, simulation, memory, validator, summarizer, clarifier, problem-solver.
Return JSON with:
- additionalTools: array of {tool: string, priority: number, reason: string}
- adjustedStrategy: string (explain-simple, step-by-step, visual, interactive, assessment, mixed)
- rationale: string

Return ONLY valid JSON, no markdown.`;

  const userPrompt = `Query: "${query}"
Current Plan: Intent=${baseplan.intent}, Strategy=${baseplan.strategy}, Tools=[${baseplan.executionOrder.join(", ")}]${
    conversationContext ? `\nContext: ${conversationContext}` : ""
  }

Suggest tool adjustments or confirm the current plan.`;

  try {
    const response = await llm.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    const content =
      typeof response.content === "string" ? response.content : response.content.toString();
    const parsed = JSON.parse(content);
    const adjustedStrategy = isLearningStrategy(parsed.adjustedStrategy)
      ? parsed.adjustedStrategy
      : baseplan.strategy;

    // Merge suggestions with base plan
    const enhancedPlan: ToolPlan = {
      ...baseplan,
      recommendedTools: [
        ...baseplan.recommendedTools,
        ...(parsed.additionalTools || []),
      ],
      strategy: adjustedStrategy,
      rationale: parsed.rationale || baseplan.rationale,
    };

    enhancedPlan.executionOrder = generateExecutionOrder(enhancedPlan.recommendedTools);
    return enhancedPlan;
  } catch (error) {
    console.error("LLM plan enhancement failed, using base plan:", error);
    return baseplan;
  }
}
