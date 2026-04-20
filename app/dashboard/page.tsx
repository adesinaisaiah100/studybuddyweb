"use client";

import React from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Titillium_Web, Outfit } from "next/font/google";
import Image from "next/image";
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
      <div className="min-h-screen bg-white flex items-center justify-center">
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
    },
    {
      key: "study-buddy",
      title: "Study Buddy",
      subtitle: "Assistant",
      description: "Chat with your AI study companion.",
      icon: MessageSquareText,
      onClick: () => {},
      style: "bg-blue-50 border-blue-200 text-blue-700",
    },
    {
      key: "quiz",
      title: "Quiz",
      subtitle: "Practice",
      description: "Test yourself with course quizzes.",
      icon: Brain,
      onClick: () => {},
      style: "bg-amber-50 border-amber-200 text-amber-700",
    },
    {
      key: "flashcards",
      title: "Flashcards",
      subtitle: "Revision",
      description: "Review fast with quick flashcards.",
      icon: Layers,
      onClick: () => {},
      style: "bg-purple-50 border-purple-200 text-purple-700",
    },
    {
      key: "progress",
      title: "Progress",
      subtitle: "Tracking",
      description: "Monitor learning streaks and growth.",
      icon: BarChart3,
      onClick: () => {},
      style: "bg-rose-50 border-rose-200 text-rose-700",
    },
    {
      key: "settings",
      title: "Settings",
      subtitle: "Profile",
      description: "Manage account and preferences.",
      icon: Settings,
      onClick: () => {},
      style: "bg-cyan-50 border-cyan-200 text-cyan-700",
    },
  ];

  return (
    <div className="min-h-screen bg-white px-4 sm:px-6 pt-2 sm:pt-4 pb-6 sm:pb-10">
      <div className="w-full px-5 mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-10 sm:mb-12">
          <div className="flex items-center gap-3">
            <Image 
              src="/Logo1.png" 
              alt="Study Zone Logo" 
              width={40} 
              height={40} 
              className="object-contain" 
              priority 
            />
            <span className={`text-xl font-bold text-gray-900 ${titillium.className}`}>
              Study Zone
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
            {getGreeting()}, {firstName}.
          </h1>
          <p className="text-gray-500 text-base sm:text-lg">Choose a workspace to continue your study flow.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {cards.map((card) => {
            const Icon = card.icon;
            const isSoon = card.key !== "courses";

            return (
              <button
                key={card.key}
                onClick={card.onClick}
                className={`group relative ${card.style} border rounded-2xl sm:rounded-3xl p-5 sm:p-6 text-left hover:shadow-lg hover:-translate-y-1 transition-all duration-300 min-h-52 cursor-pointer`}
              >
                <div className="w-11 h-11 rounded-xl bg-white/80 border border-white/90 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-1">{card.subtitle}</p>
                <h3 className={`text-2xl font-bold text-gray-900 mb-2 ${titillium.className}`}>{card.title}</h3>
                <p className="text-sm text-gray-600 mb-5">{card.description}</p>
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800">{isSoon ? "Coming soon" : "Open"}</span>
                  <ChevronRight className="w-4 h-4 text-gray-600 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
