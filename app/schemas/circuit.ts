import { z } from "zod";
import { BaseToolSchema } from "./base";

const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const CircuitComponentSchema = z.object({
  id: z.string(),
  type: z.enum([
    "source-dc",
    "resistor",
    "capacitor",
    "inductor",
    "diode",
    "ground",
    "node",
    "label",
  ]),
  x: z.number(),
  y: z.number(),
  label: z.string().optional(),
  value: z.string().optional(),
  rotation: z.enum(["0", "90", "180", "270"]).optional(),
});

const CircuitWireSchema = z.object({
  id: z.string().optional(),
  from: z.string(),
  to: z.string(),
  path: z.array(PointSchema).optional(),
  label: z.string().optional(),
});

export const CircuitToolSchema = BaseToolSchema.extend({
  tool: z.literal("circuit"),
  title: z.string().optional(),
  canvas: z
    .object({
      width: z.number().default(900),
      height: z.number().default(460),
    })
    .optional(),
  components: z.array(CircuitComponentSchema).min(1),
  wires: z.array(CircuitWireSchema).default([]),
});
