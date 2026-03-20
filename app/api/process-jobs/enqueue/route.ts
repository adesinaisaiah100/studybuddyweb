import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const { materialId, courseId, title, materialType, rawText, contentHash } = await req.json();

    if (!materialId || !courseId || !rawText) {
      return NextResponse.json(
        { error: "Missing required fields or empty text payload." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: ownedCourse } = await supabase
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .eq("user_id", user.id)
      .single();

    if (!ownedCourse) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    const { data: job, error: insertError } = await supabase
      .from("processing_jobs")
      .upsert(
        {
          user_id: user.id,
          course_id: courseId,
          material_id: materialId,
          title: title ?? null,
          material_type: materialType ?? null,
          raw_text: rawText,
          content_hash: contentHash ?? null,
          status: "queued",
          milestone: "uploaded",
          eta_range: "1-5 min",
          attempts: 0,
          last_error: null,
          started_at: null,
          completed_at: null,
        },
        { onConflict: "material_id" }
      )
      .select()
      .single();

    if (insertError || !job) {
      return NextResponse.json(
        { error: insertError?.message || "Failed to enqueue processing job." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, job });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Failed to enqueue processing job." },
      { status: 500 }
    );
  }
}
