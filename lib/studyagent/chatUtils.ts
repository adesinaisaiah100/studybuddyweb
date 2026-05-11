import type { AssistantMessage } from "@mariozechner/pi-ai";

export function estimateTokenCount(content: string): number {
  const trimmed = content.trim();

  if (!trimmed) {
    return 0;
  }

  // Lightweight approximation for storage/thresholding when provider-side
  // per-message tokenization is unavailable.
  return Math.max(1, Math.ceil(trimmed.length / 4));
}

export function buildSessionTitle(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "New chat";
  }

  return normalized.length > 80
    ? `${normalized.slice(0, 77).trimEnd()}...`
    : normalized;
}

export function extractTextFromAssistantMessage(
  message: AssistantMessage,
): string {
  return message.content
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("\n\n")
    .trim();
}
