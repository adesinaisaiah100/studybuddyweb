"use client";

import React from "react";
import { useGoogleSignIn } from "@/lib/hooks/useGoogleSignIn";

export default function AuthButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { signInWithGoogle } = useGoogleSignIn();

  return (
    <button onClick={signInWithGoogle} className={className}>
      {children}
    </button>
  );
}
