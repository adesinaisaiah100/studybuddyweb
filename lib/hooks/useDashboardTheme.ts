"use client";

import { useCallback, useEffect, useState } from "react";

const DASHBOARD_THEME_KEY = "learniverse-dashboard-theme";

export function useDashboardTheme() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const savedTheme = window.localStorage.getItem(DASHBOARD_THEME_KEY);
      return savedTheme === "dark";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(DASHBOARD_THEME_KEY, isDark ? "dark" : "light");
    } catch {
      // Ignore storage write failures.
    }
  }, [isDark]);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => !prev);
  }, []);

  return { isDark, toggleTheme, setIsDark };
}
