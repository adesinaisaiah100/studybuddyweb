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
  courses: z.array(CourseSchema).describe("ONLY courses found in the provided text"),
});

export type ExtractedCourse = z.infer<typeof CourseSchema>;
export type CoursesOutput = z.infer<typeof CoursesOutputSchema>;

const SYSTEM_PROMPT = `You are a strict data extractor. Your task is to extract university course data from the provided text.

RULES:
1. ONLY extract data that is EXPLICITLY present in the user text.
2. DO NOT use placeholder data (like CSC301 or Operating Systems) unless it is actually in the text.
3. If no courses are found, return an empty array: {"courses": []}.
4. Group multiple time slots for the same course together.
5. Convert days to full names (e.g., "Mon" -> "Monday").
6. Convert times to 24h format "HH:MM - HH:MM" if possible.
7. Be precise. Accuracy is critical.`;

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
