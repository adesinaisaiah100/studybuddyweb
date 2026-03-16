import React from 'react';
import { X } from 'lucide-react';
import { Titillium_Web, Outfit } from 'next/font/google';
import Image from 'next/image';

const titillium = Titillium_Web({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
});

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

function ConceptSection() {
  return (
    <section className="w-full py-16 sm:py-24 px-4 bg-white overflow-hidden">
      <div className=" mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          
          {/* Text Content */}
          <div className="flex-1 space-y-10 w-full">
            <h2 className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-black leading-tight ${titillium.className}`}>
              Most students don&apos;t fail because they are <span className="text-green-500">lazy</span>.
            </h2>

            <div className={`space-y-6 relative ${outfit.className}`}>
              {/* Subtle background blob to make the glassmorphism visible */}
              <div className="absolute top-10 left-0 w-64 h-64 bg-green-200/30 rounded-full blur-3xl -z-10"></div>
              <div className="absolute bottom-0 right-10 w-48 h-48 bg-gray-200/50 rounded-full blur-3xl -z-10"></div>
              
              <p className="text-xl sm:text-2xl font-semibold text-black">
                They fail because:
              </p>
              
              <ul className="space-y-4">
                <li className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl border border-white/60 bg-white/40 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:bg-white/60">
                  <div className="w-8 h-8 rounded-full bg-white/80 shadow-sm flex items-center justify-center flex-shrink-0">
                    <X className="w-4 h-4 text-red-500/80" />
                  </div>
                  <span className="text-base sm:text-lg text-black/80 font-medium tracking-wide">They fall behind early</span>
                </li>
                <li className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl border border-white/60 bg-white/40 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:bg-white/60">
                  <div className="w-8 h-8 rounded-full bg-white/80 shadow-sm flex items-center justify-center flex-shrink-0">
                    <X className="w-4 h-4 text-red-500/80" />
                  </div>
                  <span className="text-base sm:text-lg text-black/80 font-medium tracking-wide">They don&apos;t revise consistently</span>
                </li>
                <li className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl border border-white/60 bg-white/40 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:bg-white/60">
                  <div className="w-8 h-8 rounded-full bg-white/80 shadow-sm flex items-center justify-center flex-shrink-0">
                    <X className="w-4 h-4 text-red-500/80" />
                  </div>
                  <span className="text-base sm:text-lg text-black/80 font-medium tracking-wide">They don&apos;t realize they are struggling until exams</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Image Placeholder */}
          <div className="w-full lg:w-[450px] flex-shrink-0">
        
              
              <Image src="/fustrated.jpg" alt="Concept" width={500} height={500} className='aspect-square sm:aspect-[4/3] lg:aspect-square w-full rounded-3xl bg-black/5' />            
          </div>
          
        </div>

        {/* Bottom Centered Text */}
        <div className="mt-20 flex justify-center w-full">
            <p className="text-xl sm:text-2xl md:text-3xl font-medium text-black text-center leading-relaxed max-w-3xl">
            <span className="text-green-600 font-bold">Study Buddy</span> brings everything together into one intelligent system.
          </p>
        </div>
      </div>
    </section>
  );
}

export default ConceptSection;
