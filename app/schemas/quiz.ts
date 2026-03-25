import { z } from "zod";
import { BaseToolSchema } from "./base";

export const QuizToolSchema = BaseToolSchema.extend({
  tool: z.literal("quiz"),
  questions: z.array(
    z.object({
      id: z.string(),
      question: z.string(),
      type: z.enum(["mcq", "short"]),
      options: z.array(z.string()).optional(),
      correctAnswer: z.union([z.string(), z.number()]),
      explanation: z.string().optional(),
    })
  ),
});
