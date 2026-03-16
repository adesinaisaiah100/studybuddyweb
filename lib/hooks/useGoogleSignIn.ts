"use client";

import { createClient } from "@/lib/supabase/client";

export function useGoogleSignIn() {
  const supabase = createClient();

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      console.error("Google sign-in error:", error.message);
    }
  };

  return { signInWithGoogle };
}
