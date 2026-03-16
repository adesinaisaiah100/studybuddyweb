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
      try {
        const arrayBuffer = await fileData.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (doc.file_type === "pdf") {
          const { extractText } = await import("unpdf");
          const { text } = await extractText(buffer);
          extractedText = text;
        } else if (doc.file_type === "docx") {
          const mammoth = await import("mammoth");
          const result = await mammoth.extractRawText({ buffer });
          extractedText = result.value;
        } else {
          return NextResponse.json(
            { error: `Unsupported file type for local parsing: ${doc.file_type}` },
            { status: 400 }
          );
        }
      } catch (parseError) {
        console.error("Local parsing error:", parseError);
        return NextResponse.json(
          { error: `Failed to parse document locally: ${parseError instanceof Error ? parseError.message : String(parseError)}` },
          { status: 500 }
        );
      }

      if (!extractedText) {
        return NextResponse.json(
          { error: "Extracted text is empty" },
          { status: 500 }
        );
      }

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
