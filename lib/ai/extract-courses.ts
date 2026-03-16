import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

// Schema for AI-structured course output
const CourseScheduleSchema = z.object({
  day: z.string().describe("REQUIRED: Day of the week (e.g. Monday, Tuesday)"),
  time: z.string().describe("REQUIRED: Time duration (e.g. 08:00 - 10:00)"),
  venue: z.string().nullable().describe("EXTRACTED venue or null if not found"),
});

const CourseSchema = z.object({
  code: z.string().describe("EXTRACTED Course code or unique identifier (e.g. CSC301)"),
  title: z.string().describe("EXTRACTED Full course name/title"),
  schedule: z.array(CourseScheduleSchema).describe("List of all extracted meeting times"),
});

const CoursesOutputSchema = z.object({
  courses: z.array(CourseSchema).describe("List of extracted courses found in the text. Return empty array if none found."),
});

export type ExtractedCourse = z.infer<typeof CourseSchema>;
export type CoursesOutput = z.infer<typeof CoursesOutputSchema>;

const SYSTEM_PROMPT = `You are a strict data extraction engine. You will be provided with text from a university timetable.

Your goal is to extract every course mentioned and format it into a valid JSON object matching the requested schema.

CRITICAL RULES:
1. ONLY extract courses that are actually in the text.
2. If the text is empty or contains no courses, return {"courses": []}.
3. DO NOT use placeholder names or codes (like CSC301).
4. Extract the Full Course Title and the Course Code (e.g., MAT101).
5. Extract EVERY time slot. Group slots for the same course together.
6. Convert day abbreviations to full names (e.g., "Mon" -> "Monday").
7. Extract the venue/room if specified.
8. Be precise. If you are unsure, do not invent data.`;

export async function extractCourses(
  extractedText: string
): Promise<CoursesOutput> {
  const model = new ChatOpenAI({
    modelName: "google/gemini-2.0-flash-lite:preview-02-05:free",
    temperature: 0,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    },
  });

  const structuredModel = model.withStructuredOutput(CoursesOutputSchema);

  const result = await structuredModel.invoke([
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Extract all courses from the following timetable text:\n\n${extractedText}`,
    },
  ]);

  return result;
}
