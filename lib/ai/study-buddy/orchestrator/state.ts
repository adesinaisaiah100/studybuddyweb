import { Annotation } from "@langchain/langgraph";
import type {
  CritiqueResult,
  IntentAnalysis,
  IterationState,
  RetrievalBundle,
  StudyBuddyDraft,
  StudyBuddyOrchestratorInput,
  ToolPlan,
  ToolResult,
  UnderstandingState,
} from "@/lib/ai/study-buddy/types";

export const StudyBuddyGraphState = Annotation.Root({
  input: Annotation<StudyBuddyOrchestratorInput>(),
  intentAnalysis: Annotation<IntentAnalysis | null>(),
  retrieval: Annotation<RetrievalBundle | null>(),
  toolPlan: Annotation<ToolPlan | null>(),
  toolResults: Annotation<ToolResult[]>(),
  draft: Annotation<StudyBuddyDraft | null>(),
  critique: Annotation<CritiqueResult | null>(),
  understandingUpdate: Annotation<UnderstandingState | null>(),
  iterationState: Annotation<IterationState>(),
  errors: Annotation<string[]>(),
  startedAtMs: Annotation<number>(),
});

export type StudyBuddyGraphStateType = typeof StudyBuddyGraphState.State;

export function createInitialGraphState(input: StudyBuddyOrchestratorInput): StudyBuddyGraphStateType {
  return {
    input,
    intentAnalysis: null,
    retrieval: null,
    toolPlan: null,
    toolResults: [],
    draft: null,
    critique: null,
    understandingUpdate: null,
    iterationState: {
      iteration: 0,
      maxIterations: input.maxReviewLoops ?? 2,
    },
    errors: [],
    startedAtMs: Date.now(),
  };
}
