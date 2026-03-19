import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractCourses } from "@/lib/ai/extract-courses";
import { extractDocumentText } from "@/lib/ai/extract-document-text";

export const runtime = "nodejs";

function envNumber(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { document_id } = body;

    if (!document_id) {
      return NextResponse.json(
        { error: "document_id is required" },
        { status: 400 }
      );
    }

    // 1. Get the document record
    const { data: doc, error: docError } = await supabase
      .from("raw_documents")
      .select("*")
      .eq("id", document_id)
      .eq("user_id", user.id)
      .single();

    if (docError || !doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // 2. If text hasn't been extracted yet, parse locally
    let extractedText = doc.extracted_text;

    if (!extractedText) {
      // Download the file from Supabase Storage
      const filePath = doc.file_url.split("/timetables/")[1];

      if (!filePath) {
        return NextResponse.json(
          { error: "Invalid file path" },
          { status: 500 }
        );
      }

      const { data: fileData, error: downloadError } = await supabase.storage
        .from("timetables")
        .download(filePath);

      if (downloadError || !fileData) {
        return NextResponse.json(
          { error: `Failed to download file: ${downloadError?.message}` },
          { status: 500 }
        );
      }

      // Parse locally based on file type
      let buffer: Buffer | null = null;
      let parseDiagnostics: Record<string, unknown> | null = null;
      try {
        const arrayBuffer = await fileData.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);

        if (doc.file_type !== "pdf" && doc.file_type !== "docx") {
          return NextResponse.json(
            { error: `Unsupported file type for local parsing: ${doc.file_type}` },
            { status: 400 }
          );
        }

        const parsed = await extractDocumentText({
          buffer,
          fileType: doc.file_type,
        });
        extractedText = parsed.text;
        parseDiagnostics = parsed.diagnostics;
      } catch (parseError) {
        console.error("Local parsing error:", parseError);
        return NextResponse.json(
          { error: `Failed to parse document locally: ${parseError instanceof Error ? parseError.message : String(parseError)}` },
          { status: 500 }
        );
      }

      const minChars = envNumber("EXTRACT_MIN_TEXT_CHARS", 50);

      if (!extractedText || extractedText.trim().length < minChars) {

        let message =
          "The document text could not be read properly. If this is a scanned/photographed PDF, please upload a clearer scan or a DOCX.";

        if (isRecord(parseDiagnostics)) {
          const ocrAttempted = parseDiagnostics.ocrAttempted;
          if (ocrAttempted === false) {
            message =
              "The document looks like a scanned/photographed PDF, but OCR is not configured on the server. Set OPENROUTER_API_KEY (and optionally OCR_MODEL), then re-upload.";
          } else if (ocrAttempted === true) {
            message =
              "The document looks like a scanned/photographed PDF. OCR ran but still couldn’t recover enough text. Try a clearer scan (higher contrast, less blur) or upload a DOCX.";
          }
        }

        return NextResponse.json(
          { 
            error: message,
            extracted_text: extractedText,
            buffer_size: buffer?.length || 0,
            parse_diagnostics: parseDiagnostics,
          },
          { status: 400 }
        );
      }

      // Save the extracted text back to raw_documents
      await supabase
        .from("raw_documents")
        .update({ extracted_text: extractedText })
        .eq("id", document_id);
    }

    // 3. Send extracted text to AI for course extraction
    console.log("EXTRACTED TEXT LENGTH:", extractedText.length);
    const aiResult = await extractCourses(extractedText);

    // 4. Save courses to database
    const savedCourses = [];

    for (const course of aiResult.courses) {
      // Insert the course
      const { data: savedCourse, error: courseError } = await supabase
        .from("courses")
        .insert({
          user_id: user.id,
          document_id: document_id,
          code: course.code,
          title: course.title,
        })
        .select()
        .single();

      if (courseError || !savedCourse) {
        console.error("Failed to save course:", courseError);
        continue;
      }

      // Insert schedule slots
      if (course.schedule.length > 0) {
        const scheduleRows = course.schedule.map((slot) => ({
          course_id: savedCourse.id,
          day: slot.day,
          time_slot: slot.time,
          venue: slot.venue,
        }));

        const { error: scheduleError } = await supabase
          .from("course_schedules")
          .insert(scheduleRows);

        if (scheduleError) {
          console.error("Failed to save schedule:", scheduleError);
        }
      }

      savedCourses.push({
        ...savedCourse,
        schedule: course.schedule,
      });
    }

    // 5. Mark onboarding as complete
    await supabase
      .from("profiles")
      .update({ onboarding_complete: true })
      .eq("id", user.id);

    return NextResponse.json({
      success: true,
      courses: savedCourses,
      course_count: savedCourses.length,
    });
  } catch (error) {
    console.error("Extract courses error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
