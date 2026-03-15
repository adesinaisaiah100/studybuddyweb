"use client";

import React from "react";
import { motion } from "framer-motion";
import { Titillium_Web, Outfit } from "next/font/google";
import { CheckCheck } from "lucide-react";

const titillium = Titillium_Web({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const testimonials = [
  {
    id: 1,
    text: "StudyBuddy helped me organize all my course materials in one place.",
    author: "Mayowa A.",
    role: "Computer Science Major",
    isRightAligned: false,
    timestamp: "10:24 AM",
  },
  {
    id: 2,
    text: "I finally know what topics I'm behind on before exams.",
    author: "Maria K.",
    role: "Pre-Med Student",
    isRightAligned: true,
    timestamp: "11:42 AM",
  },
];

export default function SocialProofSection() {
  return (
    <section className="w-full bg-[#f8fafc] py-24 md:py-32 relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-green-100/40 rounded-full blur-[120px] pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
      
      <div className="max-w-4xl mx-auto px-4 md:px-8 relative z-10 flex flex-col items-center">
        
        <div className="mb-16 md:mb-20 text-center">
          <span className={`inline-block py-1.5 px-4 rounded-full bg-white text-green-700 font-medium text-sm mb-6 border border-green-200 shadow-sm ${outfit.className}`}>
            Join The Community
          </span>
          <h2 className={`text-4xl md:text-5xl font-bold text-gray-900 leading-tight ${titillium.className}`}>
            What students are <span className="text-green-500">saying.</span>
          </h2>
        </div>

        {/* Chat Thread Container */}
        <div className={`w-full max-w-2xl flex flex-col gap-8 md:gap-12 relative ${outfit.className}`}>
           
           {/* Faint vertical connecting line */}
           <div className="absolute left-6 md:left-8 top-10 bottom-10 w-px bg-gradient-to-b from-transparent via-gray-200 to-transparent z-0 hidden md:block"></div>

          {testimonials.map((t, index) => (
            <motion.div 
              key={t.id}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              className={`flex w-full gap-4 relative z-10 ${t.isRightAligned ? 'md:flex-row-reverse' : ''}`}
            >
              
              {/* Avatar */}
              <div className="flex-shrink-0 w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-white to-gray-50 flex items-center justify-center text-gray-700 font-bold text-lg border border-gray-200 shadow-sm relative mt-2">
                 {t.author.charAt(0)}
                 {/* Online Indicator */}
                 <div className="absolute bottom-0 right-0 w-3 h-3 md:w-4 md:h-4 bg-green-500 rounded-full border-2 border-white"></div>
              </div>

              {/* Chat Bubble Column */}
              <div className={`flex flex-col ${t.isRightAligned ? 'md:items-end' : ''} max-w-[85%]`}>
                 
                 {/* Name & Role Header */}
                 <div className={`flex items-baseline gap-2 mb-2 px-2 ${t.isRightAligned ? 'flex-row-reverse' : ''}`}>
                    <span className="font-semibold text-gray-900">{t.author}</span>
                    <span className="text-xs text-gray-400 font-medium">{t.role}</span>
                 </div>

                 {/* The Bubble */}
                 <div className={`
                    p-5 md:p-6 rounded-[2rem] shadow-sm relative group transition-all duration-300
                    ${t.isRightAligned 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-tr-sm hover:shadow-green-500/20 hover:-translate-y-1' 
                      : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm hover:shadow-xl hover:-translate-y-1'
                    }
                 `}>
                    <p className="text-lg md:text-xl font-medium leading-relaxed">
                      &quot;{t.text}&quot;
                    </p>
                 </div>

                 {/* Timestamp & Read Receipt */}
                 <div className={`flex items-center gap-1 mt-2 text-xs text-gray-400 font-medium px-2 ${t.isRightAligned ? 'flex-row-reverse' : ''}`}>
                    <span>{t.timestamp}</span>
                    {t.isRightAligned && <CheckCheck className="w-4 h-4 text-green-500 ml-1" />}
                 </div>

              </div>

            </motion.div>
          ))}

        </div>

      </div>
    </section>
  );
}
