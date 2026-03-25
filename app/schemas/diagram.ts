import { z } from "zod";
import { BaseToolSchema } from "./base";

export const DiagramToolSchema = BaseToolSchema.extend({
  tool: z.literal("diagram"),
  diagramType: z.enum(["mermaid", "concept-map", "circuit", "block"]),
  title: z.string().optional(),
  mermaid: z.string().optional(),
  description: z.string().optional(),
  nodes: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
      })
    )
    .optional(),
  edges: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
      })
    )
    .optional(),
});
