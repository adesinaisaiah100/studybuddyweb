import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { StudyBuddyAgent } from "@/lib/studyagent/agent";

type AgentTestBody = {
  prompt?: string;
  courseId?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AgentTestBody;
    const prompt = body.prompt?.trim();
    const courseId = body.courseId?.trim();

    if (!prompt || !courseId) {
      return NextResponse.json(
        { success: false, error: "prompt and courseId are required." },
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

    const agentResult = await StudyBuddyAgent(prompt, {
      courseId,
      cookieHeader: req.headers.get("cookie") ?? undefined,
    });

    return NextResponse.json({
      success: true,
      text: agentResult.text,
      message: agentResult.finalMessage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent test failed.";
    console.error("[AgentTestError]", error);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
