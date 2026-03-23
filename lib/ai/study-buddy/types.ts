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

export type ToolPlan = {
  recommendedTools: string[];
  answerMode: "explain" | "step-by-step" | "quiz" | "mixed";
  rationale: string;
  confidence: number;
};

export type StudyBuddyDraft = {
  answer: string;
  usedTools: string[];
};

export type CritiqueResult = {
  passed: boolean;
  score: number;
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
  sources: Array<{
    materialId?: string;
    materialTitle?: string;
    snippet: string;
    retrievalMode: string;
  }>;
  retrieval: {
    materialCount: number;
    conversationCount: number;
    usedCache: boolean;
  };
};
