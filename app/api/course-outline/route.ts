import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateResourcesForModule } from "@/lib/ai/outline-resources";

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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const courseId = String(body?.courseId || "").trim();
    const moduleTitle = String(body?.moduleTitle || "").trim();
    const moduleSummary = String(body?.moduleSummary || "").trim();
    const providedKeywords = Array.isArray(body?.keywords)
      ? (body.keywords as unknown[])
          .map((value) => String(value || "").trim())
          .filter((value) => value.length > 0)
      : [];

    if (!courseId || !moduleTitle) {
      return NextResponse.json(
        { error: "courseId and moduleTitle are required." },
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

    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id, title")
      .eq("id", courseId)
      .eq("user_id", user.id)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    const { data: existingOutline, error: outlineLookupError } = await supabase
      .from("course_outlines")
      .select("id, outline_json")
      .eq("course_id", courseId)
      .maybeSingle();

    if (outlineLookupError && outlineLookupError.code !== "PGRST116") {
      return NextResponse.json({ error: outlineLookupError.message }, { status: 500 });
    }

    const currentOutline = (existingOutline?.outline_json as {
      courseTitle?: string;
      overview?: string;
      modules?: Array<{ title: string; summary: string; keywords: string[] }>;
    } | null) || {
      courseTitle: course.title,
      overview: "Modules added manually by user.",
      modules: [],
    };

    const safeKeywords = providedKeywords.length > 0
      ? providedKeywords.slice(0, 8)
      : moduleTitle
          .split(/[^a-zA-Z0-9]+/)
          .map((part) => part.trim().toLowerCase())
          .filter((part) => part.length >= 4)
          .slice(0, 8);

    const newModule = {
      title: moduleTitle,
      summary: moduleSummary || `Manually added module: ${moduleTitle}`,
      keywords: safeKeywords.length > 0 ? safeKeywords : ["module", "course"],
    };

    const existingModules = Array.isArray(currentOutline.modules) ? currentOutline.modules : [];
    const moduleIndex = existingModules.findIndex(
      (module) => module.title.toLowerCase() === moduleTitle.toLowerCase()
    );

    const nextModules = [...existingModules];
    if (moduleIndex >= 0) {
      nextModules[moduleIndex] = newModule;
    } else {
      nextModules.push(newModule);
    }

    const nextOutline = {
      courseTitle: currentOutline.courseTitle || course.title,
      overview: currentOutline.overview || "Modules added manually by user.",
      modules: nextModules,
    };

    const generated = await generateResourcesForModule({
      courseTitle: nextOutline.courseTitle,
      moduleTitle: newModule.title,
      keywords: newModule.keywords,
    });

    const { data: outlineRow, error: upsertError } = await supabase
      .from("course_outlines")
      .upsert(
        {
          course_id: courseId,
          status: "ready",
          outline_json: nextOutline,
          youtube_status: generated.youtubeStatus,
          web_status: generated.webStatus,
          generated_at: new Date().toISOString(),
        },
        { onConflict: "course_id" }
      )
      .select("id")
      .single();

    if (upsertError || !outlineRow?.id) {
      return NextResponse.json(
        { error: upsertError?.message || "Failed to save outline." },
        { status: 500 }
      );
    }

    await supabase
      .from("course_module_resources")
      .delete()
      .eq("outline_id", outlineRow.id)
      .eq("module_slug", generated.moduleSlug);

    const rows = [...generated.web, ...generated.youtube].map((resource) => ({
      outline_id: outlineRow.id,
      module_slug: resource.module_slug,
      module_title: resource.module_title,
      resource_type: resource.resource_type,
      title: resource.title,
      url: resource.url,
      source: resource.source,
      score: resource.score,
      metadata: resource.metadata ?? null,
    }));

    if (rows.length > 0) {
      const { error: insertError } = await supabase
        .from("course_module_resources")
        .insert(rows);

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      outline: nextOutline,
      insertedResources: rows.length,
      perType: {
        youtube: generated.youtube.length,
        web: generated.web.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Failed to save manual module." },
      { status: 500 }
    );
  }
}
