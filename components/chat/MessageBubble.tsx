"use client";

import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { mermaid } from "@streamdown/mermaid";
import { math } from "@streamdown/math";
import { cjk } from "@streamdown/cjk";

export type ChatUiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  isStreaming?: boolean;
};

type MessageBubbleProps = {
  message: ChatUiMessage;
  isDark: boolean;
};

export default function MessageBubble({
  message,
  isDark,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const shellClass = isUser
    ? isDark
      ? "ml-auto inline-flex w-fit max-w-[78vw] flex-col rounded-[1.6rem] bg-emerald-500 px-4 py-3 text-white sm:max-w-[34rem] sm:px-5"
      : "ml-auto inline-flex w-fit max-w-[78vw] flex-col rounded-[1.6rem] bg-emerald-500 px-4 py-3 text-white sm:max-w-[34rem] sm:px-5"
    : isDark
      ? "mr-auto px-0 py-0 text-slate-100"
      : "mr-auto px-0 py-0 text-slate-800";

  const labelClass = isUser
    ? "text-white/80"
    : isDark
      ? "text-slate-400"
      : "text-slate-500";

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`w-full max-w-3xl ${shellClass}`}>
        <div
          className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${labelClass}`}
        >
          {isUser ? "You" : "Study Pal"}
        </div>
        <div
          className={`prose prose-sm max-w-none break-words leading-7 ${
            isDark && !isUser
              ? "prose-invert prose-headings:text-white prose-strong:text-white prose-code:text-emerald-200"
              : ""
          }`}
        >
          <Streamdown
            plugins={{
              code,
              mermaid,
              math,
              cjk,
            }}
          >
            {message.content || (message.isStreaming ? " " : "")}
          </Streamdown>
          {message.isStreaming ? (
            <span
              className={`ml-1 inline-block h-4 w-2 rounded-full align-middle ${
                isDark ? "bg-emerald-300" : "bg-emerald-500"
              } animate-pulse`}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
