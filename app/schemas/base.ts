import { z } from "zod";

export const BaseToolSchema = z.object({
  tool: z.string(),
  version: z.literal("1.0"),
  id: z.string().optional(),
});
