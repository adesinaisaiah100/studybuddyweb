import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  StudyBuddyAgent,
  type StudyBuddyChatHistoryMessage,
} from "@/lib/studyagent/agent";
import {
  buildSessionTitle,
  estimateTokenCount,
  extractTextFromAssistantMessage,
} from "@/lib/studyagent/chatUtils";
import { triggerCompaction } from "@/lib/studyagent/chatCompaction";

const SESSION_COMPACTION_THRESHOLD = 6000;

type ChatRequestBody = {
  message?: string;
  courseId?: string;
  sessionId?: string;
};

type ChatSessionRow = {
  id: string;
  user_id: string;
  course_id: string;
  title: string;
  summary: string | null;
  total_tokens: number | null;
  is_compacted: boolean | null;
  compacted_through_message_id: string | null;
};

type ChatMessageRow = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tokens?: number;
  created_at: string;
};

function buildAgentHistory(params: {
  allMessages: ChatMessageRow[];
  currentMessageId: string;
  compactedThroughMessageId: string | null;
}): StudyBuddyChatHistoryMessage[] {
  const priorMessages = params.allMessages.filter(
    (message) =>
      message.id !== params.currentMessageId &&
      (message.role === "user" || message.role === "assistant"),
  );

  if (!params.compactedThroughMessageId) {
    return priorMessages.map((row) => ({
      role: row.role as "user" | "assistant",
      content: row.content,
      createdAt: row.created_at,
    }));
  }

  const boundaryIndex = priorMessages.findIndex(
    (message) => message.id === params.compactedThroughMessageId,
  );
  const activeMessages =
    boundaryIndex >= 0 ? priorMessages.slice(boundaryIndex + 1) : priorMessages;

  return activeMessages.map((row) => ({
    role: row.role as "user" | "assistant",
    content: row.content,
    createdAt: row.created_at,
  }));
}

function logMessageTokens(params: {
  requestId: string;
  sessionId: string;
  role: "user" | "assistant";
  tokens: number;
  totalTokens: number;
  usage?: unknown;
}) {
  console.log("[ChatAPI] message_tokens", params);
}

export async function POST(req: Request) {
  try {
    const requestId = crypto.randomUUID();
    const body = (await req.json()) as ChatRequestBody;
    const message = body.message?.trim();
    const courseId = body.courseId?.trim();
    const sessionId = body.sessionId?.trim();

    if (!message || !courseId) {
      return NextResponse.json(
        { success: false, error: "message and courseId are required." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { data: ownedCourse } = await supabase
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!ownedCourse?.id) {
      return NextResponse.json(
        { success: false, error: "Course not found for this user." },
        { status: 404 },
      );
    }

    let session: ChatSessionRow | null = null;

    if (sessionId) {
      const { data: existingSession, error: sessionError } = await supabase
        .from("chat_sessions")
        .select("id, user_id, course_id, title, summary, total_tokens, is_compacted, compacted_through_message_id")
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (sessionError) {
        throw sessionError;
      }

      if (!existingSession) {
        return NextResponse.json(
          { success: false, error: "Chat session not found." },
          { status: 404 },
        );
      }

      if (existingSession.course_id !== courseId) {
        return NextResponse.json(
          {
            success: false,
            error: "The provided courseId does not match this chat session.",
          },
          { status: 400 },
        );
      }

      session = existingSession as ChatSessionRow;
    } else {
      const { data: createdSession, error: createSessionError } = await supabase
        .from("chat_sessions")
        .insert({
          user_id: user.id,
          course_id: courseId,
          title: buildSessionTitle(message),
        })
        .select("id, user_id, course_id, title, summary, total_tokens, is_compacted, compacted_through_message_id")
        .single();

      if (createSessionError) {
        throw createSessionError;
      }

      session = createdSession as ChatSessionRow;
    }

    const userTokens = estimateTokenCount(message);
    const { data: savedUserMessage, error: insertUserMessageError } = await supabase
      .from("chat_messages")
      .insert({
        session_id: session.id,
        role: "user",
        content: message,
        tokens: userTokens,
      })
      .select("id, role, content, created_at")
      .single();

    if (insertUserMessageError) {
      throw insertUserMessageError;
    }

    const totalTokensAfterUserMessage = (session.total_tokens ?? 0) + userTokens;
    const { error: updateAfterUserError } = await supabase
      .from("chat_sessions")
      .update({ total_tokens: totalTokensAfterUserMessage })
      .eq("id", session.id)
      .eq("user_id", user.id);

    if (updateAfterUserError) {
      throw updateAfterUserError;
    }

    logMessageTokens({
      requestId,
      sessionId: session.id,
      role: "user",
      tokens: userTokens,
      totalTokens: totalTokensAfterUserMessage,
    });

    if (totalTokensAfterUserMessage >= SESSION_COMPACTION_THRESHOLD) {
      console.warn("[ChatAPI] compaction_threshold_reached", {
        requestId,
        sessionId: session.id,
        totalTokens: totalTokensAfterUserMessage,
        threshold: SESSION_COMPACTION_THRESHOLD,
      });
    }

    const { data: allMessages, error: priorMessagesError } = await supabase
      .from("chat_messages")
      .select("id, role, content, tokens, created_at")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true });

    if (priorMessagesError) {
      throw priorMessagesError;
    }

    const history = buildAgentHistory({
      allMessages: (allMessages ?? []) as ChatMessageRow[],
      currentMessageId: savedUserMessage.id,
      compactedThroughMessageId: session.compacted_through_message_id,
    });

    const agentResult = await StudyBuddyAgent(message, {
      courseId,
      cookieHeader: req.headers.get("cookie") ?? undefined,
      history,
      sessionSummary: session.summary,
    });

    const assistantText =
      agentResult.text || extractTextFromAssistantMessage(agentResult.finalMessage);
    const assistantTokens =
      agentResult.finalMessage.usage.output > 0
        ? agentResult.finalMessage.usage.output
        : estimateTokenCount(assistantText);

    const { error: insertAssistantMessageError } = await supabase
      .from("chat_messages")
      .insert({
        session_id: session.id,
        role: "assistant",
        content: assistantText,
        tokens: assistantTokens,
      });

    if (insertAssistantMessageError) {
      throw insertAssistantMessageError;
    }

    const totalTokens = totalTokensAfterUserMessage + assistantTokens;
    const { error: updateAfterAssistantError } = await supabase
      .from("chat_sessions")
      .update({
        total_tokens: totalTokens,
        is_compacted: false,
      })
      .eq("id", session.id)
      .eq("user_id", user.id);

    if (updateAfterAssistantError) {
      throw updateAfterAssistantError;
    }

    logMessageTokens({
      requestId,
      sessionId: session.id,
      role: "assistant",
      tokens: assistantTokens,
      totalTokens,
      usage: agentResult.finalMessage.usage,
    });

    let finalTotalTokens = totalTokens;
    let compaction:
      | {
          skipped: boolean;
          reason?: string;
          compactedMessageCount: number;
          retainedRecentMessageCount: number;
        }
      | undefined;

    if (totalTokens >= SESSION_COMPACTION_THRESHOLD) {
      console.warn("[ChatAPI] compaction_threshold_reached", {
        requestId,
        sessionId: session.id,
        totalTokens,
        threshold: SESSION_COMPACTION_THRESHOLD,
      });

      const compactionResult = await triggerCompaction(session.id);
      finalTotalTokens = compactionResult.activeTotalTokens;
      compaction = {
        skipped: compactionResult.skipped,
        reason: compactionResult.reason,
        compactedMessageCount: compactionResult.compactedMessageCount,
        retainedRecentMessageCount: compactionResult.retainedRecentMessageCount,
      };
    }

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      title: session.title,
      totalTokens: finalTotalTokens,
      assistant: {
        role: "assistant",
        content: assistantText,
        tokens: assistantTokens,
      },
      usage: agentResult.finalMessage.usage,
      compaction,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Chat request failed.";
    console.error("[ChatAPI] unhandled_error", error);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
