import { z } from "zod";
import { BaseToolSchema } from "./base";

export const FlowchartToolSchema = BaseToolSchema.extend({
  tool: z.literal("flowchart"),
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
    })
  ),
  edges: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
    })
  ),
});
