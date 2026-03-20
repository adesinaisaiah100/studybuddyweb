import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processMaterialToEmbeddings } from "@/lib/ai/process-material";
import { generateOutlineAndResources } from "@/lib/ai/outline-resources";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type ProcessingJobRow = {
  id: string;
  user_id: string;
  course_id: string;
  material_id: string;
  title: string | null;
  material_type: string | null;
  raw_text: string;
  content_hash: string | null;
  status: "queued" | "failed" | "extracting" | "vectorizing" | "completed";
  attempts: number;
  max_attempts: number;
  updated_at: string;
};

type EmbeddingRow = {
  content: string;
  embedding: number[];
  metadata: Record<string, unknown> | null;
};

async function tryReuseCachedEmbeddings(supabase: SupabaseServerClient, job: ProcessingJobRow) {
  if (!job.content_hash) return false;

  const { data: priorJob } = await supabase
    .from("processing_jobs")
    .select("material_id")
    .eq("user_id", job.user_id)
    .eq("course_id", job.course_id)
    .eq("content_hash", job.content_hash)
    .eq("status", "completed")
    .neq("material_id", job.material_id)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!priorJob?.material_id) return false;

  const { data: existingEmbeddings, error: existingError } = await supabase
    .from("course_embeddings")
    .select("content, embedding, metadata")
    .eq("course_id", job.course_id)
    .eq("material_id", priorJob.material_id);

  if (existingError || !existingEmbeddings || existingEmbeddings.length === 0) return false;

  const cloned = (existingEmbeddings as EmbeddingRow[]).map((row) => ({
    course_id: job.course_id,
    material_id: job.material_id,
    content: row.content,
    embedding: row.embedding,
    metadata: row.metadata,
  }));

  const { error: cleanupError } = await supabase
    .from("course_embeddings")
    .delete()
    .eq("material_id", job.material_id);

  if (cleanupError) {
    throw cleanupError;
  }

  const batchSize = 100;
  for (let index = 0; index < cloned.length; index += batchSize) {
    const batch = cloned.slice(index, index + batchSize);
    const { error: insertError } = await supabase.from("course_embeddings").insert(batch);
    if (insertError) {
      throw insertError;
    }
  }

  return true;
}

export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: nextJob, error: nextJobError } = await supabase
      .from("processing_jobs")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["queued", "failed"])
      .lt("attempts", 3)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextJobError) {
      return NextResponse.json({ error: nextJobError.message }, { status: 500 });
    }

    if (!nextJob) {
      return NextResponse.json({ success: true, message: "No pending jobs." });
    }

    const typedJob = nextJob as ProcessingJobRow;

    if (typedJob.status === "failed") {
      const now = Date.now();
      const updatedAtMs = new Date(typedJob.updated_at).getTime();
      const backoffSeconds = typedJob.attempts >= 2 ? 120 : 30;

      if (Number.isFinite(updatedAtMs) && now - updatedAtMs < backoffSeconds * 1000) {
        return NextResponse.json({
          success: true,
          message: "Retry backoff in effect.",
          nextAttemptInSec: Math.ceil((backoffSeconds * 1000 - (now - updatedAtMs)) / 1000),
        });
      }
    }

    const nextAttempts = (typedJob.attempts ?? 0) + 1;

    await supabase
      .from("processing_jobs")
      .update({
        status: "extracting",
        milestone: "extracting",
        eta_range: "1-4 min",
        started_at: new Date().toISOString(),
        attempts: nextAttempts,
        last_error: null,
      })
        .eq("id", typedJob.id)
      .eq("user_id", user.id);

    try {
      if (typedJob.material_type === "primary_slide" && typedJob.raw_text?.trim()) {
        try {
          const generated = await generateOutlineAndResources(typedJob.raw_text);

          const { data: outlineRow, error: outlineUpsertError } = await supabase
            .from("course_outlines")
            .upsert(
              {
                course_id: typedJob.course_id,
                material_id: typedJob.material_id,
                status: "ready",
                outline_json: generated.outline,
                youtube_status: generated.resources.youtubeStatus,
                web_status: generated.resources.webStatus,
                generated_at: new Date().toISOString(),
              },
              { onConflict: "course_id" }
            )
            .select("id")
            .single();

          if (!outlineUpsertError && outlineRow?.id) {
            await supabase.from("course_module_resources").delete().eq("outline_id", outlineRow.id);

            const resourceRows = [...generated.resources.web, ...generated.resources.youtube].map((resource) => ({
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

            if (resourceRows.length > 0) {
              await supabase.from("course_module_resources").insert(resourceRows);
            }
          }
        } catch (outlineError) {
          console.error("[process-jobs/run-next] Outline generation failed", {
            jobId: typedJob.id,
            materialId: typedJob.material_id,
            courseId: typedJob.course_id,
            error: (outlineError as Error).message,
          });
        }
      }

      const reused = await tryReuseCachedEmbeddings(supabase, typedJob);

      if (!reused) {
        await processMaterialToEmbeddings(
          supabase,
          {
            materialId: typedJob.material_id,
            courseId: typedJob.course_id,
            title: typedJob.title ?? undefined,
            materialType: typedJob.material_type ?? undefined,
            rawText: typedJob.raw_text,
          },
          {
            onProgress: async (stage) => {
              const milestone = stage === "vectorizing" ? "vectorizing" : "extracting";
              const etaRange = stage === "vectorizing" ? "30-120 sec" : "1-4 min";

              await supabase
                .from("processing_jobs")
                .update({ status: milestone, milestone, eta_range: etaRange })
                .eq("id", typedJob.id)
                .eq("user_id", user.id);
            },
          }
        );
      }

      await supabase
        .from("processing_jobs")
        .update({
          status: "completed",
          milestone: "complete",
          eta_range: "0 sec",
          completed_at: new Date().toISOString(),
          last_error: null,
          raw_text: null,
        })
        .eq("id", typedJob.id)
        .eq("user_id", user.id);

      return NextResponse.json({ success: true, processedJobId: typedJob.id });
    } catch (processingError) {
      const maxAttempts = typedJob.max_attempts ?? 3;
      const isTerminal = nextAttempts >= maxAttempts;
      const message = (processingError as Error).message;

      console.error("[process-jobs/run-next] Job failed", {
        jobId: typedJob.id,
        materialId: typedJob.material_id,
        courseId: typedJob.course_id,
        attempt: nextAttempts,
        maxAttempts,
        retriable: !isTerminal,
        error: message,
      });

      await supabase
        .from("processing_jobs")
        .update({
          status: "failed",
          milestone: "failed",
          eta_range: isTerminal ? "manual retry" : "retrying soon",
          last_error: message,
        })
        .eq("id", typedJob.id)
        .eq("user_id", user.id);

      return NextResponse.json({
        success: false,
        error: message,
        processedJobId: typedJob.id,
        retriable: !isTerminal,
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Failed to process queued job." },
      { status: 500 }
    );
  }
}
