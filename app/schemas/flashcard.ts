import { z } from "zod";
import { BaseToolSchema } from "./base";

export const FlashcardToolSchema = BaseToolSchema.extend({
  tool: z.literal("flashcard"),
  cards: z.array(
    z.object({
      front: z.string(),
      back: z.string(),
    })
  ),
});
