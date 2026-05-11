"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  ArrowUp,
  BookOpenText,
  Loader2,
  MessagesSquare,
} from "lucide-react";
import MessageBubble, { type ChatUiMessage } from "@/components/chat/MessageBubble";

type CourseOption = {
  id: string;
  code: string;
  title: string;
};

type SessionDetailResponse = {
  success: boolean;
  session: {
    id: string;
    courseId: string;
    title: string;
    summary: string | null;
    totalTokens: number;
    isCompacted: boolean;
    compactedThroughMessageId: string | null;
    createdAt: string;
    updatedAt: string;
  };
  messages: Array<{
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    tokens: number;
    createdAt: string;
  }>;
};

type StreamEvent =
  | {
      type: "session";
      data: {
        sessionId: string;
        title: string;
        courseId: string;
        courseLabel?: string;
      };
    }
  | {
      type: "text_delta";
      data: {
        delta: string;
      };
    }
  | {
      type: "tool_progress";
      data: {
        toolName?: string;
        partialResult?: {
          content?: Array<{
            type?: string;
            text?: string;
          }>;
        };
      };
    }
  | {
      type: "message_end";
      data: {
        sessionId: string;
        message: {
          id: string;
          role: "assistant";
          content: string;
          tokens: number;
          createdAt: string;
        };
      };
    }
  | {
      type: "done";
      data: {
        ok: boolean;
        sessionId: string;
      };
    }
  | {
      type: "error";
      data: {
        message: string;
        sessionId?: string;
      };
    };

type ChatAreaProps = {
  courses: CourseOption[];
  coursesLoading: boolean;
  selectedCourseId: string | null;
  selectedSessionId: string | null;
  isDark: boolean;
  onCourseChange: (courseId: string) => void;
  onSessionChange: (sessionId: string | null) => void;
  onSessionsRefresh: () => void;
};

const fetcher = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  const data = (await response.json()) as T & { success?: boolean; error?: string };

  if (!response.ok || data.success === false) {
    throw new Error(data.error ?? "Request failed.");
  }

  return data;
};

function parseSseEvent(rawEvent: string): StreamEvent | null {
  const lines = rawEvent.split(/\r?\n/);
  let event = "";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (!event || dataLines.length === 0) {
    return null;
  }

  const parsedData = JSON.parse(dataLines.join("\n")) as unknown;

  switch (event) {
    case "session":
      return {
        type: "session",
        data: parsedData as {
          sessionId: string;
          title: string;
          courseId: string;
          courseLabel?: string;
        },
      };
    case "text_delta":
      return {
        type: "text_delta",
        data: parsedData as {
          delta: string;
        },
      };
    case "tool_progress":
      return {
        type: "tool_progress",
        data: parsedData as {
          toolName?: string;
          partialResult?: {
            content?: Array<{
              type?: string;
              text?: string;
            }>;
          };
        },
      };
    case "message_end":
      return {
        type: "message_end",
        data: parsedData as {
          sessionId: string;
          message: {
            id: string;
            role: "assistant";
            content: string;
            tokens: number;
            createdAt: string;
          };
        },
      };
    case "done":
      return {
        type: "done",
        data: parsedData as {
          ok: boolean;
          sessionId: string;
        },
      };
    case "error":
      return {
        type: "error",
        data: parsedData as {
          message: string;
          sessionId?: string;
        },
      };
    default:
      return null;
  }
}

async function readSseStream(
  response: Response,
  onEvent: (event: StreamEvent) => void,
) {
  if (!response.body) {
    throw new Error("Streaming response body is missing.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, "\n");

    let boundaryIndex = buffer.indexOf("\n\n");
    while (boundaryIndex >= 0) {
      const rawEvent = buffer.slice(0, boundaryIndex).trim();
      buffer = buffer.slice(boundaryIndex + 2);

      if (rawEvent) {
        const parsed = parseSseEvent(rawEvent);
        if (parsed) {
          onEvent(parsed);
        }
      }

      boundaryIndex = buffer.indexOf("\n\n");
    }
  }
}

function mapSessionMessages(
  messages: SessionDetailResponse["messages"],
): ChatUiMessage[] {
  return messages
    .filter(
      (
        message,
      ): message is SessionDetailResponse["messages"][number] & {
        role: "user" | "assistant";
      } => message.role === "user" || message.role === "assistant",
    )
    .map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    }));
}

export default function ChatArea({
  courses,
  coursesLoading,
  selectedCourseId,
  selectedSessionId,
  isDark,
  onCourseChange,
  onSessionChange,
  onSessionsRefresh,
}: ChatAreaProps) {
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamError, setStreamError] = useState("");
  const [toolStatus, setToolStatus] = useState("");
  const [materialNotice, setMaterialNotice] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const sessionDetailKey = selectedSessionId
    ? `/api/chat/sessions/${selectedSessionId}`
    : null;
  const {
    data: sessionDetail,
    isLoading: sessionLoading,
    mutate: mutateSessionDetail,
  } = useSWR<SessionDetailResponse>(sessionDetailKey, fetcher);

  const hasConversation = messages.length > 0;

  useEffect(() => {
    if (!sessionDetail || sending) {
      return;
    }

    setMessages(mapSessionMessages(sessionDetail.messages));
  }, [sending, sessionDetail]);

  useEffect(() => {
    if (selectedSessionId) {
      return;
    }

    if (!sending) {
      setMessages([]);
      setToolStatus("");
      setStreamError("");
    }
  }, [selectedSessionId, sending]);

  useEffect(() => {
    setMaterialNotice(null);
  }, [selectedCourseId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, toolStatus]);

  const handleSend = async (force = false) => {
    const trimmed = input.trim();

    if (!trimmed || !selectedCourseId || sending) {
      return;
    }

    try {
      if (!force && !selectedSessionId && messages.length === 0) {
        const statusResponse = await fetch(
          `/api/chat/material-status?courseId=${selectedCourseId}`,
        );
        const statusPayload = (await statusResponse.json()) as {
          success?: boolean;
          hasMaterials?: boolean;
          error?: string;
        };

        if (!statusResponse.ok || statusPayload.success === false) {
          throw new Error(statusPayload.error ?? "Failed to check course materials.");
        }

        if (!statusPayload.hasMaterials) {
          setMaterialNotice(
            "No materials uploaded for this course yet. Upload notes, textbooks, slides, or PDFs first.",
          );
          return;
        }
      }

      const tempUserMessage: ChatUiMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      const tempAssistantMessage: ChatUiMessage = {
        id: `assistant-draft-${Date.now()}`,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
        isStreaming: true,
      };

      setSending(true);
      setStreamError("");
      setToolStatus("");
      setInput("");
      setMessages((current) => [...current, tempUserMessage, tempAssistantMessage]);

      let resolvedSessionId = selectedSessionId;

      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmed,
          courseId: selectedCourseId,
          sessionId: selectedSessionId,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to start Study Pal stream.");
      }

      await readSseStream(response, (event) => {
        if (event.type === "session") {
          resolvedSessionId = event.data.sessionId;
          onSessionChange(event.data.sessionId);
          onSessionsRefresh();
        } else if (event.type === "text_delta") {
          setMessages((current) =>
            current.map((message) =>
              message.isStreaming
                ? { ...message, content: `${message.content}${event.data.delta}` }
                : message,
            ),
          );
        } else if (event.type === "tool_progress") {
          const statusText = event.data.partialResult?.content
            ?.filter((item) => item.type === "text" && item.text)
            .map((item) => item.text)
            .join(" ")
            .trim();

          if (statusText) {
            setToolStatus(statusText);
          } else if (event.data.toolName) {
            setToolStatus(`Running ${event.data.toolName.replaceAll("_", " ")}...`);
          }
        } else if (event.type === "message_end") {
          setMessages((current) =>
            current.map((message) =>
              message.isStreaming
                ? {
                    id: event.data.message.id,
                    role: "assistant",
                    content: event.data.message.content,
                    createdAt: event.data.message.createdAt,
                  }
                : message,
            ),
          );
          setToolStatus("");
        } else if (event.type === "error") {
          setStreamError(event.data.message);
        }
      });

      onSessionsRefresh();
      if (resolvedSessionId) {
        onSessionChange(resolvedSessionId);
        if (resolvedSessionId === selectedSessionId) {
          await mutateSessionDetail();
        }
      }
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : "Study Pal stream failed.";
      setStreamError(messageText);
      setMessages((current) =>
        current.filter((message) => !message.isStreaming),
      );
    } finally {
      setSending(false);
      setToolStatus("");
    }
  };

  const composer = (
    <div
      className={`rounded-[1.75rem] border p-4 ${
        isDark
          ? "border-slate-700 bg-transparent"
          : "border-slate-300 bg-slate-50"
      }`}
    >
      <div className="flex items-center gap-3 px-2 pb-2">
        <BookOpenText className="h-4 w-4 shrink-0 text-emerald-500" />
        <select
          value={selectedCourseId ?? ""}
          onChange={(event) => onCourseChange(event.target.value)}
          disabled={coursesLoading || sending || courses.length === 0}
          className={`min-w-0 max-w-[13rem] rounded-full px-3 py-2 text-xs font-medium outline-none sm:max-w-none ${
            isDark
              ? "bg-emerald-500/15 text-emerald-200"
              : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {courses.length === 0 ? (
            <option value="">No courses available</option>
          ) : null}
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.code}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-end gap-3">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void handleSend();
            }
          }}
          rows={hasConversation ? 3 : 1}
          placeholder={
            selectedCourseId
              ? "Ask Study Pal anything..."
              : "Choose a course first to start chatting."
          }
          disabled={!selectedCourseId || sending || coursesLoading}
          className={`min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-6 outline-none ${
            isDark
              ? "text-slate-100 placeholder:text-slate-500"
              : "text-slate-700 placeholder:text-slate-400"
          }`}
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!input.trim() || !selectedCourseId || sending}
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition ${
            !input.trim() || !selectedCourseId || sending
              ? "cursor-not-allowed bg-slate-300 text-white"
              : "bg-emerald-500 text-white hover:bg-emerald-600"
          } ${isDark && (!input.trim() || !selectedCourseId || sending) ? "bg-slate-700" : ""}`}
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowUp className="h-4 w-4" />
          )}
        </button>
      </div>

      {hasConversation ? (
        <div className="mt-3 flex items-center gap-2 px-2 text-xs text-slate-500">
          <MessagesSquare className="h-4 w-4 text-emerald-500" />
          <span>
            {sending ? "Study Pal is responding..." : "Shift + Enter for a new line"}
          </span>
        </div>
      ) : null}

      {materialNotice ? (
        <div
          className={`mt-3 rounded-2xl border px-4 py-3 text-sm ${
            isDark
              ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          <div className="mb-2">{materialNotice}</div>
          <div className="mb-2">If you still want to continue, click Send again.</div>
          <div className="flex items-center gap-3">
            <Link
              href={`/dashboard/course/${selectedCourseId ?? ""}`}
              className="font-semibold underline underline-offset-4"
            >
              Click here
            </Link>
            <span className="ml-1">to upload materials and notes.</span>
            <button
              type="button"
              className="ml-2 px-3 py-1 rounded bg-amber-600 text-sm text-white hover:bg-amber-500"
              onClick={() => void handleSend(true)}
            >
              Send anyway
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <section
      className={`flex h-full min-h-0 flex-col rounded-[2rem] ${
      isDark
          ? "bg-transparent"
          : "bg-white"
      }`}
      >
      {hasConversation ? (
        <>
          <div
            ref={scrollRef}
            className="flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8"
          >
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} isDark={isDark} />
            ))}

            {toolStatus ? (
              <div
                className={`mx-auto max-w-3xl rounded-2xl px-4 py-3 text-sm ${
                  isDark
                    ? "bg-slate-900/60 text-slate-300"
                    : "bg-slate-50 text-slate-600"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                  <span>{toolStatus}</span>
                </div>
              </div>
            ) : null}

            {streamError ? (
              <div className="mx-auto max-w-3xl rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {streamError}
              </div>
            ) : null}

            {sessionLoading && selectedSessionId && !sending ? (
              <div className="flex justify-center py-3">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
              </div>
            ) : null}
          </div>

          <div className="px-4 py-4 sm:px-6">
            {composer}
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
          <div className="w-full max-w-5xl">
            <div className="mx-auto max-w-3xl px-4 text-center">
              <div
                className={`mb-3 text-4xl font-semibold sm:text-5xl mb-8 ${
                  isDark ? "text-slate-100" : "text-slate-900"
                }`}
              >
                Study Pal
              </div>
            </div>

            <div className="mx-auto max-w-5xl">{composer}</div>

            {streamError ? (
              <div className="mx-auto mt-4 max-w-3xl rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {streamError}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
