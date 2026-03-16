"use client";

import React from "react";
import { motion } from "framer-motion";
import { Titillium_Web, Outfit } from "next/font/google";
import { ArrowRight, Sparkles } from "lucide-react";

const titillium = Titillium_Web({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export default function CtaSection() {
  return (
    <section id="pricing" className="w-full bg-slate-50 py-16 sm:py-20 md:py-32 relative overflow-hidden flex items-center justify-center min-h-[400px] sm:min-h-[500px]">
      
      <div className="max-w-6xl mx-auto px-4 md:px-8 relative z-10 w-full">
        <motion.div 
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          // pure glassmorphism, no shadow required
          className="w-full rounded-[2rem] sm:rounded-[2.5rem] bg-white/40 backdrop-blur-3xl border border-white/60 p-8 sm:p-10 md:p-20 text-center relative overflow-hidden isolate shadow-sm"
        >
          {/* Subtle inner reflection for the glass */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/60 to-transparent pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col items-center max-w-3xl mx-auto">
            
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-green-100/50 text-green-700 text-sm font-medium mb-8 shadow-sm">
              <Sparkles className="w-4 h-4 text-green-500" />
              <span>Ready to transform your grades?</span>
            </div>

            <h2 className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-4 sm:mb-6 ${titillium.className}`}>
              Build a better <span className="text-green-500">study system.</span>
            </h2>
            
            <p className={`text-base sm:text-lg md:text-xl text-gray-600 mb-8 sm:mb-10 max-w-2xl font-medium leading-relaxed ${outfit.className}`}>
              Start using StudyBuddy today and stop stressing over disorganized notes and missed topics.
            </p>
            
            <div className={`flex flex-col sm:flex-row gap-4 justify-center items-center w-full sm:w-auto ${outfit.className}`}>
              <button className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-gray-900 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:pr-6 hover:bg-gray-800 transition-all duration-300 shadow-xl shadow-gray-900/10">
                <span>Join Early Access</span>
                <ArrowRight className="w-5 h-5 opacity-0 -ml-8 group-hover:opacity-100 group-hover:ml-0 text-green-400 transition-all duration-300" />
              </button>
            </div>

          </div>
        </motion.div>
      </div>
    </section>
  );
}
