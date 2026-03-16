"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Titillium_Web, Outfit } from "next/font/google";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, GraduationCap, User, Building2, Users } from "lucide-react";

const titillium = Titillium_Web({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [formData, setFormData] = useState({
    full_name: "",
    university: "",
    department: "",
    gender: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be logged in to complete onboarding.");
        setLoading(false);
        return;
      }

      const { error: insertError } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: formData.full_name,
        university: formData.university,
        department: formData.department,
        gender: formData.gender,
        onboarding_complete: false, // Will be set to true after timetable upload
      });

      if (insertError) {
        setError(insertError.message);
        setLoading(false);
        return;
      }

      router.push("/onboarding/upload");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const isFormValid =
    formData.full_name &&
    formData.university &&
    formData.department &&
    formData.gender;

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 sm:px-6 lg:px-12 py-8 sm:py-12 overflow-hidden relative">
      <div className="relative z-10 w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
        
        {/* Left: Video */}
        <div className="w-full flex items-center justify-center">
          <div className="w-full max-w-md lg:max-w-none rounded-3xl overflow-hidden shadow-lg border border-gray-100">
            <video
              src="/Conversation.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-auto object-cover"
            />
          </div>
        </div>

        {/* Right: Form */}
        <div className="w-full max-w-lg mx-auto lg:mx-0">
          {/* Header */}
          <div className="text-center lg:text-left mb-8 sm:mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 border border-green-100 text-green-700 text-sm font-medium mb-6">
              <GraduationCap className="w-4 h-4" />
              <span className={outfit.className}>Welcome to StudyBuddy</span>
            </div>
            <h1
              className={`text-3xl sm:text-4xl font-bold text-gray-900 mb-3 ${titillium.className}`}
            >
              Tell us about <span className="text-green-500">yourself.</span>
            </h1>
            <p className={`text-gray-500 text-base sm:text-lg ${outfit.className}`}>
              This helps us personalize your study experience.
            </p>
          </div>

          {/* Form Card */}
          <form
            onSubmit={handleSubmit}
            className={`bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5 ${outfit.className}`}
          >
            {/* Full Name */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 text-gray-400" />
                Full Name
              </label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                placeholder="e.g. Adebayo Michael"
                required
                className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 bg-gray-50/50 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 transition-all duration-200"
              />
            </div>

            {/* University */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Building2 className="w-4 h-4 text-gray-400" />
                University
              </label>
              <input
                type="text"
                name="university"
                value={formData.university}
                onChange={handleChange}
                placeholder="e.g. University of Lagos"
                required
                className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 bg-gray-50/50 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 transition-all duration-200"
              />
            </div>

            {/* Department */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <GraduationCap className="w-4 h-4 text-gray-400" />
                Department
              </label>
              <input
                type="text"
                name="department"
                value={formData.department}
                onChange={handleChange}
                placeholder="e.g. Computer Science"
                required
                className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 bg-gray-50/50 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 transition-all duration-200"
              />
            </div>

            {/* Gender */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Users className="w-4 h-4 text-gray-400" />
                Gender
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                required
                className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 bg-gray-50/50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 transition-all duration-200 appearance-none"
              >
                <option value="" disabled>
                  Select your gender
                </option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>

            {/* Error message */}
            {error && (
              <div className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={!isFormValid || loading}
              className="group w-full flex items-center justify-center gap-3 bg-gray-900 text-white px-6 py-4 rounded-2xl font-semibold text-base hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Saving...
                </span>
              ) : (
                <>
                  Continue to Upload Timetable
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
                </>
              )}
            </button>
          </form>

          {/* Step indicator */}
          <div className="flex items-center justify-center lg:justify-start gap-2 mt-8">
            <div className="w-8 h-1.5 rounded-full bg-green-500" />
            <div className="w-8 h-1.5 rounded-full bg-gray-200" />
            <div className="w-8 h-1.5 rounded-full bg-gray-200" />
          </div>
          <p className={`text-center lg:text-left text-sm text-gray-400 mt-3 ${outfit.className}`}>
            Step 1 of 3 — Your Info
          </p>
        </div>
      </div>
    </div>
  );
}
