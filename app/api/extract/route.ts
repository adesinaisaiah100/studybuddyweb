import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractCourses } from "@/lib/ai/extract-courses";

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

    // 2. If text hasn't been extracted yet, send file to Docling
    let extractedText = doc.extracted_text;

    if (!extractedText) {
      const doclingUrl = process.env.DOCLING_SERVICE_URL;

      if (!doclingUrl) {
        return NextResponse.json(
          { error: "Docling service URL not configured" },
          { status: 500 }
        );
      }

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

      // Send to Docling for parsing
      const formData = new FormData();
      const fileName = `document.${doc.file_type}`;
      formData.append("file", fileData, fileName);

      const parseResponse = await fetch(`${doclingUrl}/parse`, {
        method: "POST",
        body: formData,
      });

      if (!parseResponse.ok) {
        const parseError = await parseResponse.text();
        return NextResponse.json(
          { error: `Docling parsing failed: ${parseError}` },
          { status: 500 }
        );
      }

      const parseResult = await parseResponse.json();
      extractedText = parseResult.extracted_text;

      // Save the extracted text back to raw_documents
      await supabase
        .from("raw_documents")
        .update({ extracted_text: extractedText })
        .eq("id", document_id);
    }

    // 3. Send extracted text to AI for course extraction
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
