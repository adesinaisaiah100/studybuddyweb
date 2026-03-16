"use client";

import React, { useRef } from "react";
import Image from "next/image";
import { useScroll, useTransform, motion, MotionValue } from "framer-motion";
import { Titillium_Web, Outfit } from "next/font/google";

const titillium = Titillium_Web({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const steps = [
  {
    id: 1,
    title: "Create your courses",
    description: "Start by organizing your semester. Add all your current classes so StudyBuddy knows what you're focusing on.",
    image: "/organizing.jpg", 
  },
  {
    id: 2,
    title: "Upload notes and study materials",
    description: "Feed StudyBuddy your syllabus, slides, and class notes to build your personal knowledge base.",
    image: "/uploadcourse.jpg", 
  },
  {
    id: 3,
    title: "Study topics and ask questions",
    description: "Interact with your materials. Get context-aware answers that actually relate to your syllabus.",
    image: "/readandask.jpg", 
  },
  {
    id: 4,
    title: "Track your progress across the semester",
    description: "Watch your understanding grow. Identify exactly which concepts need more review before the big exam.",
    image: "/progress.png", // Keeping progress tracking photo for the 4th step
  },
];

export default function HowItWorksSection() {
  const containerRef = useRef<HTMLDivElement>(null);

  // We track the scroll progress of the entire section
  const { scrollYProgress } = useScroll({
    target: containerRef,
    // Start tracking when the top of the container hits the top of the viewport
    // End tracking when the bottom of the container hits the bottom of the viewport
    offset: ["start start", "end end"],
  });

  // Calculate which step should be active based on scroll percentage.
  // 0.0 - 0.33 = Step 1
  // 0.33 - 0.66 = Step 2
  // 0.66 - 1.0 = Step 3 transitioning to Step 4.
  // >= 1.0 = Step 4 is fully visible, and the sticky container releases so normal scrolling continues.
  
  // Move images up/down to show the active one smoothly across perfectly divided thirds of the scroll
  const yImageTransform = useTransform(
    scrollYProgress,
    [0, 0.3, 0.33, 0.63, 0.66, 0.97, 1],
    ["0%", "0%", "-25%", "-25%", "-50%", "-50%", "-75%"]
  );

  return (
    <>
      <section 
        id="how-it-works"
        ref={containerRef} 
        // The height determines how long the user has to scroll. 
        // 300vh means it takes 3 viewport heights to transition between the 4 steps completely.
        className="relative h-[200vh] md:h-[300vh] w-full bg-white"
      >
        
        {/* Sticky Container - This physically stays on screen while the user scrolls through the 400vh */}
        <div className="sticky top-0 h-screen w-full flex items-center justify-center overflow-hidden px-4 md:px-8 py-12 sm:py-20">
        
        <div className="max-w-7xl w-full mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16 h-full max-h-[700px] items-center">
          
          {/* Left Side: Text Content */}
          <div className="flex flex-col justify-center h-full relative z-10 w-full pt-6 md:pt-0">
            
            <div className="mb-8">
              <span className="inline-block py-1 px-3 rounded-full bg-gray-100 text-gray-800 font-medium text-sm mb-3 border border-gray-200">
                How It Works
              </span>
              <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight ${titillium.className}`}>
                From syllabus to <span className="text-green-500">success</span>.
              </h2>
            </div>

            <div className={`relative w-full h-[320px] sm:h-[350px] md:h-[300px] flex items-center ${outfit.className}`}>

              {/* Vertical Progress Line */}
              <div className="absolute left-6 md:left-8 top-10 bottom-10 w-1 bg-gray-100 rounded-full hidden md:block">
                <motion.div 
                  className="w-full bg-green-500 rounded-full origin-top"
                  style={{ scaleY: scrollYProgress }}
                />
              </div>

              <div className="relative w-full h-[320px] sm:h-[350px] md:h-[300px] flex items-center">
                {steps.map((step, index) => (
                  <StepItem 
                    key={step.id}
                    step={step}
                    index={index}
                    totalSteps={steps.length}
                    scrollYProgress={scrollYProgress}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Side: Sticky Visual Container */}
          <div className="hidden md:flex h-full w-full justify-center items-center relative overflow-hidden rounded-[2rem] bg-gray-50/50">
            {/* Direct Masking container for the sliding images without the extra glass frame */}
            <div className="w-full h-full relative">
              <motion.div 
                className="absolute top-0 left-0 w-full h-[400%] flex flex-col"
                style={{ y: yImageTransform }}
              >
                {steps.map((step) => (
                  <div key={`img-${step.id}`} className="w-full h-full relative flex items-center justify-center p-6 bg-green-50/30">
                      <div className="w-full h-full relative rounded-3xl overflow-hidden shadow-lg border border-gray-100/50 bg-white">
                        <Image 
                          src={step.image} 
                          alt={step.title} 
                          fill 
                          className="object-cover object-top"
                        />
                      </div>
                  </div>
                ))}
              </motion.div>
            </div>
          </div>
        </div>
      </div>
      </section>

      {/* Final Static Message - Completely independent of the scroll section */}
      <section className="w-full bg-white relative z-20">
        <div className={`w-full max-w-7xl mx-auto px-4 md:px-8 pb-32 pt-16 flex justify-center ${outfit.className}`}>
          <div className="p-6 md:p-8 text-center max-w-2xl w-full mx-auto">
            <p className="text-lg sm:text-xl md:text-2xl font-medium text-gray-800 leading-relaxed">
              Over time, <span className="text-green-600 font-bold">StudyBuddy</span> learns how you study and helps you improve.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

// Extracted component to safely use hooks inside the map loop
function StepItem({ step, index, totalSteps, scrollYProgress }: { 
  step: { id: number; title: string; description: string; image: string; }; 
  index: number; 
  totalSteps: number; 
  scrollYProgress: MotionValue<number>;
}) {
  const start = index * 0.333;
  const end = start + 0.333;
  const isLast = index === totalSteps - 1;
  
  const opacity = useTransform(
    scrollYProgress,
    [start - 0.02, start, end - 0.03, end],
    [0, 1, 1, isLast ? 1 : 0]
  );

  const y = useTransform(
    scrollYProgress,
    [start - 0.02, start, end - 0.03, end],
    [15, 0, 0, isLast ? 0 : -15]
  );

  return (
    <motion.div 
      style={{ opacity, y }}
      className="flex gap-4 md:gap-6 items-start absolute top-50 -translate-y-1/2 left-0 w-full md:pl-20 pointer-events-none"
    >
      <div className="flex-shrink-0 w-10 h-10 md:w-14 md:h-14 rounded-full bg-green-50 border-2 border-green-100 shadow-sm md:flex items-center justify-center text-lg md:text-xl font-bold text-green-600 hidden">
        {step.id}
      </div>
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 text-green-700 md:hidden flex items-center justify-center font-bold text-base mt-1">
        {step.id}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-xl md:text-3xl font-bold text-gray-900 mb-2 md:mb-4">{step.title}</h3>
        <p className="text-base md:text-lg text-gray-500 leading-relaxed max-w-md">{step.description}</p>
        {/* Inline image for mobile only */}
        <div className="mt-3 md:hidden w-full h-80 sm:h-40 relative rounded-2xl overflow-hidden border border-gray-100 bg-gray-50">
          <Image 
            src={step.image} 
            alt={step.title} 
            fill 
            className="object-cover object-top"
          />
        </div>
      </div>
    </motion.div>
  );
}
