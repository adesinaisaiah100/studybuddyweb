"use client";

import { useState } from "react";
import type { FlashcardToolSpec } from "@/app/schemas";

export function FlashcardRenderer({ spec }: { spec: FlashcardToolSpec }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const card = spec.cards[index];
  const canPrev = index > 0;
  const canNext = index < spec.cards.length - 1;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Flashcards</h3>
        <span className="text-xs text-gray-500">{index + 1}/{spec.cards.length}</span>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((prev) => !prev)}
        className="w-full min-h-36 rounded-xl border border-gray-200 bg-gray-50 px-4 py-6 text-left"
      >
        <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">{flipped ? "Back" : "Front"}</p>
        <p className="text-sm text-gray-900">{flipped ? card.back : card.front}</p>
      </button>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => {
            setIndex((prev) => Math.max(0, prev - 1));
            setFlipped(false);
          }}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => {
            setIndex((prev) => Math.min(spec.cards.length - 1, prev + 1));
            setFlipped(false);
          }}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
