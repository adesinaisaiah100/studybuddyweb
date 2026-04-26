"use client";

import React from "react";
import { Moon, Sun } from "lucide-react";

type DashboardThemeToggleProps = {
  isDark: boolean;
  onToggle: () => void;
  className?: string;
};

export default function DashboardThemeToggle({
  isDark,
  onToggle,
  className = "",
}: DashboardThemeToggleProps) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`.trim()}>
      <span className="hidden sm:inline text-xs sm:text-sm font-medium text-gray-600">
        {isDark ? "Dark mode" : "Light mode"}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        onClick={onToggle}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className={`relative inline-flex h-8 w-14 items-center rounded-full border p-1 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-400/50 ${
          isDark
            ? "border-slate-600 bg-slate-800"
            : "border-gray-300 bg-white"
        }`}
      >
        <span
          className={`pointer-events-none inline-flex h-6 w-6 items-center justify-center rounded-full shadow-sm transition-transform duration-200 ${
            isDark
              ? "translate-x-6 bg-slate-100 text-slate-800"
              : "translate-x-0 bg-amber-50 text-amber-600"
          }`}
        >
          {isDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
        </span>
      </button>
    </div>
  );
}
