import { z } from "zod";
import { BaseToolSchema } from "./base";

export const SlideToolSchema = BaseToolSchema.extend({
  tool: z.literal("slide"),
  title: z.string().optional(),
  theme: z.enum(["light", "dark"]).optional(),
  slides: z.array(
    z.object({
      id: z.string().optional(),
      heading: z.string(),
      bullets: z.array(z.string()).default([]),
      notes: z.string().optional(),
    })
  ).min(1),
});
