"use client";

type ChatSessionListItem = {
  id: string;
  courseId: string;
  title: string;
  preview: string | null;
  totalTokens: number;
  isCompacted: boolean;
  hasSummary: boolean;
  compactedThroughMessageId: string | null;
  createdAt: string;
  updatedAt: string;
};

type ChatSidebarProps = {
  sessions: ChatSessionListItem[];
  loading: boolean;
  selectedSessionId: string | null;
  isDark: boolean;
  isBusy?: boolean;
  onSelectSession: (session: ChatSessionListItem) => void;
  onNewChat: () => void;
  onCloseMobile?: () => void;
};

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) {
    const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    return `${diffMinutes}m ago`;
  }

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return new Intl.DateTimeFormat("en-NG", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export default function ChatSidebar({
  sessions,
  loading,
  selectedSessionId,
  isDark,
  isBusy = false,
  onSelectSession,
  onNewChat,
  onCloseMobile,
}: ChatSidebarProps) {
  return (
    <aside
      className={`flex h-full min-h-0 flex-col rounded-[1.75rem] border ${
        isDark
          ? "border-slate-800 bg-slate-950/80"
          : "border-slate-200 bg-white/90"
      }`}
    >
      <div className="border-b border-inherit px-4 py-4 sm:px-5">
        <button
          type="button"
          onClick={onNewChat}
          disabled={isBusy}
          className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
            isBusy
              ? "cursor-not-allowed opacity-60"
              : isDark
                ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                : "bg-emerald-500 text-white hover:bg-emerald-600"
          }`}
        >
          New Study Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Recent Sessions
        </div>

        {loading ? (
          <div className="space-y-2 px-1">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className={`h-24 animate-pulse rounded-2xl ${
                  isDark ? "bg-slate-900" : "bg-slate-100"
                }`}
              />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div
            className={`rounded-2xl border px-4 py-5 text-sm leading-6 ${
              isDark
                ? "border-slate-800 bg-slate-900 text-slate-400"
                : "border-slate-200 bg-slate-50 text-slate-500"
            }`}
          >
            No sessions yet for this course. Start a new chat and your study history
            will appear here.
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => {
              const active = session.id === selectedSessionId;

              return (
                <button
                  key={session.id}
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    onSelectSession(session);
                    onCloseMobile?.();
                  }}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    active
                      ? isDark
                        ? "border-emerald-500/60 bg-emerald-500/10"
                        : "border-emerald-300 bg-emerald-50"
                      : isDark
                        ? "border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-900"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  } ${isBusy ? "cursor-not-allowed opacity-70" : ""}`}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div
                      className={`line-clamp-1 text-sm font-semibold ${
                        isDark ? "text-slate-100" : "text-slate-900"
                      }`}
                    >
                      {session.title}
                    </div>
                    <div className="shrink-0 text-[11px] text-slate-500">
                      {formatUpdatedAt(session.updatedAt)}
                    </div>
                  </div>
                  <div className="line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {session.preview || "No preview yet."}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    {session.isCompacted ? (
                      <span>Compacted</span>
                    ) : (
                      <span>Live</span>
                    )}
                    <span>&bull;</span>
                    <span>{session.totalTokens} tokens</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
