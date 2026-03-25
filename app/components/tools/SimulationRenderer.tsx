"use client";

import { useMemo, useState } from "react";
import type { SimulationToolSpec } from "@/app/schemas";

type ParamState = SimulationToolSpec["parameters"];

export function SimulationRenderer({ spec }: { spec: SimulationToolSpec }) {
  const [params, setParams] = useState<ParamState>(spec.parameters);

  const summary = useMemo(() => {
    const pairs = Object.entries(params).map(([key, value]) => `${key}: ${value.value}`);
    return `${spec.simulationType} | ${pairs.join(" | ")}`;
  }, [params, spec.simulationType]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900 capitalize">{spec.simulationType} simulation</h3>

      {Object.entries(params).map(([key, val]) => (
        <div key={key} className="space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <label className="font-medium capitalize">{key}</label>
            <span>{val.value}</span>
          </div>
          <input
            type="range"
            min={val.min}
            max={val.max}
            step={val.step ?? 1}
            value={val.value}
            onChange={(e) =>
              setParams((prev) => ({
                ...prev,
                [key]: {
                  ...prev[key],
                  value: Number(e.target.value),
                },
              }))
            }
            className="w-full"
          />
        </div>
      ))}

      <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs text-gray-700">
        {summary}
      </div>
    </div>
  );
}
