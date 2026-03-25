import { z } from "zod";
import { BaseToolSchema } from "./base";

export const ChartToolSchema = BaseToolSchema.extend({
  tool: z.literal("chart"),
  type: z.enum(["line", "bar", "pie", "histogram"]),
  title: z.string().optional(),
  data: z.object({
    labels: z.array(z.union([z.string(), z.number()])),
    datasets: z.array(
      z.object({
        label: z.string(),
        values: z.array(z.number()),
      })
    ),
  }),
});
