"use client";

import "katex/dist/katex.min.css";
import { BlockMath, InlineMath } from "react-katex";
import type { MathToolSpec } from "@/app/schemas";

export function MathRenderer({ spec }: { spec: MathToolSpec }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Math Output</h3>
      <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 overflow-x-auto">
        <BlockMath math={spec.expression} />
      </div>
      {spec.steps?.length ? (
        <div className="space-y-2">
          {spec.steps.map((step, index) => (
            <div key={`${step}-${index}`} className="text-sm text-gray-700">
              <span className="mr-2 text-gray-500">{index + 1}.</span>
              <InlineMath math={step} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
