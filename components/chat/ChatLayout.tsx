"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Loader2, LogOut, PanelLeft, X } from "lucide-react";
import BrandWordmark from "@/app/components/BrandWordmark";
import DashboardThemeToggle from "@/app/components/DashboardThemeToggle";
import { useDashboardTheme } from "@/lib/hooks/useDashboardTheme";
import { createClient } from "@/lib/supabase/client";
import ChatSidebar from "@/components/chat/ChatSidebar";
import ChatArea from "@/components/chat/ChatArea";

type CourseOption = {
  id: string;
  code: string;
  title: string;
};

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

const fetchJson = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  const data = (await response.json()) as T & { success?: boolean; error?: string };

  if (!response.ok || data.success === false) {
    throw new Error(data.error ?? "Request failed.");
  }

  return data;
};

export default function ChatLayout() {
  const supabase = createClient();
  const router = useRouter();
  const { isDark, toggleTheme } = useDashboardTheme();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");

    const syncSidebarState = () => {
      setSidebarOpen(mediaQuery.matches);
    };

    syncSidebarState();
    mediaQuery.addEventListener("change", syncSidebarState);

    return () => {
      mediaQuery.removeEventListener("change", syncSidebarState);
    };
  }, []);

  const {
    data: coursesData,
    error: coursesError,
    isLoading: coursesLoading,
  } = useSWR("study-pal-courses", async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      throw new Error("No user");
    }

    const { data, error } = await supabase
      .from("courses")
      .select("id, code, title")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return data as CourseOption[];
  });

  const courses = useMemo(() => coursesData ?? [], [coursesData]);
  const activeCourseId = selectedCourseId ?? courses[0]?.id ?? null;

  const sessionsUrl = useMemo(() => {
    if (!activeCourseId) {
      return null;
    }

    return `/api/chat/sessions?courseId=${encodeURIComponent(activeCourseId)}`;
  }, [activeCourseId]);

  const {
    data: sessionsData,
    error: sessionsError,
    isLoading: sessionsLoading,
    mutate: mutateSessions,
  } = useSWR<{ success: boolean; sessions: ChatSessionListItem[] }>(
    sessionsUrl,
    fetchJson,
  );

  const sessions = useMemo(() => sessionsData?.sessions ?? [], [sessionsData]);
  const activeSessionId = useMemo(() => {
    if (!selectedSessionId) {
      return null;
    }

    return sessions.some((session) => session.id === selectedSessionId)
      ? selectedSessionId
      : null;
  }, [selectedSessionId, sessions]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <div
      className={`min-h-screen ${isDark ? "bg-slate-950" : "bg-white"} ${isDark ? "dashboard-theme-dark" : "dashboard-theme-light"} dashboard-theme-shell`}
    >
      <div className="flex min-h-screen w-full flex-col px-3 py-3 sm:px-6 sm:py-4">
        <header className="flex w-full items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-5 sm:gap-8">
            <button
              type="button"
              onClick={() => setSidebarOpen((current) => !current)}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border shrink-0 ${
                isDark
                  ? "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                  : "border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
              aria-label={sidebarOpen ? "Close sessions sidebar" : "Open sessions sidebar"}
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? <X className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            </button>
            <Image
              src={isDark ? "/Logo%20Dark%20Mode.png" : "/Logo1.png"}
              alt="LEARNIVERSE Logo"
              width={40}
              height={40}
              className="h-8 w-8 shrink-0 object-contain sm:h-10 sm:w-10"
              priority
            />
            <BrandWordmark className="truncate text-sm text-gray-900 sm:text-xl" />
          </div>

          <div className="flex items-center gap-2">
            <DashboardThemeToggle
              isDark={isDark}
              onToggle={toggleTheme}
              className="origin-right scale-90 sm:scale-100"
            />
            <button
              onClick={handleSignOut}
              className="inline-flex items-center justify-center rounded-full p-2 text-sm text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        <div className="mt-6 flex w-full items-center justify-start gap-3">
          <Link
            href="/dashboard"
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors ${
              isDark
                ? "border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-900 hover:text-slate-100"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Return to Dashboard</span>
          </Link>
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 lg:mt-6 lg:flex-row lg:gap-6">
          <aside
            className={`hidden min-h-0 overflow-hidden rounded-[1.75rem] transition-all duration-300 lg:flex lg:flex-col ${
              sidebarOpen ? "lg:w-80 lg:opacity-100" : "lg:w-0 lg:opacity-0 lg:pointer-events-none"
            }`}
          >
            <div
              className={`h-full border-r ${
                isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"
              }`}
            >
              <ChatSidebar
                sessions={sessions}
                loading={sessionsLoading}
                selectedSessionId={selectedSessionId}
                isDark={isDark}
                onSelectSession={(session) => {
                  setSelectedCourseId(session.courseId);
                  setSelectedSessionId(session.id);
                }}
                onNewChat={() => setSelectedSessionId(null)}
              />
            </div>
          </aside>

          <main className="flex min-h-0 flex-1 items-center justify-center pt-0">
            <div className="h-full w-full max-w-5xl">
              {coursesLoading ? (
                <div className="flex min-h-[55vh] items-center justify-center">
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                    <p className="text-sm text-gray-500">Loading your study workspace...</p>
                  </div>
                </div>
              ) : coursesError ? (
                <div className="rounded-[2rem] border border-rose-300 bg-rose-50 px-6 py-5 text-sm text-rose-700">
                  {coursesError.message}
                </div>
              ) : courses.length === 0 ? (
                <div
                  className={`rounded-[2rem] border px-6 py-8 ${
                    isDark
                      ? "border-slate-800 bg-slate-950 text-slate-300"
                      : "border-slate-200 bg-slate-50 text-slate-600"
                  }`}
                >
                  Add a course first before starting a Study Pal conversation.
                </div>
              ) : (
                <ChatArea
                  courses={courses}
                  coursesLoading={coursesLoading}
                  selectedCourseId={activeCourseId}
                  selectedSessionId={activeSessionId}
                  isDark={isDark}
                  onCourseChange={(courseId) => {
                    setSelectedCourseId(courseId);
                    setSelectedSessionId(null);
                    void mutateSessions();
                  }}
                  onSessionChange={(sessionId) => setSelectedSessionId(sessionId)}
                  onSessionsRefresh={() => {
                    void mutateSessions();
                  }}
                />
              )}
            </div>
          </main>
        </div>

        <div
          className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${
            sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px]"
          />
          <div
            className={`absolute inset-y-0 left-0 w-[18rem] overflow-y-auto border-r shadow-2xl transition-transform duration-300 sm:w-80 ${
              isDark
                ? "border-slate-800 bg-slate-950"
                : "border-slate-200 bg-white"
            } ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="flex items-center justify-between border-b border-inherit px-4 py-4">
              <h2 className={`text-lg font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                Sessions
              </h2>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border ${
                  isDark
                    ? "border-slate-700 bg-slate-900 text-slate-200"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4">
              <ChatSidebar
                sessions={sessions}
                loading={sessionsLoading}
                selectedSessionId={selectedSessionId}
                isDark={isDark}
                onSelectSession={(session) => {
                  setSelectedCourseId(session.courseId);
                  setSelectedSessionId(session.id);
                  setSidebarOpen(false);
                }}
                onNewChat={() => {
                  setSelectedSessionId(null);
                  setSidebarOpen(false);
                }}
                onCloseMobile={() => setSidebarOpen(false)}
              />
            </div>
          </div>
        </div>

        {sessionsError ? (
          <div className="fixed bottom-4 right-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-lg">
            {sessionsError.message}
          </div>
        ) : null}
      </div>
    </div>
  );
}
