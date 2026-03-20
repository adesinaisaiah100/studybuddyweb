import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const courseId = url.searchParams.get("courseId");

    if (!courseId) {
      return NextResponse.json({ error: "courseId is required." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: outline, error: outlineError } = await supabase
      .from("course_outlines")
      .select("id, status, outline_json, youtube_status, web_status, generated_at")
      .eq("course_id", courseId)
      .single();

    if (outlineError) {
      if (outlineError.code === "PGRST116" || outlineError.code === "42P01") {
        return NextResponse.json({ success: true, outline: null, resources: [] });
      }
      return NextResponse.json({ error: outlineError.message }, { status: 500 });
    }

    const { data: resources, error: resourcesError } = await supabase
      .from("course_module_resources")
      .select("id, module_slug, module_title, resource_type, title, url, source, score, metadata")
      .eq("outline_id", outline.id)
      .order("score", { ascending: false });

    if (resourcesError) {
      if (resourcesError.code === "42P01") {
        return NextResponse.json({ success: true, outline, resources: [] });
      }
      return NextResponse.json({ error: resourcesError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      outline,
      resources: resources ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Failed to fetch course outline." },
      { status: 500 }
    );
  }
}
