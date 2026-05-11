import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

type ChatSessionRow = {
  id: string;
  user_id: string;
  course_id: string;
  title: string;
  summary: string | null;
  total_tokens: number;
  is_compacted: boolean;
  compacted_through_message_id: string | null;
  created_at: string;
  updated_at: string;
};

type ChatMessageRow = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tokens: number;
  created_at: string;
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;

    if (!sessionId?.trim()) {
      return NextResponse.json(
        { success: false, error: "sessionId is required." },
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

    const { data: session, error: sessionError } = await supabase
      .from("chat_sessions")
      .select(
        "id, user_id, course_id, title, summary, total_tokens, is_compacted, compacted_through_message_id, created_at, updated_at",
      )
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (sessionError) {
      throw sessionError;
    }

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Chat session not found." },
        { status: 404 },
      );
    }

    const { data: messages, error: messagesError } = await supabase
      .from("chat_messages")
      .select("id, role, content, tokens, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      throw messagesError;
    }

    const typedSession = session as ChatSessionRow;
    const typedMessages = (messages ?? []) as ChatMessageRow[];

    return NextResponse.json({
      success: true,
      session: {
        id: typedSession.id,
        courseId: typedSession.course_id,
        title: typedSession.title,
        summary: typedSession.summary,
        totalTokens: typedSession.total_tokens ?? 0,
        isCompacted: Boolean(typedSession.is_compacted),
        compactedThroughMessageId: typedSession.compacted_through_message_id,
        createdAt: typedSession.created_at,
        updatedAt: typedSession.updated_at,
      },
      messages: typedMessages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        tokens: message.tokens ?? 0,
        createdAt: message.created_at,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch chat session.";
    console.error("[ChatSessionDetailAPI] unhandled_error", error);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
