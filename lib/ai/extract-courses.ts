import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

// Schema for AI-structured course output
const CourseScheduleSchema = z.object({
  day: z.string().describe("Day of the week, e.g. 'Monday'"),
  time: z.string().describe("Time slot, e.g. '10:00 - 12:00'"),
  venue: z.string().nullable().describe("Venue or room, e.g. 'LT1'. Null if not specified."),
});

const CourseSchema = z.object({
  code: z.string().describe("Course code, e.g. 'CSC301'"),
  title: z.string().describe("Course title, e.g. 'Operating Systems'"),
  schedule: z.array(CourseScheduleSchema).describe("All weekly time slots for this course"),
});

const CoursesOutputSchema = z.object({
  courses: z.array(CourseSchema).describe("Array of extracted courses"),
});

export type ExtractedCourse = z.infer<typeof CourseSchema>;
export type CoursesOutput = z.infer<typeof CoursesOutputSchema>;

const SYSTEM_PROMPT = `You are an expert at extracting course/timetable data from university documents.

Given the text of a student's timetable or course schedule, extract ALL courses with their details.

Rules:
- Extract the course code (e.g., CSC301, MAT201), title, and all weekly time slots.
- A single course may appear multiple times in a week (e.g., Monday 10-12 AND Wednesday 10-12). Group these under the same course with multiple schedule entries.
- If a venue/room/hall is mentioned, include it. Otherwise set venue to null.
- Use the full day name (Monday, Tuesday, etc.), not abbreviations.
- Format time slots as "HH:MM - HH:MM" in 24-hour format when possible.
- If the document uses AM/PM, convert to 24-hour format.
- Do not invent courses that are not in the document.
- If you cannot determine the course code, use the course title as the code.`;

export async function extractCourses(
  extractedText: string
): Promise<CoursesOutput> {
  const model = new ChatOpenAI({
    modelName: "arcee-ai/trinity-mini:free",
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
