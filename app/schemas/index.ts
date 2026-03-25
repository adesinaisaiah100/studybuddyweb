import { z } from "zod";
import { ChartToolSchema } from "./chart";
import { QuizToolSchema } from "./quiz";
import { SimulationToolSchema } from "./simulation";
import { MathToolSchema } from "./math";
import { FlashcardToolSchema } from "./flashcard";
import { FlowchartToolSchema } from "./flowchart";
import { SlideToolSchema } from "./slide";
import { DiagramToolSchema } from "./diagram";
import { CircuitToolSchema } from "./circuit";
import { MemoryToolSchema } from "./memory";

export const ToolSchema = z.discriminatedUnion("tool", [
  ChartToolSchema,
  QuizToolSchema,
  SimulationToolSchema,
  MathToolSchema,
  FlashcardToolSchema,
  FlowchartToolSchema,
  SlideToolSchema,
  DiagramToolSchema,
  CircuitToolSchema,
  MemoryToolSchema,
]);

export type ToolSpec = z.infer<typeof ToolSchema>;
export type ChartToolSpec = z.infer<typeof ChartToolSchema>;
export type QuizToolSpec = z.infer<typeof QuizToolSchema>;
export type SimulationToolSpec = z.infer<typeof SimulationToolSchema>;
export type MathToolSpec = z.infer<typeof MathToolSchema>;
export type FlashcardToolSpec = z.infer<typeof FlashcardToolSchema>;
export type FlowchartToolSpec = z.infer<typeof FlowchartToolSchema>;
export type SlideToolSpec = z.infer<typeof SlideToolSchema>;
export type DiagramToolSpec = z.infer<typeof DiagramToolSchema>;
export type CircuitToolSpec = z.infer<typeof CircuitToolSchema>;
export type MemoryToolSpec = z.infer<typeof MemoryToolSchema>;
