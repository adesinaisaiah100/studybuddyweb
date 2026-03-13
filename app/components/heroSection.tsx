import React from "react";
import Navbar from "./Navbar";
import Image from "next/image";
import { ArrowRight } from 'lucide-react';
import ReviewsBadge from "./ReviewsBadge";

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
      <div className="relative z-10 flex min-h-screen flex-col px-6 py-1">
        <Navbar />
        <div className="relative flex-1">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <Image src="/heroimg3.png" alt="Hero" width={700} height={800} />
          </div>

          <div className="relative z-20 mx-auto flex w-full  flex-col gap-10 pt-12 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex-1 text-left lg:pr-8 max-w-2xl">
              <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-8">
              The Digital Infrastructure for <span className='flex w-fit px-3 mt-2 items-start py-2 bg-green-400 text-white -skew-x-12 rounded-2xl'> Modern Learning.</span>
              </h1>
              <p className="text-lg md:text-xl text-gray-700/50 mb-8 max-w-lg">
              StudyBuddy organizes your notes, tracks your progress across
              courses, and gives you AI-powered help when you need it — all in
              one study system.
              </p>

              <button className='py-4 px-3 rounded-2xl border border-gray-400 flex text-lg  backdrop-blur text-white gap-3 bg-green-400'>Start Studying Smarter <span><ArrowRight /></span></button>

              <div className="mt-8 ">
                <ReviewsBadge />
              </div>
            </div>
            <div className="flex-1 flex flex-col max-w-[300px] gap-3">
              <div className="mb-6 rounded-2xl border  p-5  backdrop-blur">
                <h2 className="text-5xl font-semibold text-gray-900/80 mb-2">
                  70% 
                </h2>
                <span className="text-gray-900/50 text-xl">better retention</span>
                <p className="text-sm text-gray-600/60">
                Smart recall notifications help you remember what you studied
                yesterday.
                </p>
              </div>
              <div className="mb-6 rounded-2xl border  p-5  backdrop-blur">
                <h2 className="text-5xl font-semibold text-gray-900/80 mb-2 flex flex-col">
                  3×
                </h2>
                 <span className="text-gray-900/50 text-xl">Faster understanding</span>
                <p className="text-sm text-gray-600/60">
                  Ask questions about your course materials and get instant explanations.
                </p>
              </div>
            </div>
          </div>

          <div className="absolute left-1/2 top-[65%] translate-x-16">
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
