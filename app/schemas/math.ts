import { z } from "zod";
import { BaseToolSchema } from "./base";

export const MathToolSchema = BaseToolSchema.extend({
  tool: z.literal("math"),
  expression: z.string(),
  steps: z.array(z.string()).optional(),
});
