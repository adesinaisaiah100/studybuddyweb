"use client";

import type { DiagramToolSpec } from "@/app/schemas";

export function DiagramRenderer({ spec }: { spec: DiagramToolSpec }) {
  const nodes = spec.nodes || [];
  const edges = spec.edges || [];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">{spec.title || "Diagram"}</h3>

      {spec.description ? <p className="text-sm text-gray-600">{spec.description}</p> : null}

      {spec.diagramType === "mermaid" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Mermaid text is supported for simple diagrams; use the `circuit` tool for electrical schematics.
          {spec.mermaid ? <pre className="mt-2 overflow-x-auto text-xs">{spec.mermaid}</pre> : null}
        </div>
      ) : (
        <div className="space-y-2">
          {nodes.map((node) => {
            const outgoing = edges.filter((edge) => edge.from === node.id);
            return (
              <div key={node.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <p className="text-sm font-medium text-gray-900">{node.label}</p>
                {outgoing.length > 0 ? (
                  <p className="text-xs text-gray-500 mt-1">
                    Links to: {outgoing.map((edge) => edge.to).join(", ")}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">No outgoing links</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
