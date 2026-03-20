import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processMaterialToEmbeddings } from "@/lib/ai/process-material";

export async function POST(req: Request) {
  try {
    const { materialId, courseId, title, materialType, rawText } = await req.json();

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const result = await processMaterialToEmbeddings(
      supabase,
      { materialId, courseId, title, materialType, rawText }
    );

    return NextResponse.json(result);

  } catch (error: unknown) {
    console.error("Document Process Error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "An error occurred while processing the document." },
      { status: 500 }
    );
  }
}
