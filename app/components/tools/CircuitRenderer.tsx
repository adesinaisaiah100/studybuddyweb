"use client";

import type { CircuitToolSpec } from "@/app/schemas";

type Point = { x: number; y: number };

function drawResistor(point: Point) {
  const y = point.y;
  const x = point.x;
  return `M ${x - 24} ${y} L ${x - 16} ${y - 6} L ${x - 8} ${y + 6} L ${x} ${y - 6} L ${x + 8} ${y + 6} L ${x + 16} ${y - 6} L ${x + 24} ${y}`;
}

function drawCapacitor(point: Point) {
  const y = point.y;
  const x = point.x;
  return (
    <g>
      <line x1={x - 14} y1={y - 12} x2={x - 14} y2={y + 12} strokeWidth={2} />
      <line x1={x + 14} y1={y - 12} x2={x + 14} y2={y + 12} strokeWidth={2} />
      <line x1={x - 28} y1={y} x2={x - 14} y2={y} strokeWidth={2} />
      <line x1={x + 14} y1={y} x2={x + 28} y2={y} strokeWidth={2} />
    </g>
  );
}

function drawGround(point: Point) {
  const y = point.y;
  const x = point.x;
  return (
    <g>
      <line x1={x} y1={y - 14} x2={x} y2={y - 2} strokeWidth={2} />
      <line x1={x - 12} y1={y} x2={x + 12} y2={y} strokeWidth={2} />
      <line x1={x - 8} y1={y + 4} x2={x + 8} y2={y + 4} strokeWidth={2} />
      <line x1={x - 4} y1={y + 8} x2={x + 4} y2={y + 8} strokeWidth={2} />
    </g>
  );
}

function drawSource(point: Point) {
  return (
    <g>
      <circle cx={point.x} cy={point.y} r={16} fill="none" strokeWidth={2} />
      <line x1={point.x - 6} y1={point.y - 4} x2={point.x + 6} y2={point.y - 4} strokeWidth={2} />
      <line x1={point.x} y1={point.y - 10} x2={point.x} y2={point.y + 2} strokeWidth={2} />
      <line x1={point.x - 6} y1={point.y + 8} x2={point.x + 6} y2={point.y + 8} strokeWidth={2} />
    </g>
  );
}

function drawDiode(point: Point) {
  const x = point.x;
  const y = point.y;
  return (
    <g>
      <line x1={x - 28} y1={y} x2={x - 10} y2={y} strokeWidth={2} />
      <polygon points={`${x - 10},${y - 10} ${x - 10},${y + 10} ${x + 6},${y}`} fill="none" strokeWidth={2} />
      <line x1={x + 8} y1={y - 12} x2={x + 8} y2={y + 12} strokeWidth={2} />
      <line x1={x + 8} y1={y} x2={x + 28} y2={y} strokeWidth={2} />
    </g>
  );
}

export function CircuitRenderer({ spec }: { spec: CircuitToolSpec }) {
  const width = spec.canvas?.width ?? 900;
  const height = spec.canvas?.height ?? 460;

  const componentById = new Map(spec.components.map((component) => [component.id, component]));

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">{spec.title || "Circuit Diagram"}</h3>

      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-gray-50 p-2">
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} className="min-w-[720px] text-gray-800" role="img" aria-label={spec.title || "Circuit diagram"}>
          <g fill="none" stroke="currentColor" strokeWidth={2}>
            {spec.wires.map((wire, index) => {
              const from = componentById.get(wire.from);
              const to = componentById.get(wire.to);
              if (!from || !to) return null;

              const points = wire.path && wire.path.length > 0
                ? [{ x: from.x, y: from.y }, ...wire.path, { x: to.x, y: to.y }]
                : [{ x: from.x, y: from.y }, { x: to.x, y: to.y }];

              const d = points
                .map((p, pointIndex) => `${pointIndex === 0 ? "M" : "L"} ${p.x} ${p.y}`)
                .join(" ");

              return <path key={wire.id || `wire-${index}`} d={d} />;
            })}
          </g>

          {spec.components.map((component) => {
            const point = { x: component.x, y: component.y };
            const transform = `rotate(${component.rotation || "0"} ${component.x} ${component.y})`;

            return (
              <g key={component.id} transform={transform} stroke="currentColor" fill="none">
                {component.type === "resistor" ? <path d={drawResistor(point)} strokeWidth={2} /> : null}
                {component.type === "capacitor" ? drawCapacitor(point) : null}
                {component.type === "ground" ? drawGround(point) : null}
                {component.type === "source-dc" ? drawSource(point) : null}
                {component.type === "diode" ? drawDiode(point) : null}
                {component.type === "node" ? <circle cx={point.x} cy={point.y} r={4} fill="currentColor" /> : null}
                {component.type === "inductor" ? <text x={point.x - 20} y={point.y + 5} fontSize="12" fill="currentColor">L</text> : null}
                {component.type === "label" ? null : <circle cx={point.x} cy={point.y} r={1.5} fill="currentColor" />}

                {component.label || component.value ? (
                  <text x={point.x + 10} y={point.y - 10} fontSize="12" fill="currentColor">
                    {[component.label, component.value].filter(Boolean).join(" ")}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
