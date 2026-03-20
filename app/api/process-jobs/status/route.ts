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

    const { data, error } = await supabase
      .from("processing_jobs")
      .select("id, material_id, status, milestone, eta_range, attempts, max_attempts, last_error, started_at, completed_at, updated_at")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json({ success: true, jobs: [] });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const latestPerMaterial = new Map<string, (typeof data)[number]>();
    for (const row of data ?? []) {
      if (!latestPerMaterial.has(row.material_id)) {
        latestPerMaterial.set(row.material_id, row);
      }
    }

    return NextResponse.json({
      success: true,
      jobs: Array.from(latestPerMaterial.values()),
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Failed to fetch job status." },
      { status: 500 }
    );
  }
}
