import type { IntentAnalysis, IntentType } from "@/lib/ai/study-buddy/types";
import { createStudyBuddyLlm } from "@/lib/ai/study-buddy/orchestrator/llm";

// Keyword mappings for algorithmic intent detection
const INTENT_KEYWORDS: Record<IntentType, string[]> = {
  learn: ["why", "what", "explain", "describe", "tell", "define", "how does", "understand", "know about"],
  solve: ["solve", "calculate", "compute", "find", "answer", "work out", "figure out", "determine"],
  quiz: ["quiz", "test", "practice", "question", "ask", "challenge", "check my knowledge"],
  revise: ["revise", "review", "recap", "summarize", "remind", "refresh", "go over", "relearn"],
  explore: ["explore", "show", "demonstrate", "example", "like", "imagine", "consider"],
  unclear: [],
};

/**
 * Tokenizes and normalizes user input
 */
function tokenizeInput(input: string): string[] {
  return input
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

/**
 * Detects intent based on keywords in the input
 * Returns null if no keywords found (triggers LLM fallback)
 */
function detectIntentFromKeywords(query: string): {
  intent: IntentType;
  confidence: number;
} | null {
  const tokens = tokenizeInput(query);
  const lowerQuery = query.toLowerCase();

  // Check for multi-word keywords first (e.g., "how does", "figure out")
  const multiWordKeywords = [
    { intent: "learn" as IntentType, keywords: ["how does", "how can", "how would", "what is", "what does"] },
    { intent: "solve" as IntentType, keywords: ["work out", "figure out", "solve for"] },
    { intent: "quiz" as IntentType, keywords: ["do i know", "is this correct", "am i right"] },
  ];

  for (const { intent, keywords } of multiWordKeywords) {
    for (const keyword of keywords) {
      if (lowerQuery.includes(keyword)) {
        return { intent, confidence: 0.85 };
      }
    }
  }

  // Check single-word keywords
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (tokens.includes(keyword)) {
        return { intent: intent as IntentType, confidence: 0.8 };
      }
    }
  }

  return null;
}

/**
 * Hybrid intent detection: algorithmic first, LLM fallback
 */
export async function detectIntent(
  query: string,
  conversationContext?: string
): Promise<IntentAnalysis> {
  // Try algorithmic detection first
  const algorithmicResult = detectIntentFromKeywords(query);

  if (algorithmicResult) {
    return {
      intent: algorithmicResult.intent,
      confidence: algorithmicResult.confidence,
      topic: extractTopicFromQuery(query),
    };
  }

  // Fall back to LLM if no keywords matched
  console.log("No keywords matched, falling back to LLM intent detection");
  return detectIntentWithLLM(query, conversationContext);
}

/**
 * LLM-based intent detection with strict JSON output
 */
async function detectIntentWithLLM(
  query: string,
  conversationContext?: string
): Promise<IntentAnalysis> {
  const llm = createStudyBuddyLlm({ temperature: 0.2 });

  const systemPrompt = `You are an educational intent analyzer. Analyze the user's query and return a JSON object with:
- intent: one of "learn", "solve", "quiz", "revise", "explore", or "unclear"
- topic: extracted topic (string or null)
- difficulty: "low", "medium", "high", or "unknown"
- confidence: 0.0 to 1.0

Return ONLY valid JSON, no markdown or extra text.`;

  const userPrompt = `Query: "${query}"${
    conversationContext ? `\nContext: ${conversationContext}` : ""
  }

Analyze this query and return JSON with intent, topic, difficulty, and confidence.`;

  try {
    const response = await llm.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    const content =
      typeof response.content === "string" ? response.content : response.content.toString();
    const parsed = JSON.parse(content);

    return {
      intent: parsed.intent || "unclear",
      topic: parsed.topic,
      difficulty: parsed.difficulty || "unknown",
      confidence: Math.min(parsed.confidence || 0.5, 0.75), // Cap LLM confidence at 0.75
    };
  } catch (error) {
    console.error("LLM intent detection failed:", error);
    return {
      intent: "unclear",
      confidence: 0,
      topic: undefined,
      difficulty: "unknown",
    };
  }
}

/**
 * Simple topic extraction from query
 */
function extractTopicFromQuery(query: string): string | undefined {
  const commonStopwords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "is",
    "are",
    "be",
    "being",
    "been",
    "have",
    "has",
    "do",
    "does",
    "did",
    "can",
    "could",
    "would",
    "should",
    "may",
    "might",
    "must",
    "you",
    "me",
    "he",
    "she",
    "it",
    "we",
    "they",
  ]);

  const tokens = tokenizeInput(query);
  const contentTokens = tokens.filter(
    (token) => !commonStopwords.has(token) && token.length > 2
  );

  return contentTokens.slice(0, 3).join(" ") || undefined;
}

/**
 * Helper to score confidence based on policy
 */
export function applyConfidencePolicy(confidence: number): {
  level: "high" | "medium" | "low";
  executeFullPlan: boolean;
  executionSubset: "minimal" | "standard" | "conservative";
} {
  if (confidence >= 0.75) {
    return {
      level: "high",
      executeFullPlan: true,
      executionSubset: "standard",
    };
  } else if (confidence >= 0.45) {
    return {
      level: "medium",
      executeFullPlan: false,
      executionSubset: "minimal",
    };
  } else {
    return {
      level: "low",
      executeFullPlan: false,
      executionSubset: "conservative",
    };
  }
}
