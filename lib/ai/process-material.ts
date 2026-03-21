import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type ProcessPayload = {
  materialId: string;
  courseId: string;
  title?: string;
  materialType?: string;
  rawText: string;
};

type ProgressStage = "extracting" | "vectorizing" | "complete";

type ProcessOptions = {
  onProgress?: (stage: ProgressStage, details?: { chunkCount?: number }) => Promise<void> | void;
};

export async function processMaterialToEmbeddings(
  supabase: SupabaseServerClient,
  payload: ProcessPayload,
  options: ProcessOptions = {}
) {
  const { materialId, courseId, title, materialType, rawText } = payload;

  if (!materialId || !courseId || !rawText) {
    throw new Error("Missing required fields or empty text payload.");
  }

  await options.onProgress?.("extracting");

  const text = rawText.replace(/\s+/g, " ").trim();
  if (!text) {
    throw new Error("No valid text provided.");
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const docs = await splitter.createDocuments([text], [{ materialId, courseId, title, materialType }]);

  await options.onProgress?.("vectorizing", { chunkCount: docs.length });

  if (!process.env.OPENROUTER_API_KEY) {
    return {
      success: true,
      chunks: docs.length,
      message: "Text extracted, skipped embeddings because OPENROUTER_API_KEY is missing.",
    };
  }

  const embeddingModel = process.env.OPENROUTER_EMBEDDING_MODEL;
  if (!embeddingModel) {
    throw new Error("Missing OPENROUTER_EMBEDDING_MODEL env variable.");
  }

  const textsToEmbed = docs.map((d) => d.pageContent);
  const embeddingsArrays: number[][] = [];

  const EMBEDDING_BATCH_SIZE = 20;
  for (let index = 0; index < textsToEmbed.length; index += EMBEDDING_BATCH_SIZE) {
    const batch = textsToEmbed.slice(index, index + EMBEDDING_BATCH_SIZE);

    const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
        "X-Title": "LMS StudyBuddy",
      },
      body: JSON.stringify({
        model: embeddingModel,
        input: batch,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter API Error: ${errText}`);
    }

    const json = await response.json();
    if (!json.data || !Array.isArray(json.data)) {
      throw new Error("Invalid response connecting to OpenRouter Embeddings");
    }

    for (const item of json.data) {
      embeddingsArrays.push(item.embedding);
    }
  }

  const { error: cleanupError } = await supabase
    .from("course_embeddings")
    .delete()
    .eq("material_id", materialId);

  if (cleanupError) {
    throw cleanupError;
  }

  const records = docs.map((doc, index) => ({
    course_id: courseId,
    material_id: materialId,
    content: doc.pageContent,
    embedding: embeddingsArrays[index],
    metadata: doc.metadata,
  }));

  const INSERT_BATCH_SIZE = 100;
  for (let index = 0; index < records.length; index += INSERT_BATCH_SIZE) {
    const batch = records.slice(index, index + INSERT_BATCH_SIZE);
    const { error: insertError } = await supabase.from("course_embeddings").insert(batch);

    if (insertError) {
      throw insertError;
    }
  }

  await options.onProgress?.("complete", { chunkCount: docs.length });

  return {
    success: true,
    chunks: docs.length,
    message: "Document successfully processed and indexed.",
  };
}
