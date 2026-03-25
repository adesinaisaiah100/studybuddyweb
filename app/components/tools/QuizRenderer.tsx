"use client";

import { useMemo, useState } from "react";
import type { QuizToolSpec } from "@/app/schemas";

type AnswerMap = Record<string, string | number>;

export function QuizRenderer({ spec }: { spec: QuizToolSpec }) {
  const [answers, setAnswers] = useState<AnswerMap>({});

  const score = useMemo(() => {
    let correct = 0;
    for (const q of spec.questions) {
      if (answers[q.id] === q.correctAnswer) {
        correct += 1;
      }
    }
    return {
      correct,
      total: spec.questions.length,
    };
  }, [answers, spec.questions]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Quick Quiz</h3>
        <span className="text-xs text-gray-500">{score.correct}/{score.total} correct</span>
      </div>

      {spec.questions.map((q, index) => (
        <div key={q.id} className="rounded-xl border border-gray-100 p-3 space-y-2">
          <p className="text-sm font-medium text-gray-900">{index + 1}. {q.question}</p>

          {q.type === "mcq" ? (
            <div className="flex flex-wrap gap-2">
              {(q.options || []).map((opt, optIndex) => (
                <button
                  key={`${q.id}-${optIndex}`}
                  onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: optIndex }))}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    answers[q.id] === optIndex
                      ? "border-green-300 bg-green-50 text-green-700"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                  type="button"
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <input
              type="text"
              value={typeof answers[q.id] === "string" ? String(answers[q.id]) : ""}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
              placeholder="Type your answer"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
            />
          )}

          {q.explanation && answers[q.id] !== undefined && (
            <p className="text-xs text-gray-500">{q.explanation}</p>
          )}
        </div>
      ))}
    </div>
  );
}
