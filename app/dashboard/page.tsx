"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Titillium_Web, Outfit } from "next/font/google";
import {
  GraduationCap,
  LogOut,
  Plus,
  Clock,
  MapPin,
  BookOpen,
  Loader2,
} from "lucide-react";

const titillium = Titillium_Web({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type Schedule = {
  id: string;
  day: string;
  time_slot: string;
  venue: string | null;
};

type Course = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  course_schedules: Schedule[];
};

type Profile = {
  full_name: string;
  university: string;
};

// Color palette for course cards
const CARD_COLORS = [
  { bg: "bg-emerald-50", border: "border-emerald-200", accent: "text-emerald-600", dot: "bg-emerald-500" },
  { bg: "bg-blue-50", border: "border-blue-200", accent: "text-blue-600", dot: "bg-blue-500" },
  { bg: "bg-purple-50", border: "border-purple-200", accent: "text-purple-600", dot: "bg-purple-500" },
  { bg: "bg-amber-50", border: "border-amber-200", accent: "text-amber-600", dot: "bg-amber-500" },
  { bg: "bg-rose-50", border: "border-rose-200", accent: "text-rose-600", dot: "bg-rose-500" },
  { bg: "bg-cyan-50", border: "border-cyan-200", accent: "text-cyan-600", dot: "bg-cyan-500" },
  { bg: "bg-indigo-50", border: "border-indigo-200", accent: "text-indigo-600", dot: "bg-indigo-500" },
  { bg: "bg-teal-50", border: "border-teal-200", accent: "text-teal-600", dot: "bg-teal-500" },
];

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();

  const [courses, setCourses] = useState<Course[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/");
        return;
      }

      // Load profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, university")
        .eq("id", user.id)
        .single();

      if (profileData) setProfile(profileData);

      // Load courses with schedules
      const { data: coursesData } = await supabase
        .from("courses")
        .select("*, course_schedules(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (coursesData) setCourses(coursesData);
      setLoading(false);
    }

    loadData();
  }, [supabase, router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const firstName = profile?.full_name?.split(" ")[0] || "Student";

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-green-50/30 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
          <p className={`text-gray-500 ${outfit.className}`}>Loading your courses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-green-50/30 px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-10 sm:mb-12">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-green-600" />
            </div>
            <span className={`text-xl font-bold text-gray-900 ${titillium.className}`}>
              StudyBuddy
            </span>
          </div>
          <button
            onClick={handleSignOut}
            className={`flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 transition-colors ${outfit.className}`}
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>

        {/* Welcome */}
        <div className={`mb-8 sm:mb-12 ${outfit.className}`}>
          <h1 className={`text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2 ${titillium.className}`}>
            {getGreeting()}, {firstName}. 👋
          </h1>
          <p className="text-gray-500 text-base sm:text-lg">
            {courses.length > 0
              ? `You have ${courses.length} course${courses.length !== 1 ? "s" : ""} this semester.`
              : "No courses yet. Upload your timetable to get started."}
          </p>
        </div>

        {/* Course Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {courses.map((course, index) => {
            const colors = CARD_COLORS[index % CARD_COLORS.length];
            return (
              <div
                key={course.id}
                onClick={() => router.push(`/dashboard/course/${course.id}`)}
                className={`group relative ${colors.bg} ${colors.border} border rounded-2xl sm:rounded-3xl p-5 sm:p-6 cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-300`}
              >
                {/* Color dot */}
                <div className={`w-3 h-3 rounded-full ${colors.dot} mb-4`} />

                {/* Course code */}
                <p className={`text-sm font-semibold ${colors.accent} mb-1 tracking-wide uppercase`}>
                  {course.code}
                </p>

                {/* Course title */}
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 leading-snug">
                  {course.title}
                </h3>

                {/* Schedule pills */}
                {course.course_schedules && course.course_schedules.length > 0 && (
                  <div className="space-y-2">
                    {course.course_schedules.slice(0, 3).map((slot) => (
                      <div
                        key={slot.id}
                        className="flex items-center gap-2 text-sm text-gray-600"
                      >
                        <Clock className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                        <span>{slot.day.slice(0, 3)} • {slot.time_slot}</span>
                        {slot.venue && (
                          <>
                            <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-gray-400 ml-1" />
                            <span>{slot.venue}</span>
                          </>
                        )}
                      </div>
                    ))}
                    {course.course_schedules.length > 3 && (
                      <p className="text-xs text-gray-400">
                        +{course.course_schedules.length - 3} more
                      </p>
                    )}
                  </div>
                )}

                {/* Hover arrow */}
                <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <BookOpen className={`w-5 h-5 ${colors.accent}`} />
                </div>
              </div>
            );
          })}

          {/* Add Course Card */}
          <button
            onClick={() => {
              // TODO: Add manual course creation modal
            }}
            className="group border-2 border-dashed border-gray-200 rounded-2xl sm:rounded-3xl p-5 sm:p-6 flex flex-col items-center justify-center gap-3 hover:border-green-300 hover:bg-green-50/30 transition-all duration-200 min-h-[200px] cursor-pointer"
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
    </div>
  );
}
