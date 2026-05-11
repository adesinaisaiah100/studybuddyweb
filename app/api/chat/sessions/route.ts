import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ChatSessionListRow = {
  id: string;
  course_id: string;
  title: string;
  summary: string | null;
  total_tokens: number;
  is_compacted: boolean;
  compacted_through_message_id: string | null;
  created_at: string;
  updated_at: string;
};

type SessionListItem = {
  id: string;
  courseId: string;
  title: string;
  preview: string | null;
  totalTokens: number;
  isCompacted: boolean;
  hasSummary: boolean;
  compactedThroughMessageId: string | null;
  createdAt: string;
  updatedAt: string;
};

function buildPreview(session: ChatSessionListRow): string | null {
  const source = session.summary?.trim() || session.title?.trim();

  if (!source) {
    return null;
  }

  return source.length > 140 ? `${source.slice(0, 137).trimEnd()}...` : source;
}

export async function GET(req: Request) {
  try {
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

    const url = new URL(req.url);
    const courseId = url.searchParams.get("courseId")?.trim();
    const limitParam = Number(url.searchParams.get("limit"));
    const limit =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(Math.floor(limitParam), 100)
        : 50;

    let query = supabase
      .from("chat_sessions")
      .select(
        "id, course_id, title, summary, total_tokens, is_compacted, compacted_through_message_id, created_at, updated_at",
      )
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (courseId) {
      query = query.eq("course_id", courseId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const sessions = ((data ?? []) as ChatSessionListRow[]).map<SessionListItem>(
      (session) => ({
        id: session.id,
        courseId: session.course_id,
        title: session.title,
        preview: buildPreview(session),
        totalTokens: session.total_tokens ?? 0,
        isCompacted: Boolean(session.is_compacted),
        hasSummary: Boolean(session.summary?.trim()),
        compactedThroughMessageId: session.compacted_through_message_id,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
      }),
    );

    return NextResponse.json({
      success: true,
      sessions,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch chat sessions.";
    console.error("[ChatSessionsAPI] unhandled_error", error);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
