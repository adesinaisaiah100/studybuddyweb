// app/api/rag/search/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type SearchBody = {
  courseId?: string;
  prompt?: string;
  topK?: number;
  materialIds?: string[];
};

type RetrievedChunk = {
  chunk_id: string;
  material_id: string;
  content: string;
  metadata: Record<string, unknown> | null;
  score: number;
};

async function embedPrompt(prompt: string) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_EMBEDDING_MODEL;

  if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");
  if (!model) throw new Error("Missing OPENROUTER_EMBEDDING_MODEL");

  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
      "X-Title": "LMS LEARNIVERSE",
    },
    body: JSON.stringify({
      model,
      input: prompt,
    }),
  });

  if (!res.ok) {
    throw new Error(`Embedding API failed: ${await res.text()}`);
  }

  const json = await res.json();
  const embedding = json?.data?.[0]?.embedding;
  if (!Array.isArray(embedding)) throw new Error("Invalid embedding response");

  return { embedding, model };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SearchBody;
    const courseId = body.courseId?.trim();
    const prompt = body.prompt?.trim();
    const topK = Math.min(Math.max(body.topK ?? 6, 1), 20);
    const materialIds = Array.isArray(body.materialIds) ? body.materialIds : null;

    if (!courseId || !prompt) {
      return NextResponse.json(
        { success: false, error: "courseId and prompt are required." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: ownedCourse } = await supabase
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .eq("user_id", user.id)
      .single();

    if (!ownedCourse) {
      return NextResponse.json({ success: false, error: "Course not found." }, { status: 404 });
    }

    const { embedding, model } = await embedPrompt(prompt);

    const { data, error } = await supabase.rpc("match_course_embeddings", {
      p_course_id: courseId,
      p_query_embedding: embedding,
      p_match_count: topK,
      p_material_ids: materialIds, // pass null to ignore filter
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const results = ((data ?? []) as RetrievedChunk[]).map((row) => ({
      chunkId: row.chunk_id,
      materialId: row.material_id,
      content: row.content,
      metadata: row.metadata,
      score: row.score,
    }));

    return NextResponse.json({
      success: true,
      topK,
      queryEmbeddingModel: model,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Search failed." },
      { status: 500 }
    );
  }
}

