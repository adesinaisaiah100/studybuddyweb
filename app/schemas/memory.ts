import { z } from "zod";
import { BaseToolSchema } from "./base";

export const MemoryToolSchema = BaseToolSchema.extend({
  tool: z.literal("memory"),
  action: z.enum(["log_quiz", "log_state", "log_preference", "log_prompt", "log_file"]),
  data: z.record(z.string(), z.any()),
  timestamp: z.string().datetime(),
});

export type MemoryToolSpec = z.infer<typeof MemoryToolSchema>;
