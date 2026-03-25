"use client";

import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartToolSpec } from "@/app/schemas";

type Row = {
  label: string | number;
  [key: string]: string | number;
};

const PIE_COLORS = ["#16a34a", "#2563eb", "#d97706", "#9333ea", "#dc2626", "#0f766e"];

function buildRows(spec: ChartToolSpec): Row[] {
  const labels = spec.data.labels;
  return labels.map((label, index) => {
    const row: Row = { label };
    for (const dataset of spec.data.datasets) {
      row[dataset.label] = dataset.values[index] ?? 0;
    }
    return row;
  });
}

export function ChartRenderer({ spec }: { spec: ChartToolSpec }) {
  const rows = buildRows(spec);
  const firstSeries = spec.data.datasets[0]?.label;

  if (!firstSeries) {
    return <div className="text-sm text-gray-500">No dataset available.</div>;
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      {spec.title && <h3 className="text-sm font-semibold text-gray-900 mb-3">{spec.title}</h3>}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {spec.type === "line" ? (
            <LineChart data={rows}>
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey={firstSeries} stroke="#16a34a" strokeWidth={2} dot={false} />
            </LineChart>
          ) : spec.type === "bar" || spec.type === "histogram" ? (
            <BarChart data={rows}>
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Bar dataKey={firstSeries} fill="#16a34a" radius={[6, 6, 0, 0]} />
            </BarChart>
          ) : (
            <PieChart>
              <Tooltip />
              <Pie
                data={rows.map((row) => ({
                  name: String(row.label),
                  value: Number(row[firstSeries] ?? 0),
                }))}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                fill="#16a34a"
                label
              >
                {rows.map((row, index) => (
                  <Cell key={`cell-${String(row.label)}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
