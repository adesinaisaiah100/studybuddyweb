import React from "react";
import Navbar from "./Navbar";
import Image from "next/image";
import { ArrowRight } from 'lucide-react';
import ReviewsBadge from "./ReviewsBadge";
import AuthButton from "./AuthButton";

function HeroSection() {
  return (
    <section className="relative min-h-screen w-full overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/landingPageBG.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(2px)",
          transform: "scale(1.03)",
        }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-white/95" aria-hidden="true" />
      <div className="relative z-10 flex min-h-screen flex-col px-4 sm:px-6 py-1">
        <Navbar />
        <div className="relative flex-1">
          {/* Hero decorative image — hidden on mobile */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:block">
            <Image src="/heroimg3.png" alt="Hero" width={700} height={800} />
          </div>

          <div className="relative z-20 mx-auto flex w-full flex-col gap-6 sm:gap-10 pt-8 sm:pt-12 lg:flex-row lg:items-start lg:justify-between">
            {/* Main content */}
            <div className="flex-1 text-center lg:text-left lg:pr-8 max-w-2xl mx-auto lg:mx-0">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 sm:mb-8">
              The Digital Infrastructure for <span className='inline-flex w-fit px-3 mt-2 items-start py-2 bg-green-400 text-white -skew-x-12 rounded-2xl'>Modern Learning.</span>
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-gray-700/50 mb-6 sm:mb-8 max-w-lg mx-auto lg:mx-0">
              StudyBuddy organizes your notes, tracks your progress across
              courses, and gives you AI-powered help when you need it — all in
              one study system.
              </p>

              <div className="flex justify-center lg:justify-start">
                <AuthButton className='py-3 sm:py-4 px-4 sm:px-5 rounded-2xl border border-gray-400 flex text-base sm:text-lg backdrop-blur text-white gap-3 bg-green-400 items-center cursor-pointer hover:bg-green-500 transition-colors'>Start Studying Smarter <span><ArrowRight /></span></AuthButton>
              </div>

              <div className="mt-6 sm:mt-8 flex justify-center lg:justify-start">
                <ReviewsBadge />
              </div>
            </div>

            {/* Stat cards — horizontal row on mobile, vertical column on lg */}
            <div className="flex flex-row lg:flex-col gap-3 w-full lg:max-w-[300px] mx-auto lg:mx-0">
              <div className="flex-1 rounded-2xl border p-4 sm:p-5 backdrop-blur">
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-gray-900/80 mb-1 sm:mb-2">
                  70% 
                </h2>
                <span className="text-gray-900/50 text-base sm:text-lg lg:text-xl">better retention</span>
                <p className="text-xs sm:text-sm text-gray-600/60 mt-1">
                Smart recall notifications help you remember what you studied
                yesterday.
                </p>
              </div>
              <div className="flex-1 rounded-2xl border p-4 sm:p-5 backdrop-blur">
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-gray-900/80 mb-1 sm:mb-2 flex flex-col">
                  3×
                </h2>
                 <span className="text-gray-900/50 text-base sm:text-lg lg:text-xl">Faster understanding</span>
                <p className="text-xs sm:text-sm text-gray-600/60 mt-1">
                  Ask questions about your course materials and get instant explanations.
                </p>
              </div>
            </div>
          </div>

          {/* Chart image — hidden on small screens */}
          <div className="absolute left-1/2 top-[65%] translate-x-16 hidden lg:block">
            <Image
              src="/chart.png"
              alt="Progress"
              width={400}
              height={500}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
