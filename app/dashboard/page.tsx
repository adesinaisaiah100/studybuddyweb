"use client";

import React from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Titillium_Web, Outfit } from "next/font/google";
import Image from "next/image";
import BrandWordmark from "@/app/components/BrandWordmark";
import DashboardThemeToggle from "@/app/components/DashboardThemeToggle";
import { useDashboardTheme } from "@/lib/hooks/useDashboardTheme";
import {
  LogOut,
  BookOpen,
  MessageSquareText,
  Brain,
  Layers,
  BarChart3,
  Settings,
  ChevronRight,
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

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const { isDark, toggleTheme } = useDashboardTheme();

  const fetcher = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/");
      throw new Error("No user");
    }

    const [profileRes, coursesRes] = await Promise.all([
      supabase.from("profiles").select("full_name, university").eq("id", user.id).single(),
      supabase.from("courses").select("id").eq("user_id", user.id)
    ]);

    return {
      profile: profileRes.data,
      courses: coursesRes.data || []
    };
  };

  const { data, error } = useSWR('dashboard-data', fetcher);
  
  const loading = !data && !error;
  const profile = data?.profile;
  const courses = data?.courses || [];

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
  const cards = [
    {
      key: "courses",
      title: "My Courses",
      subtitle: `${courses.length} course${courses.length === 1 ? "" : "s"}`,
      description: "View and manage your current courses.",
      icon: BookOpen,
      onClick: () => router.push("/dashboard/courses"),
      style: "bg-emerald-50 border-emerald-200 text-emerald-700",
      darkStyle: "bg-emerald-950/50 border-emerald-800 text-emerald-300",
    },
    {
      key: "study-buddy",
      title: "Study Pal",
      subtitle: "Assistant",
      description: "Chat with your AI Study Pal.",
      icon: MessageSquareText,
      onClick: () => router.push("/dashboard/study-pal"),
      style: "bg-blue-50 border-blue-200 text-blue-700",
      darkStyle: "bg-blue-950/50 border-blue-800 text-blue-300",
      titleClassName: "study-pal-wordmark",
    },
    {
      key: "quiz",
      title: "Quiz",
      subtitle: "Practice",
      description: "Test yourself with course quizzes.",
      icon: Brain,
      onClick: () => {},
      style: "bg-amber-50 border-amber-200 text-amber-700",
      darkStyle: "bg-amber-950/40 border-amber-800 text-amber-300",
    },
    {
      key: "flashcards",
      title: "Flashcards",
      subtitle: "Revision",
      description: "Review fast with quick flashcards.",
      icon: Layers,
      onClick: () => {},
      style: "bg-purple-50 border-purple-200 text-purple-700",
      darkStyle: "bg-violet-950/50 border-violet-800 text-violet-300",
    },
    {
      key: "progress",
      title: "Progress",
      subtitle: "Tracking",
      description: "Monitor learning streaks and growth.",
      icon: BarChart3,
      onClick: () => {},
      style: "bg-rose-50 border-rose-200 text-rose-700",
      darkStyle: "bg-rose-950/50 border-rose-800 text-rose-300",
    },
    {
      key: "settings",
      title: "Settings",
      subtitle: "Profile",
      description: "Manage account and preferences.",
      icon: Settings,
      onClick: () => {},
      style: "bg-cyan-50 border-cyan-200 text-cyan-700",
      darkStyle: "bg-cyan-950/50 border-cyan-800 text-cyan-300",
    },
  ];

  return (
    <div className={`min-h-screen px-3 sm:px-6 pt-2 sm:pt-4 pb-6 sm:pb-10 ${isDark ? "bg-slate-900" : "bg-white"} ${isDark ? "dashboard-theme-dark" : "dashboard-theme-light"} dashboard-theme-shell`}>
      <div className="w-full px-1 sm:px-5 mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-8 sm:mb-12">
          <div className="flex items-center gap-2 min-w-0">
            <Image 
              src={isDark ? "/Logo%20Dark%20Mode.png" : "/Logo1.png"} 
              alt="LEARNIVERSE Logo" 
              width={40} 
              height={40} 
              className="h-8 w-8 sm:h-10 sm:w-10 object-contain shrink-0" 
              priority 
            />
            <BrandWordmark className="text-sm sm:text-xl text-gray-900 truncate" />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <DashboardThemeToggle isDark={isDark} onToggle={toggleTheme} className="scale-90 sm:scale-100 origin-right" />
            <button
              onClick={handleSignOut}
              className={`inline-flex items-center justify-center rounded-full p-2 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors ${outfit.className}`}
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>

        {/* Welcome */}
        <div className={`mb-8 sm:mb-12 ${outfit.className}`}>
          <h1 className={`text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2 ${titillium.className}`}>
            {getGreeting()}, {firstName}.
          </h1>
          <p className="text-gray-500 text-base sm:text-lg">Choose a workspace to continue your study flow.</p>
          <div className="mt-4">
            <Link
              href="/dashboard/agent-test"
              className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Run System Test
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
          {cards.map((card) => {
            const Icon = card.icon;
            const isSoon = !["courses", "study-buddy"].includes(card.key);

            return (
              <button
                key={card.key}
                onClick={card.onClick}
                className={`group relative ${isDark ? card.darkStyle : card.style} border rounded-xl sm:rounded-3xl p-3 sm:p-6 text-left hover:shadow-lg hover:-translate-y-1 transition-all duration-300 min-h-[10.5rem] sm:min-h-52 cursor-pointer`}
              >
                <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl border flex items-center justify-center mb-3 sm:mb-4 ${isDark ? "bg-slate-900/80 border-slate-700" : "bg-white/80 border-white/90"}`}>
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide mb-1">{card.subtitle}</p>
                <h3 className={`text-base sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-2 leading-tight ${titillium.className} ${card.titleClassName ?? ""}`}>{card.title}</h3>
                <p className="hidden sm:block text-sm text-gray-600 mb-5">{card.description}</p>
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-semibold text-gray-800">{isSoon ? "Coming soon" : "Open"}</span>
                  <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}


