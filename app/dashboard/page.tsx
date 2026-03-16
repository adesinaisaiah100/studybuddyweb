"use client";

import React from "react";
import { createClient } from "@/lib/supabase/client";
import { Titillium_Web, Outfit } from "next/font/google";
import { GraduationCap, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-green-50/30 px-4 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-green-600" />
            </div>
            <h1 className={`text-2xl font-bold text-gray-900 ${titillium.className}`}>
              Dashboard
            </h1>
          </div>
          <button
            onClick={handleSignOut}
            className={`flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors ${outfit.className}`}
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>

        {/* Placeholder content */}
        <div className={`text-center py-20 ${outfit.className}`}>
          <div className="w-20 h-20 rounded-3xl bg-green-50 border border-green-100 flex items-center justify-center mx-auto mb-6">
            <GraduationCap className="w-10 h-10 text-green-500" />
          </div>
          <h2 className={`text-3xl font-bold text-gray-900 mb-3 ${titillium.className}`}>
            Welcome to StudyBuddy! 🎉
          </h2>
          <p className="text-gray-500 text-lg max-w-md mx-auto">
            Your timetable has been uploaded. Course cards and full dashboard functionality coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}
