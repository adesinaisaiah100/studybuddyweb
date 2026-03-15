"use client";

import React from "react";
import Link from "next/link";
import { Titillium_Web, Outfit } from "next/font/google";

const titillium = Titillium_Web({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-white border-t border-gray-100 py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        
        <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-8 mb-12">
          
          {/* Brand & Copyright */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <Link href="/" className="inline-block mb-4">
              <span className={`text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-600 to-emerald-500 tracking-tight ${titillium.className}`}>
                StudyBuddy
              </span>
            </Link>
            <p className={`text-gray-500 text-sm max-w-xs ${outfit.className}`}>
              The intelligent study platform designed to help students organize materials, track progress, and build better study habits.
            </p>
          </div>

          {/* Minimal Links */}
          <div className={`flex gap-8 text-sm font-medium text-gray-500 ${outfit.className}`}>
            <div className="flex flex-col gap-3">
              <Link href="#" className="hover:text-green-600 transition-colors">Privacy Policy</Link>
              <Link href="#" className="hover:text-green-600 transition-colors">Terms of Service</Link>
            </div>
            <div className="flex flex-col gap-3">
              <Link href="#" className="hover:text-green-600 transition-colors">Contact Support</Link>
              <Link href="#" className="hover:text-green-600 transition-colors">Twitter / X</Link>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-gray-50 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className={`text-sm text-gray-400 ${outfit.className}`}>
            © {currentYear} StudyBuddy. All rights reserved.
          </p>
          <div className="flex gap-4">
               {/* Decorative dots to balance the bottom right */}
               <div className="w-1.5 h-1.5 rounded-full bg-green-200"></div>
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-300"></div>
               <div className="w-1.5 h-1.5 rounded-full bg-teal-400"></div>
          </div>
        </div>

      </div>
    </footer>
  );
}
