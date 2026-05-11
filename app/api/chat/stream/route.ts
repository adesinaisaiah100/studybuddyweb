import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createStudyBuddyRuntime,
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

export async function POST(req: Request) {
  try {
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
      .select("id, code, title")
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
        .select(
          "id, user_id, course_id, title, summary, total_tokens, is_compacted, compacted_through_message_id",
        )
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
        .select(
          "id, user_id, course_id, title, summary, total_tokens, is_compacted, compacted_through_message_id",
        )
        .single();

      if (createSessionError) {
        throw createSessionError;
      }

      session = createdSession as ChatSessionRow;
    }

    const userTokens = estimateTokenCount(message);
    const { data: savedUserMessage, error: insertUserMessageError } =
      await supabase
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

    const { data: allMessages, error: messagesError } = await supabase
      .from("chat_messages")
      .select("id, role, content, tokens, created_at")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true });

    if (messagesError) {
      throw messagesError;
    }

    const history = buildAgentHistory({
      allMessages: (allMessages ?? []) as ChatMessageRow[],
      currentMessageId: savedUserMessage.id,
      compactedThroughMessageId: session.compacted_through_message_id,
    });

    const studyAgent = createStudyBuddyRuntime({
      courseId,
      cookieHeader: req.headers.get("cookie") ?? undefined,
      history,
      sessionSummary: session.summary,
    });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let finalAssistantText = "";
        let finalAssistantUsage:
          | {
              input: number;
              output: number;
              cacheRead: number;
              cacheWrite: number;
              totalTokens: number;
              cost: {
                input: number;
                output: number;
                cacheRead: number;
                cacheWrite: number;
                total: number;
              };
            }
          | null = null;

        const send = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        };

        send("session", {
          sessionId: session.id,
          title: session.title,
          courseId: session.course_id,
          courseLabel: ownedCourse.code
            ? `${ownedCourse.code} - ${ownedCourse.title}`
            : ownedCourse.title,
        });

        const unsubscribe = studyAgent.subscribe((evt) => {
          if (
            evt.type === "message_update" &&
            evt.assistantMessageEvent.type === "text_delta"
          ) {
            send("text_delta", {
              delta: evt.assistantMessageEvent.delta,
            });
          } else if (evt.type === "tool_execution_update") {
            send("tool_progress", {
              toolCallId: evt.toolCallId,
              toolName: evt.toolName,
              partialResult: evt.partialResult,
            });
          }
        });

        try {
          await studyAgent.prompt(message);

          const finalMessage =
            studyAgent.state.messages[studyAgent.state.messages.length - 1];

          if (!finalMessage || finalMessage.role !== "assistant") {
            throw new Error(
              "Study Buddy did not return a final assistant message.",
            );
          }

          finalAssistantText = extractTextFromAssistantMessage(finalMessage);
          finalAssistantUsage = finalMessage.usage;

          const assistantTokens =
            finalMessage.usage.output > 0
              ? finalMessage.usage.output
              : estimateTokenCount(finalAssistantText);

          const { error: insertAssistantMessageError } = await supabase
            .from("chat_messages")
            .insert({
              session_id: session.id,
              role: "assistant",
              content: finalAssistantText,
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
            const compactionResult = await triggerCompaction(session.id);
            finalTotalTokens = compactionResult.activeTotalTokens;
            compaction = {
              skipped: compactionResult.skipped,
              reason: compactionResult.reason,
              compactedMessageCount: compactionResult.compactedMessageCount,
              retainedRecentMessageCount:
                compactionResult.retainedRecentMessageCount,
            };
          }

          send("message_end", {
            sessionId: session.id,
            message: {
              id: crypto.randomUUID(),
              role: "assistant",
              content: finalAssistantText,
              tokens:
                finalAssistantUsage?.output > 0
                  ? finalAssistantUsage.output
                  : estimateTokenCount(finalAssistantText),
              createdAt: new Date().toISOString(),
            },
            usage: finalAssistantUsage,
            totalTokens: finalTotalTokens,
            compaction,
          });
          send("done", { ok: true, sessionId: session.id });
        } catch (error) {
          const messageText =
            error instanceof Error ? error.message : "Chat stream failed.";
          send("error", {
            message: messageText,
            sessionId: session.id,
            partialText: finalAssistantText,
          });
        } finally {
          unsubscribe();
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Chat stream failed.";
    console.error("[ChatStreamAPI] unhandled_error", error);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
