import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const courseId = url.searchParams.get("courseId")?.trim();

    if (!courseId) {
      return NextResponse.json({ success: false, error: "courseId is required." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (courseError) {
      return NextResponse.json({ success: false, error: courseError.message }, { status: 500 });
    }

    if (!course) {
      return NextResponse.json({ success: false, error: "Course not found." }, { status: 404 });
    }

    const { count, error: materialsError } = await supabase
      .from("course_materials")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseId);

    if (materialsError) {
      return NextResponse.json({ success: false, error: materialsError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      hasMaterials: (count ?? 0) > 0,
      materialsCount: count ?? 0,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Failed to check course materials." },
      { status: 500 },
    );
  }
}
