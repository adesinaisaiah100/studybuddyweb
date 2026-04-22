"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Titillium_Web, Outfit } from "next/font/google";
import Image from "next/image";
import BrandWordmark from "@/app/components/BrandWordmark";
import DashboardThemeToggle from "@/app/components/DashboardThemeToggle";
import { useDashboardTheme } from "@/lib/hooks/useDashboardTheme";
import {
  LogOut,
  Plus,
  Clock,
  MapPin,
  BookOpen,
  Loader2,
  X,
  UploadCloud,
  ArrowLeft,
} from "lucide-react";

const titillium = Titillium_Web({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const CARD_COLORS = [
  {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    accent: "text-emerald-600",
    dot: "bg-emerald-500",
    darkBg: "bg-emerald-950/45",
    darkBorder: "border-emerald-800",
    darkAccent: "text-emerald-300",
    darkDot: "bg-emerald-400",
  },
  {
    bg: "bg-blue-50",
    border: "border-blue-200",
    accent: "text-blue-600",
    dot: "bg-blue-500",
    darkBg: "bg-blue-950/45",
    darkBorder: "border-blue-800",
    darkAccent: "text-blue-300",
    darkDot: "bg-blue-400",
  },
  {
    bg: "bg-purple-50",
    border: "border-purple-200",
    accent: "text-purple-600",
    dot: "bg-purple-500",
    darkBg: "bg-violet-950/45",
    darkBorder: "border-violet-800",
    darkAccent: "text-violet-300",
    darkDot: "bg-violet-400",
  },
  {
    bg: "bg-amber-50",
    border: "border-amber-200",
    accent: "text-amber-600",
    dot: "bg-amber-500",
    darkBg: "bg-amber-950/40",
    darkBorder: "border-amber-800",
    darkAccent: "text-amber-300",
    darkDot: "bg-amber-400",
  },
  {
    bg: "bg-rose-50",
    border: "border-rose-200",
    accent: "text-rose-600",
    dot: "bg-rose-500",
    darkBg: "bg-rose-950/45",
    darkBorder: "border-rose-800",
    darkAccent: "text-rose-300",
    darkDot: "bg-rose-400",
  },
  {
    bg: "bg-cyan-50",
    border: "border-cyan-200",
    accent: "text-cyan-600",
    dot: "bg-cyan-500",
    darkBg: "bg-cyan-950/45",
    darkBorder: "border-cyan-800",
    darkAccent: "text-cyan-300",
    darkDot: "bg-cyan-400",
  },
  {
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    accent: "text-indigo-600",
    dot: "bg-indigo-500",
    darkBg: "bg-indigo-950/45",
    darkBorder: "border-indigo-800",
    darkAccent: "text-indigo-300",
    darkDot: "bg-indigo-400",
  },
  {
    bg: "bg-teal-50",
    border: "border-teal-200",
    accent: "text-teal-600",
    dot: "bg-teal-500",
    darkBg: "bg-teal-950/45",
    darkBorder: "border-teal-800",
    darkAccent: "text-teal-300",
    darkDot: "bg-teal-400",
  },
];

export default function DashboardCoursesPage() {
  const supabase = createClient();
  const router = useRouter();
  const { isDark, toggleTheme } = useDashboardTheme();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCourseCode, setNewCourseCode] = useState("");
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [outlineFile, setOutlineFile] = useState<File | null>(null);

  const fetcher = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      throw new Error("No user");
    }

    const [profileRes, coursesRes] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", user.id).single(),
      supabase
        .from("courses")
        .select("*, course_schedules(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),
    ]);

    return {
      profile: profileRes.data,
      courses: coursesRes.data || [],
    };
  };

  const { data, error, mutate } = useSWR("dashboard-courses-data", fetcher);

  const loading = !data && !error;
  const profile = data?.profile;
  const courses = data?.courses || [];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseCode || !newCourseTitle) return;

    setIsAdding(true);
    setAddError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setAddError("Not authenticated");
      setIsAdding(false);
      return;
    }

    const { data: course, error: addCourseError } = await supabase
      .from("courses")
      .insert({
        user_id: user.id,
        code: newCourseCode.trim(),
        title: newCourseTitle.trim(),
      })
      .select()
      .single();

    if (addCourseError || !course) {
      setAddError("Failed to add course. Please try again.");
      setIsAdding(false);
      return;
    }

    await mutate();

    setIsAdding(false);
    setIsAddModalOpen(false);
    setNewCourseCode("");
    setNewCourseTitle("");
    setOutlineFile(null);
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? "bg-slate-900" : "bg-white"} ${isDark ? "dashboard-theme-dark" : "dashboard-theme-light"} dashboard-theme-shell`}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
          <p className={`text-gray-500 ${outfit.className}`}>Loading your courses...</p>
        </div>
      </div>
    );
  }

  const firstName = profile?.full_name?.split(" ")[0] || "Student";

  return (
    <div className={`min-h-screen px-4 sm:px-6 py-6 sm:py-10 ${isDark ? "bg-slate-900" : "bg-white"} ${isDark ? "dashboard-theme-dark" : "dashboard-theme-light"} dashboard-theme-shell`}>
      <div className="w-full px-5 mx-auto">
        <div className="flex items-center justify-between mb-10 sm:mb-12">
          <div className="flex items-center gap-3">
            <Image
              src={isDark ? "/Logo%20Dark%20Mode.png" : "/Logo1.png"}
              alt="LEARNIVERSE Logo"
              width={40}
              height={40}
              className="object-contain"
              priority
            />
            <BrandWordmark className="text-xl text-gray-900" />
          </div>
          <div className="flex items-center gap-3">
            <DashboardThemeToggle isDark={isDark} onToggle={toggleTheme} />
            <button
              onClick={handleSignOut}
              className={`flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 transition-colors ${outfit.className}`}
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>

        <div className={`mb-8 sm:mb-12 ${outfit.className}`}>
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <h1 className={`text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2 ${titillium.className}`}>
            My Courses, {firstName}
          </h1>
          <p className="text-gray-500 text-base sm:text-lg">
            {courses.length > 0
              ? `You have ${courses.length} course${courses.length !== 1 ? "s" : ""} this semester.`
              : "No courses yet. Add your first course to get started."}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {courses.map((course, index) => {
            const colors = CARD_COLORS[index % CARD_COLORS.length];

            return (
              <div
                key={course.id}
                onClick={() => router.push(`/dashboard/course/${course.id}`)}
                className={`group relative ${isDark ? colors.darkBg : colors.bg} ${isDark ? colors.darkBorder : colors.border} border rounded-2xl sm:rounded-3xl p-5 sm:p-6 cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-300`}
              >
                <div className={`w-3 h-3 rounded-full ${isDark ? colors.darkDot : colors.dot} mb-4`} />

                <p className={`text-sm font-semibold ${isDark ? colors.darkAccent : colors.accent} mb-1 tracking-wide uppercase`}>
                  {course.code}
                </p>

                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 leading-snug">{course.title}</h3>

                {course.course_schedules && course.course_schedules.length > 0 && (
                  <div className="space-y-2">
                    {course.course_schedules
                      .slice(0, 3)
                      .map((slot: { id: string; day: string; time_slot: string; venue: string | null }) => (
                        <div key={slot.id} className="flex items-center gap-2 text-sm text-gray-600">
                          <Clock className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                          <span>
                            {slot.day.slice(0, 3)} • {slot.time_slot}
                          </span>
                          {slot.venue && (
                            <>
                              <MapPin className="w-3.5 h-3.5 shrink-0 text-gray-400 ml-1" />
                              <span>{slot.venue}</span>
                            </>
                          )}
                        </div>
                      ))}
                    {course.course_schedules.length > 3 && (
                      <p className="text-xs text-gray-400">+{course.course_schedules.length - 3} more</p>
                    )}
                  </div>
                )}

                <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <BookOpen className={`w-5 h-5 ${isDark ? colors.darkAccent : colors.accent}`} />
                </div>
              </div>
            );
          })}

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="group border-2 border-dashed border-gray-200 rounded-2xl sm:rounded-3xl p-5 sm:p-6 flex flex-col items-center justify-center gap-3 hover:border-green-300 hover:bg-green-50/30 transition-all duration-200 min-h-50 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-gray-100 group-hover:bg-green-100 flex items-center justify-center transition-colors duration-200">
              <Plus className="w-6 h-6 text-gray-400 group-hover:text-green-600 transition-colors duration-200" />
            </div>
            <p className={`text-sm font-medium text-gray-400 group-hover:text-green-600 transition-colors duration-200 ${outfit.className}`}>
              Add a Course
            </p>
          </button>
        </div>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className={`text-2xl font-bold text-gray-900 mb-6 ${titillium.className}`}>Add New Course</h2>

            <form onSubmit={handleAddCourse} className={`space-y-4 ${outfit.className}`}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MAT101"
                  value={newCourseCode}
                  onChange={(e) => setNewCourseCode(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Introduction to Calculus"
                  value={newCourseTitle}
                  onChange={(e) => setNewCourseTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition-all"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Course Outline (main slide/pdf)</label>
                <div
                  className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center relative ${
                    outlineFile
                      ? "bg-green-50 border-green-200"
                      : "bg-gray-50 border-gray-200 hover:border-green-400 hover:bg-green-50/50 transition-colors"
                  }`}
                >
                  <input
                    type="file"
                    required
                    accept=".pdf,.pptx,.docx,.txt,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setOutlineFile(e.target.files[0]);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <UploadCloud className={`w-8 h-8 mb-3 ${outlineFile ? "text-green-600" : "text-gray-400"}`} />
                  {outlineFile ? (
                    <p className="text-sm font-semibold text-green-700">{outlineFile.name}</p>
                  ) : (
                    <div className="text-sm text-gray-500">
                      <span className="font-semibold text-green-600">Click to upload</span> or drag and drop
                      <p className="text-xs text-gray-400 mt-1">PDF, PPTX, DOCX, TXT, PNG, JPG, JPEG (max. 10MB)</p>
                    </div>
                  )}
                </div>
              </div>

              {addError && <p className="text-red-500 text-sm mt-2">{addError}</p>}

              <button
                type="submit"
                disabled={isAdding}
                className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {isAdding ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Adding...
                  </>
                ) : (
                  "Add Course"
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


