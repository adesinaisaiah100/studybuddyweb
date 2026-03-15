"use client";

import React from "react";
import { motion, Variants } from "framer-motion";
import { Titillium_Web, Outfit } from "next/font/google";
import { Layers, Target, RefreshCw, MessageCircleQuestion } from "lucide-react";

const titillium = Titillium_Web({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const benefits = [
  {
    title: "Everything in One Place",
    description: "No more switching between apps.",
    icon: <Layers className="w-6 h-6 text-green-400" />,
  },
  {
    title: "Clear Progress Tracking",
    description: "Know exactly where you stand in each course.",
    icon: <Target className="w-6 h-6 text-green-400" />,
  },
  {
    title: "Better Understanding",
    description: "Get help when concepts don't make sense.",
    icon: <MessageCircleQuestion className="w-6 h-6 text-green-400" />,
  },
  {
    title: "Smarter Revision",
    description: "Revisit important concepts at the right time.",
    icon: <RefreshCw className="w-6 h-6 text-green-400" />,
  },
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

export default function KeyBenefitsSection() {
  return (
    <section className="w-full bg-[#0B1510] text-white py-24 md:py-32 relative overflow-hidden">
      
      {/* Decorative Neon Accents */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      
      {/* Top Border Glow */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-green-500/50 to-transparent"></div>
      
      <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10 text-center">
        
        <div className="mb-16 md:mb-20">
          <span className={`inline-block py-1.5 px-4 rounded-full bg-green-500/10 text-green-400 font-medium text-sm mb-6 border border-green-500/20 ${outfit.className}`}>
            Why StudyBuddy
          </span>
          <h2 className={`text-4xl md:text-5xl font-bold text-white leading-tight ${titillium.className}`}>
            Designed for <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300">better grades.</span>
          </h2>
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 ${outfit.className}`}
        >
          {benefits.map((benefit, index) => (
            <motion.div 
              key={index} 
              variants={itemVariants}
              className="group relative p-8 rounded-3xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] hover:border-green-500/30 transition-all duration-300 flex flex-col items-center text-center"
            >
              {/* Icon Container */}
              <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/[0.1] flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-green-500/10 group-hover:border-green-500/20 transition-all duration-300 relative">
                 {/* Inner glow on hover */}
                 <div className="absolute inset-0 bg-green-400/20 rounded-2xl blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                 {benefit.icon}
              </div>
              
              <h3 className="text-xl font-semibold text-white mb-3">{benefit.title}</h3>
              <p className="text-gray-400 leading-relaxed text-sm md:text-base">
                {benefit.description}
              </p>
            </motion.div>
          ))}
        </motion.div>

      </div>
      
      {/* Bottom Border Glow */}
      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-green-500/20 to-transparent"></div>
    </section>
  );
}
