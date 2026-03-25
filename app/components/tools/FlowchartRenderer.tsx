"use client";

import type { FlowchartToolSpec } from "@/app/schemas";

export function FlowchartRenderer({ spec }: { spec: FlowchartToolSpec }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Flowchart</h3>

      <div className="space-y-2">
        {spec.nodes.map((node) => {
          const outgoing = spec.edges.filter((edge) => edge.from === node.id);
          return (
            <div key={node.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <p className="text-sm font-medium text-gray-900">{node.label}</p>
              {outgoing.length > 0 ? (
                <p className="text-xs text-gray-500 mt-1">
                  Next: {outgoing.map((edge) => edge.to).join(", ")}
                </p>
              ) : (
                <p className="text-xs text-gray-400 mt-1">No outgoing edge</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
