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
    <section className="w-full bg-white mt-10">
      <div className="mx-auto flex w-full  items-center gap-6 px-6 py-6">
        <span className="whitespace-nowrap text-lg font-semibold text-gray-700/80 mr-20">
          1000+ Nigerian universities trust us
        </span>
        <div className="flex flex-1 flex-wrap items-center justify-between gap-6">
          {universities.map((uni) => (
            <div key={uni.name} className="flex items-center gap-3 text-gray-600">
              <div className="relative h-9 w-9">
                <Image
                  src={uni.logo}
                  alt={uni.name}
                  width={36}
                  height={36}
                  className="h-9 w-9 object-contain blur-[1px]"
                />
                <div className="absolute inset-0 bg-white/40" aria-hidden="true" />
              </div>
              <span className={`text-md text-gray-700/60 ${uni.nameClass}`}>{uni.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default UniversityTrustBar;
