import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateResourcesForModule } from "@/lib/ai/outline-resources";

function normalizeUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    const normalizedPath = parsed.pathname.replace(/\/$/, "");
    return `${parsed.origin}${normalizedPath}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

function isDirectYouTubeVideoUrl(url: string) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();

    if (hostname === "youtube.com") {
      return parsed.pathname === "/watch" && parsed.searchParams.has("v");
    }

    if (hostname === "youtu.be") {
      return parsed.pathname.length > 1;
    }

    return false;
  } catch {
    return false;
  }
}

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

    const safeResources = (resources ?? []).filter((resource) => {
      if (resource.resource_type !== "youtube") return true;
      return isDirectYouTubeVideoUrl(resource.url || "");
    });

    return NextResponse.json({
      success: true,
      outline,
      resources: safeResources,
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
    const action = String(body?.action || "").trim().toLowerCase();
    const courseId = String(body?.courseId || "").trim();
    const moduleTitle = String(body?.moduleTitle || "").trim();
    const moduleSummary = String(body?.moduleSummary || "").trim();
    const resourceId = String(body?.resourceId || "").trim();
    const providedKeywords = Array.isArray(body?.keywords)
      ? (body.keywords as unknown[])
          .map((value) => String(value || "").trim())
          .filter((value) => value.length > 0)
      : [];

    if (!courseId) {
      return NextResponse.json(
        { error: "courseId is required." },
        { status: 400 }
      );
    }

    if (action === "delete_resource" && !resourceId) {
      return NextResponse.json(
        { error: "resourceId is required for delete_resource." },
        { status: 400 }
      );
    }

    if (!["delete_resource", "refetch_resources"].includes(action) && !moduleTitle) {
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

    if (action === "delete_resource") {
      const { data: existingOutline, error: outlineLookupError } = await supabase
        .from("course_outlines")
        .select("id")
        .eq("course_id", courseId)
        .maybeSingle();

      if (outlineLookupError && outlineLookupError.code !== "PGRST116") {
        return NextResponse.json({ error: outlineLookupError.message }, { status: 500 });
      }

      if (!existingOutline?.id) {
        return NextResponse.json({ error: "No outline found for this course." }, { status: 404 });
      }

      const { data: deletedRows, error: deleteError } = await supabase
        .from("course_module_resources")
        .delete()
        .eq("outline_id", existingOutline.id)
        .eq("id", resourceId)
        .select("id");

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      if (!deletedRows || deletedRows.length === 0) {
        return NextResponse.json({ error: "Resource not found." }, { status: 404 });
      }

      return NextResponse.json({ success: true, deletedResourceId: resourceId });
    }

    if (action === "refetch_resources") {
      const { data: existingOutline, error: outlineLookupError } = await supabase
        .from("course_outlines")
        .select("id, outline_json")
        .eq("course_id", courseId)
        .maybeSingle();

      if (outlineLookupError && outlineLookupError.code !== "PGRST116") {
        return NextResponse.json({ error: outlineLookupError.message }, { status: 500 });
      }

      if (!existingOutline?.id) {
        return NextResponse.json({ error: "No outline found for this course." }, { status: 404 });
      }

      const currentOutline = (existingOutline.outline_json as {
        courseTitle?: string;
        modules?: Array<{ title: string; summary: string; keywords: string[] }>;
      } | null) || { courseTitle: course.title, modules: [] };

      const modules = Array.isArray(currentOutline.modules) ? currentOutline.modules : [];
      if (modules.length === 0) {
        return NextResponse.json({ error: "No modules found in outline." }, { status: 400 });
      }

      const generatedSets: Array<Awaited<ReturnType<typeof generateResourcesForModule>>> = [];
      const failedModules: string[] = [];

      for (const outlineModule of modules) {
        try {
          const generated = await generateResourcesForModule({
            courseTitle: currentOutline.courseTitle || course.title,
            moduleTitle: outlineModule.title,
            moduleSummary: outlineModule.summary,
            keywords: outlineModule.keywords,
            options: {
              minimumResults: 24,
            },
          });
          generatedSets.push(generated);
        } catch {
          failedModules.push(outlineModule.title || "Unknown module");
        }
      }

      if (generatedSets.length === 0) {
        return NextResponse.json(
          {
            error: "Failed to generate resources for all modules.",
            failedModules,
          },
          { status: 500 }
        );
      }

      const allRows = generatedSets.flatMap((generated) =>
        [...generated.web, ...generated.youtube].map((resource) => ({
          outline_id: existingOutline.id,
          module_slug: resource.module_slug,
          module_title: resource.module_title,
          resource_type: resource.resource_type,
          title: resource.title,
          url: resource.url,
          source: resource.source,
          score: resource.score,
          metadata: resource.metadata ?? null,
        }))
      );

      // Deduplicate across all rows by normalized URL
      const urlMap = new Map<string, (typeof allRows)[0]>();
      for (const row of allRows) {
        const normalizedUrl = normalizeUrl(row.url);
        const existing = urlMap.get(normalizedUrl);
        // Keep the higher-scoring resource if there's a duplicate
        if (!existing || row.score > existing.score) {
          urlMap.set(normalizedUrl, row);
        }
      }
      const deduplicatedRows = Array.from(urlMap.values());

      if (deduplicatedRows.length === 0) {
        return NextResponse.json(
          {
            error: "No new resources were generated. Existing resources were kept.",
            failedModules,
          },
          { status: 422 }
        );
      }

      const { error: deleteError } = await supabase
        .from("course_module_resources")
        .delete()
        .eq("outline_id", existingOutline.id);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      if (deduplicatedRows.length > 0) {
        const { error: insertError } = await supabase
          .from("course_module_resources")
          .insert(deduplicatedRows);
        if (insertError) {
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }
      }

      return NextResponse.json({ success: true, insertedResources: deduplicatedRows.length });
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
      moduleSummary: newModule.summary,
      keywords: newModule.keywords,
      options: {
        minimumResults: 24,
      },
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
