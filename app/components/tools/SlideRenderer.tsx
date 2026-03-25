"use client";

import { useState } from "react";
import type { SlideToolSpec } from "@/app/schemas";

export function SlideRenderer({ spec }: { spec: SlideToolSpec }) {
  const [index, setIndex] = useState(0);
  const slide = spec.slides[index];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{spec.title || "Slides"}</h3>
        <span className="text-xs text-gray-500">{index + 1}/{spec.slides.length}</span>
      </div>

      <div className={`rounded-xl border p-4 min-h-56 ${spec.theme === "dark" ? "bg-gray-900 text-white border-gray-800" : "bg-gray-50 text-gray-900 border-gray-100"}`}>
        <h4 className="text-lg font-semibold mb-3">{slide.heading}</h4>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          {slide.bullets.map((bullet, bulletIndex) => (
            <li key={`${slide.heading}-${bulletIndex}`}>{bullet}</li>
          ))}
        </ul>
        {slide.notes ? (
          <p className="mt-4 text-xs opacity-80">Note: {slide.notes}</p>
        ) : null}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => setIndex((prev) => Math.max(0, prev - 1))}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={index === spec.slides.length - 1}
          onClick={() => setIndex((prev) => Math.min(spec.slides.length - 1, prev + 1))}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
