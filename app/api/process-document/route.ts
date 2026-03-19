import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

export async function POST(req: Request) {
  try {
    const { materialId, courseId, title, materialType, rawText } = await req.json();

    if (!materialId || !courseId || !rawText) {
      return NextResponse.json(
        { error: "Missing required fields or empty text payload." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Clean up the text passed directly from the client's WebWorker/OCR extraction
    const text = rawText.replace(/\s+/g, " ").trim();

    if (!text) {
      return NextResponse.json({ error: "No valid text provided." }, { status: 400 });
    }

    // 2. Chunk the text
    console.log("Chunking text...");
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    
    // We can also attach metadata to these chunks
    const docs = await splitter.createDocuments(
      [text],
      [{ materialId, courseId, title, materialType }]
    );

    console.log(`Created ${docs.length} chunks.`);

    // 4. Generate Embeddings using OpenRouter and NVIDIA model
    if (!process.env.OPENROUTER_API_KEY) {
      console.warn("WARNING: OPENROUTER_API_KEY is not set. Skipping vector embeddings.");
      return NextResponse.json({ 
        message: "Text extracted, but skipped embeddings because OPENROUTER_API_KEY is missing.",
        chunks: docs.length
      });
    }

    console.log("Generating embeddings via OpenRouter...");
    const textsToEmbed = docs.map((d) => d.pageContent);
    const embeddingsArrays: number[][] = [];
    
    // Batch process to avoid potential payload size limits
    const BATCH_SIZE = 20; 
    for (let i = 0; i < textsToEmbed.length; i += BATCH_SIZE) {
      const batch = textsToEmbed.slice(i, i + BATCH_SIZE);
      
      const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
          "X-Title": "LMS StudyBuddy"
        },
        body: JSON.stringify({
          model: "nvidia/llama-nemotron-embed-vl-1b-v2:free",
          input: batch,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenRouter API Error: ${err}`);
      }

      const json = await res.json();
      if (!json.data || !Array.isArray(json.data)) {
        throw new Error("Invalid response connecting to OpenRouter Embeddings");
      }

      for (const item of json.data) {
        embeddingsArrays.push(item.embedding);
      }
    }

    // 5. Bulk insert to pgvector table
    const records = docs.map((doc, i) => ({
      course_id: courseId,
      material_id: materialId,
      content: doc.pageContent,
      embedding: embeddingsArrays[i],
      metadata: doc.metadata,
    }));

    // Batch insert 100 at a time to avoid request size limits
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from("course_embeddings")
        .insert(batch);

      if (insertError) {
        console.error("Error inserting embeddings:", insertError);
        throw insertError;
      }
    }

    // 6. Generate Course Outline if Primary Slide
    if (materialType === "primary_slide") {
      // NOTE: Here we would send `text` to an LLM like OpenRouter 
      // to generate a course outline and save it to the DB.
      // We will add this logic next using the OpenRouter API.
    }

    return NextResponse.json({ 
      success: true, 
      chunks: docs.length,
      message: "Document successfully processed and indexed."
    });

  } catch (error: unknown) {
    console.error("Document Process Error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "An error occurred while processing the document." },
      { status: 500 }
    );
  }
}
