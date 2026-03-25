import { END, START, StateGraph } from "@langchain/langgraph";
import {
  clampReviewLoops,
  LAUNCH_CRITIQUE_PASS_THRESHOLD,
} from "@/lib/ai/study-buddy/orchestrator/constants";
import {
  createInitialGraphState,
  StudyBuddyGraphState,
  type StudyBuddyGraphStateType,
} from "@/lib/ai/study-buddy/orchestrator/state";
import {
  executeAllowlistedTool,
  isAllowlistedTool,
} from "@/lib/ai/study-buddy/orchestrator/tool-registry";
import {
  getToolExecutionBudget,
  hasBudgetRemaining,
} from "@/lib/ai/study-buddy/orchestrator/tool-policy";
import { detectIntent } from "@/lib/ai/study-buddy/orchestrator/intent-detector";
import {
  generateToolPlan,
  enhancePlanWithLLM,
} from "@/lib/ai/study-buddy/orchestrator/planner";
import type {
  StudyBuddyOrchestratorInput,
  StudyBuddyOrchestratorOutput,
  ToolExecutionStep,
  ToolResult,
} from "@/lib/ai/study-buddy/types";

async function initNode(state: StudyBuddyGraphStateType) {
  const maxIterations = clampReviewLoops(state.input.maxReviewLoops);

  return {
    iterationState: {
      ...state.iterationState,
      maxIterations,
    },
  };
}

async function intentNode(state: StudyBuddyGraphStateType) {
  // Build conversation context from history
  const conversationContext =
    state.input.conversationHistory.length > 0
      ? state.input.conversationHistory
          .slice(-3) // Last 3 messages
          .map((msg) => `${msg.role}: ${msg.content}`)
          .join("\n")
      : undefined;

  // Hybrid intent detection: algorithmic first, LLM fallback
  const intentAnalysis = await detectIntent(
    state.input.query,
    conversationContext
  );

  console.log(
    `[Intent Detection] Query: "${state.input.query}" -> Intent: ${intentAnalysis.intent} (confidence: ${intentAnalysis.confidence.toFixed(2)})`
  );

  return {
    intentAnalysis,
  };
}

async function plannerNode(state: StudyBuddyGraphStateType) {
  if (!state.intentAnalysis) {
    throw new Error("Intent analysis must be completed before planning");
  }

  // Generate base tool plan from intent
  let toolPlan = generateToolPlan(state.intentAnalysis);

  // If medium confidence, enhance with LLM for safety
  if (state.intentAnalysis.confidence < 0.75) {
    const conversationContext =
      state.input.conversationHistory.length > 0
        ? state.input.conversationHistory
            .slice(-2)
            .map((msg) => `${msg.role}: ${msg.content}`)
            .join("\n")
        : undefined;

    toolPlan = await enhancePlanWithLLM(
      toolPlan,
      state.input.query,
      conversationContext
    );
  }

  console.log(
    `[Tool Planning] Strategy: ${toolPlan.strategy}, Tools: [${toolPlan.executionOrder.join(", ")}]`
  );

  return {
    toolPlan,
  };
}

function getOrderedToolSteps(state: StudyBuddyGraphStateType): ToolExecutionStep[] {
  if (!state.toolPlan) return [];

  const byName = new Map(state.toolPlan.recommendedTools.map((step) => [step.tool, step]));
  const ordered = state.toolPlan.executionOrder
    .map((tool) => byName.get(tool))
    .filter((step): step is ToolExecutionStep => !!step);

  if (ordered.length > 0) return ordered;

  return [...state.toolPlan.recommendedTools].sort((a, b) => a.priority - b.priority);
}

async function toolExecNode(state: StudyBuddyGraphStateType) {
  const orderedSteps = getOrderedToolSteps(state);
  const budget = getToolExecutionBudget();
  const nodeStartedAt = Date.now();

  const toolResults: ToolResult[] = [];
  let retrieval = state.retrieval;
  let callsUsed = 0;
  let usedFallback = false;

  for (const step of orderedSteps) {
    const elapsedMs = Date.now() - nodeStartedAt;
    if (!hasBudgetRemaining({ callsUsed, elapsedMs, budget })) {
      break;
    }

    if (!isAllowlistedTool(step.tool)) {
      toolResults.push({
        tool: step.tool,
        success: false,
        output: { message: "Tool blocked by allowlist." },
        latencyMs: 0,
      });
      continue;
    }

    const timeoutMs = Math.max(250, budget.timeoutMs - elapsedMs);
    const { result, retrieval: retrievalUpdate } = await executeAllowlistedTool({
      step,
      state,
      timeoutMs,
    });

    toolResults.push(result);
    if (retrievalUpdate) {
      retrieval = retrievalUpdate;
    }
    callsUsed += 1;
  }

  const hasFailures = toolResults.some((result) => !result.success);

  if (!retrieval) {
    const { result, retrieval: retrievalUpdate } = await executeAllowlistedTool({
      step: {
        tool: "retriever",
        reason: "Fallback retrieval-only mode",
        priority: 1,
      },
      state,
      timeoutMs: budget.timeoutMs,
    });

    usedFallback = true;
    toolResults.push(result);
    retrieval = retrievalUpdate ?? {
      materialHits: [],
      conversationHits: [],
      usedCache: false,
    };
  }

  const usedTools = toolResults
    .filter((result) => result.success)
    .map((result) => result.tool);

  const errors = [...state.errors];
  if (hasFailures) {
    errors.push("One or more tools failed. Used safe fallback behavior.");
  }

  return {
    toolResults,
    retrieval,
    errors,
    draft: {
      answer: usedFallback
        ? "Execution switched to retrieval-only mode to keep the response reliable."
        : "Tool execution completed with normalized outputs.",
      usedTools,
      toolOutputs: toolResults,
    },
  };
}

function createStudyBuddyGraphSkeleton() {
  return new StateGraph(StudyBuddyGraphState)
    .addNode("init", initNode)
    .addNode("intent", intentNode)
    .addNode("planner", plannerNode)
    .addNode("tool_exec", toolExecNode)
    .addEdge(START, "init")
    .addEdge("init", "intent")
    .addEdge("intent", "planner")
    .addEdge("planner", "tool_exec")
    .addEdge("tool_exec", END)
    .compile();
}

export async function runStudyBuddyOrchestrator(
  input: StudyBuddyOrchestratorInput
): Promise<StudyBuddyOrchestratorOutput> {
  const graph = createStudyBuddyGraphSkeleton();
  const result = await graph.invoke(createInitialGraphState(input));

  const retrieval = result.retrieval ?? {
    materialHits: [],
    conversationHits: [],
    usedCache: false,
  };

  return {
    answer:
      result.draft?.answer ||
      "Study Buddy orchestrator Phase 3 executed tools with budgeted allowlist policy.",
    toolPlan: result.toolPlan || {
      intent: "unclear",
      strategy: "mixed",
      recommendedTools: [],
      executionOrder: [],
      answerMode: "explain",
      teachingStyle: "guided",
      followUpAction: "none",
      rationale: "Phase 03 fallback tool plan.",
      confidence: 0.5,
    },
    critique: {
      passed: false,
      score: 0,
      clarity: 0,
      correctness: 0,
      pedagogy: 0,
      feedback: `Phase 03 completed. Intent: ${result.intentAnalysis?.intent || "unclear"}. Tools executed: ${result.draft?.usedTools.join(", ") || "none"}. Current launch threshold is ${LAUNCH_CRITIQUE_PASS_THRESHOLD}.`,
    },
    iterations: result.iterationState.iteration,
    understandingUpdate: result.understandingUpdate ?? undefined,
    sources: retrieval.materialHits.slice(0, 6).map((item) => ({
      materialId: item.materialId,
      materialTitle: item.materialTitle,
      snippet: item.content.slice(0, 240),
      retrievalMode: item.retrievalMode,
    })),
    retrieval: {
      materialCount: retrieval.materialHits.length,
      conversationCount: retrieval.conversationHits.length,
      usedCache: retrieval.usedCache,
    },
  };
}
