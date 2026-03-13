import Image from "next/image";
import React from "react";

function ReviewsBadge() {
  return (
    <div className="flex w-[200px] ">
      <div>
      <span className="text-sm font-medium text-gray-500 block mb-2">
        From 40k+ Reviews
      </span>

      <div className="flex items-center">
        <div className="-space-x-2 flex">
          <Image
            src="/reviews/avatar-1.jpg"
            alt="Reviewer 1"
            width={32}
            height={32}
            className="h-8 w-8 rounded-full object-cover ring-2 ring-white"
          />
          <Image
            src="/reviews/avatar-2.jpg"
            alt="Reviewer 2"
            width={32}
            height={32}
            className="h-8 w-8 rounded-full object-cover ring-2 ring-white"
          />
          <Image
            src="/reviews/avatar-3.jpg"
            alt="Reviewer 3"
            width={32}
            height={32}
            className="h-8 w-8 rounded-full object-cover ring-2 ring-white"
          />
        </div>
        <div className="ml-3 flex items-center gap-1 text-sm font-semibold text-gray-700">
          <span>4.9</span>
          <span className="text-yellow-500">★</span>
        </div>
      </div>
    </div>
    </div>
  );
}

export default ReviewsBadge;
