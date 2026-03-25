"use client";

import { ToolSchema } from "@/app/schemas";

import { ChartRenderer } from "@/app/components/tools/ChartRenderer";
import { QuizRenderer } from "@/app/components/tools/QuizRenderer";
import { SimulationRenderer } from "@/app/components/tools/SimulationRenderer";
import { MathRenderer } from "@/app/components/tools/MathRenderer";
import { FlashcardRenderer } from "@/app/components/tools/FlashcardRenderer";
import { FlowchartRenderer } from "@/app/components/tools/FlowchartRenderer";
import { SlideRenderer } from "@/app/components/tools/SlideRenderer";
import { DiagramRenderer } from "@/app/components/tools/DiagramRenderer";
import { CircuitRenderer } from "@/app/components/tools/CircuitRenderer";

export function ToolRenderer({ spec }: { spec: unknown }) {
  const parsed = ToolSchema.safeParse(spec);

  if (!parsed.success) {
    return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Invalid tool output</div>;
  }

  const tool = parsed.data;

  switch (tool.tool) {
    case "chart":
      return <ChartRenderer spec={tool} />;
    case "quiz":
      return <QuizRenderer spec={tool} />;
    case "simulation":
      return <SimulationRenderer spec={tool} />;
    case "math":
      return <MathRenderer spec={tool} />;
    case "flashcard":
      return <FlashcardRenderer spec={tool} />;
    case "flowchart":
      return <FlowchartRenderer spec={tool} />;
    case "slide":
      return <SlideRenderer spec={tool} />;
    case "diagram":
      return <DiagramRenderer spec={tool} />;
    case "circuit":
      return <CircuitRenderer spec={tool} />;
    default:
      return null;
  }
}
