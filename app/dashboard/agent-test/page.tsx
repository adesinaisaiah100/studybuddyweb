"use client";

import { useState } from "react";
import Link from "next/link";
import { Streamdown } from 'streamdown';
import { code } from '@streamdown/code';
import { mermaid } from '@streamdown/mermaid';
import { math } from '@streamdown/math';
import { cjk } from '@streamdown/cjk';

type AgentTestResponse = {
  success: boolean;
  text?: string;
  error?: string;
  message?: unknown;
};

export default function AgentTestPage() {
  const [prompt, setPrompt] = useState(
    "Explain weisbach theroem in fluid mechnics and how can findthe value of the friction factor using it?",
  );
  const [courseId, setCourseId] = useState("92428409-0bed-4df2-8daa-5c51f2653a13");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string>("");

  const runAgent = async () => {
    setLoading(true);
    setError("");
    setResult("");

    try {
      const response = await fetch("/api/agent-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          courseId,
        }),
      });

      const data = (await response.json()) as AgentTestResponse;
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Agent request failed.");
      }

      setResult(data.text ?? "");
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-5 sm:px-4 sm:py-10">
      <div className="mx-auto mb-3 w-full max-w-4xl sm:mb-4">
        <Link
          href="/dashboard"
          aria-label="Back to Dashboard"
          title="Back to Dashboard"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm hover:bg-slate-50"
        >
          <span className="text-base leading-none text-slate-700">←</span>
          <span>Back to Dashboard</span>
        </Link>
      </div>

      <div className="mx-auto w-full max-w-4xl rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-2xl sm:p-6">
        <div className="mb-5 sm:mb-6">
          <h1 className="text-lg font-semibold leading-tight text-slate-900 sm:text-xl">
            Study Pal Agent RAG Test
          </h1>
        </div>

        <p className="mb-5 text-sm text-slate-600 sm:mb-6">
          Temporary internal page for testing the agent with real logged-in session auth.
        </p>

        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Course ID
            <input
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-slate-500"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Prompt
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={7}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-slate-500 sm:rows-6 md:max-w-3xl"
            />
          </label>

          <button
            onClick={runAgent}
            disabled={loading}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {loading ? "Running..." : "Run Study Agent"}
          </button>
        </div>

        {error ? (
          <div className="mt-6 rounded-lg border border-slate-300 bg-slate-100 p-4 text-sm text-slate-800">
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="mt-6">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Agent Response</h2>
            <div className="max-h-[65vh] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-neutral-800 sm:p-4">
              <Streamdown
                plugins={{
                  code: code,
                  mermaid: mermaid,
                  math: math,
                  cjk: cjk,
                }}
              >
                {result}
              </Streamdown>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
