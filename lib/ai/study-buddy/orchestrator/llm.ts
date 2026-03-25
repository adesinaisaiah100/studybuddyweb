import { ChatOpenAI } from "@langchain/openai";

function getOpenRouterApiKey() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY env variable.");
  }
  return apiKey;
}

export function getStudyBuddyModelName() {
  return process.env.OPENROUTER_STUDY_BUDDY_MODEL || process.env.OPENROUTER_OUTLINE_MODEL;
}

export function createStudyBuddyLlm(options?: { temperature?: number }) {
  const modelName = getStudyBuddyModelName();
  if (!modelName) {
    throw new Error("Missing OPENROUTER_STUDY_BUDDY_MODEL (or OPENROUTER_OUTLINE_MODEL fallback) env variable.");
  }

  return new ChatOpenAI({
    modelName,
    temperature: options?.temperature ?? 0.2,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: getOpenRouterApiKey(),
    },
  });
}
