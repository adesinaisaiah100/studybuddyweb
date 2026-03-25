import type { createClient } from "@/lib/supabase/server";

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type StudyBuddyUserPreferences = {
  responseStyle?: "concise" | "detailed";
  preferredTools?: string[];
  includeMathLatex?: boolean;
  includeQuizWhenHelpful?: boolean;
  tone?: "encouraging" | "neutral";
};

export type StudyBuddyChatMessage = {
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
};

export type RetrievedContextItem = {
  id: string;
  content: string;
  materialTitle?: string;
  materialId?: string;
  score: number;
  retrievalMode: "vector" | "keyword" | "conversation-vector" | "conversation-keyword";
};

export type RetrievalBundle = {
  materialHits: RetrievedContextItem[];
  conversationHits: RetrievedContextItem[];
  usedCache: boolean;
};

export type IntentType =
  | "learn"
  | "solve"
  | "quiz"
  | "revise"
  | "explore"
  | "unclear";

export type LearningStrategy =
  | "explain-simple"
  | "step-by-step"
  | "visual"
  | "interactive"
  | "assessment"
  | "mixed";

export type IntentAnalysis = {
  intent: IntentType;
  topic?: string;
  subject?: string;
  difficulty?: "low" | "medium" | "high" | "unknown";
  confidence: number;
};

export type UnderstandingState = {
  topic: string;
  mastery: number;
  confidenceGap?: number;
  lastUpdated: string;
  weakAreas?: string[];
};

export type ToolExecutionStep = {
  tool: string;
  reason: string;
  priority: number;
  input?: Record<string, unknown>;
};

export type ToolResult = {
  tool: string;
  success: boolean;
  output: unknown;
  latencyMs?: number;
};

export type IterationState = {
  iteration: number;
  maxIterations: number;
  previousFeedback?: string;
};

export type ToolPlan = {
  intent: IntentType;
  strategy: LearningStrategy;
  recommendedTools: ToolExecutionStep[];
  executionOrder: string[];
  answerMode: "explain" | "step-by-step" | "quiz" | "mixed";
  teachingStyle: "simple" | "guided" | "challenging";
  followUpAction?: "quiz" | "example" | "simulation" | "none";
  rationale: string;
  confidence: number;
};

export type StudyBuddyDraft = {
  answer: string;
  usedTools: string[];
  toolOutputs?: ToolResult[];
};

export type CritiqueResult = {
  passed: boolean;
  score: number;
  clarity: number;
  correctness: number;
  pedagogy: number;
  feedback: string;
};

export type StudyBuddyOrchestratorInput = {
  courseId: string;
  query: string;
  conversationHistory: StudyBuddyChatMessage[];
  userPreferences?: StudyBuddyUserPreferences;
  maxReviewLoops?: number;
};

export type StudyBuddyOrchestratorOutput = {
  answer: string;
  toolPlan: ToolPlan;
  critique: CritiqueResult;
  iterations: number;
  understandingUpdate?: UnderstandingState;
  sources: Array<{
    materialId?: string;
    materialTitle?: string;
    snippet: string;
    retrievalMode: RetrievedContextItem["retrievalMode"];
  }>;
  retrieval: {
    materialCount: number;
    conversationCount: number;
    usedCache: boolean;
  };
};
