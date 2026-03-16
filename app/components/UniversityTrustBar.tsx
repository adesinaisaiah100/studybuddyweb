import Image from "next/image";
import React from "react";

const universities = [
  {
    name: "University of Ibadan",
    logo: "/universities/ui-logo.png",
    nameClass: "font-serif tracking-wide",
  },
  {
    name: "University of Lagos",
    logo: "/universities/unilag-logo.png",
    nameClass: "font-semibold tracking-wider uppercase text-[12px]",
  },
  {
    name: "Covenant University",
    logo: "/universities/covenant-logo.png",
    nameClass: "font-semibold tracking-wide",
  },
  {
    name: "Kwara State University",
    logo: "/universities/kwasu.jpg",
    nameClass: "font-medium tracking-wide",
  },
];

function UniversityTrustBar() {
  return (
    <section className="w-full bg-white mt-6 sm:mt-10">
      <div className="mx-auto flex w-full flex-col md:flex-row items-center gap-4 md:gap-6 px-4 sm:px-6 py-4 sm:py-6">
        <span className="text-center md:text-left whitespace-nowrap text-sm sm:text-base md:text-lg font-semibold text-gray-700/80 md:mr-10 lg:mr-20">
          1000+ Nigerian universities trust us
        </span>
        <div className="flex flex-wrap items-center justify-center md:justify-between gap-4 sm:gap-6 flex-1">
          {universities.map((uni) => (
            <div key={uni.name} className="flex items-center gap-2 sm:gap-3 text-gray-600">
              <div className="relative h-7 w-7 sm:h-9 sm:w-9">
                <Image
                  src={uni.logo}
                  alt={uni.name}
                  width={36}
                  height={36}
                  className="h-7 w-7 sm:h-9 sm:w-9 object-contain sm:blur-[1px]"
                />
                <div className="absolute inset-0 bg-white/40 hidden sm:block" aria-hidden="true" />
              </div>
              <span className={`hidden sm:inline text-sm md:text-md text-gray-700/60 ${uni.nameClass}`}>{uni.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default UniversityTrustBar;
