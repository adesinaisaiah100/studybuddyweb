import { completeSimple, getModel } from "@mariozechner/pi-ai";
import { createClient } from "@/lib/supabase/server";
import {
  estimateTokenCount,
  extractTextFromAssistantMessage,
} from "@/lib/studyagent/chatUtils";

const RETAINED_RECENT_TURNS = 4;
const RECENT_RAW_MESSAGE_COUNT = RETAINED_RECENT_TURNS * 2;

const COMPACTION_SYSTEM_PROMPT = `You are compacting a study chat session for future reuse.

Your job is to rewrite the conversation into a shorter transcript that preserves the original back-and-forth structure.

Rules:
- Keep the output in chat format only.
- Alternate turns as:
  User: ...
  Assistant: ...
- Summarize each turn faithfully.
- Preserve important academic content:
  - definitions
  - formulas
  - assumptions
  - examples
  - corrections
  - unresolved questions
  - study goals or preferences from the user
- Preserve course-specific context when present.
- Do not invent turns that did not happen.
- Do not add commentary outside the transcript.
- Compress aggressively, but keep enough detail so a future assistant can continue the conversation naturally.
- If an earlier summary exists, merge it with the new messages into one coherent summarized transcript.
- Summarize only the provided older messages.
- Do not reference later turns that are not included.`;

type ChatSessionRow = {
  id: string;
  summary: string | null;
  total_tokens: number;
  compacted_through_message_id: string | null;
};

type ChatMessageRow = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tokens: number;
  created_at: string;
};

export type ChatCompactionResult = {
  success: boolean;
  skipped: boolean;
  reason?:
    | "session_not_found"
    | "not_enough_messages"
    | "nothing_new_to_compact"
    | "already_up_to_date";
  sessionId: string;
  compactedMessageCount: number;
  retainedRecentMessageCount: number;
  compactedThroughMessageId: string | null;
  summary: string | null;
  activeTotalTokens: number;
};

function formatTranscript(messages: ChatMessageRow[]): string {
  return messages
    .map((message) => {
      const speaker = message.role === "assistant" ? "Assistant" : "User";
      return `${speaker}: ${message.content.trim()}`;
    })
    .join("\n\n");
}

async function generateCompactedSummary(params: {
  existingSummary: string | null;
  transcript: string;
  sessionId: string;
}): Promise<string> {
  const model = getModel("google", "gemini-2.5-flash-lite");
  const prompt = `Existing summarized transcript:
${params.existingSummary?.trim() || "None"}

Messages to compact:
${params.transcript}

Return the new compacted transcript only.`;

  const response = await completeSimple(
    model,
    {
      systemPrompt: COMPACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: prompt,
          timestamp: Date.now(),
        },
      ],
    },
    {
      reasoning: "low",
      sessionId: `chat-compaction:${params.sessionId}`,
    },
  );

  const text = extractTextFromAssistantMessage(response).trim();
  if (!text) {
    throw new Error("Compaction summary generation returned empty output.");
  }

  return text;
}

function findBoundaryIndex(
  messages: ChatMessageRow[],
  compactedThroughMessageId: string | null,
): number {
  if (!compactedThroughMessageId) {
    return -1;
  }

  return messages.findIndex((message) => message.id === compactedThroughMessageId);
}

export async function triggerCompaction(
  sessionId: string,
): Promise<ChatCompactionResult> {
  const supabase = await createClient();

  const { data: session, error: sessionError } = await supabase
    .from("chat_sessions")
    .select("id, summary, total_tokens, compacted_through_message_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) {
    throw sessionError;
  }

  if (!session) {
    return {
      success: false,
      skipped: true,
      reason: "session_not_found",
      sessionId,
      compactedMessageCount: 0,
      retainedRecentMessageCount: 0,
      compactedThroughMessageId: null,
      summary: null,
      activeTotalTokens: 0,
    };
  }

  const typedSession = session as ChatSessionRow;

  const { data: allMessages, error: messagesError } = await supabase
    .from("chat_messages")
    .select("id, role, content, tokens, created_at")
    .eq("session_id", sessionId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true });

  if (messagesError) {
    throw messagesError;
  }

  const eligibleMessages = (allMessages ?? []) as ChatMessageRow[];

  if (eligibleMessages.length <= RECENT_RAW_MESSAGE_COUNT) {
    return {
      success: false,
      skipped: true,
      reason: "not_enough_messages",
      sessionId,
      compactedMessageCount: 0,
      retainedRecentMessageCount: eligibleMessages.length,
      compactedThroughMessageId: typedSession.compacted_through_message_id,
      summary: typedSession.summary,
      activeTotalTokens: typedSession.total_tokens ?? 0,
    };
  }

  const retainedStartIndex = Math.max(
    eligibleMessages.length - RECENT_RAW_MESSAGE_COUNT,
    0,
  );
  const retainedMessages = eligibleMessages.slice(retainedStartIndex);
  const previousBoundaryIndex = findBoundaryIndex(
    eligibleMessages,
    typedSession.compacted_through_message_id,
  );
  const compactStartIndex = previousBoundaryIndex + 1;
  const compactableMessages = eligibleMessages.slice(
    compactStartIndex,
    retainedStartIndex,
  );

  if (compactableMessages.length === 0) {
    return {
      success: false,
      skipped: true,
      reason: previousBoundaryIndex >= 0 ? "already_up_to_date" : "nothing_new_to_compact",
      sessionId,
      compactedMessageCount: 0,
      retainedRecentMessageCount: retainedMessages.length,
      compactedThroughMessageId: typedSession.compacted_through_message_id,
      summary: typedSession.summary,
      activeTotalTokens: typedSession.total_tokens ?? 0,
    };
  }

  const transcript = formatTranscript(compactableMessages);
  const summary = await generateCompactedSummary({
    existingSummary: typedSession.summary,
    transcript,
    sessionId,
  });

  const compactedThroughMessageId =
    compactableMessages[compactableMessages.length - 1]?.id ?? null;
  const summaryTokens = estimateTokenCount(summary);
  const retainedTokens = retainedMessages.reduce(
    (sum, message) => sum + (message.tokens ?? estimateTokenCount(message.content)),
    0,
  );
  const activeTotalTokens = summaryTokens + retainedTokens;

  const { error: updateError } = await supabase
    .from("chat_sessions")
    .update({
      summary,
      is_compacted: true,
      compacted_through_message_id: compactedThroughMessageId,
      total_tokens: activeTotalTokens,
    })
    .eq("id", sessionId);

  if (updateError) {
    throw updateError;
  }

  console.log("[ChatCompaction] success", {
    sessionId,
    compactedMessageCount: compactableMessages.length,
    retainedRecentMessageCount: retainedMessages.length,
    compactedThroughMessageId,
    activeTotalTokens,
  });

  return {
    success: true,
    skipped: false,
    sessionId,
    compactedMessageCount: compactableMessages.length,
    retainedRecentMessageCount: retainedMessages.length,
    compactedThroughMessageId,
    summary,
    activeTotalTokens,
  };
}
