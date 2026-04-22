import React from "react";

type BrandWordmarkProps = {
  className?: string;
};

export default function BrandWordmark({
  className = "",
}: BrandWordmarkProps) {
  return (
    <span
      className={`learniverse-wordmark ${className}`.trim()}
      role="text"
      aria-label="LEARNIVERSE"
    >
      <span aria-hidden="true">LE</span>
      <span className="learniverse-wordmark-a" aria-hidden="true">A</span>
      <span aria-hidden="true">RNIVERSE</span>
    </span>
  );
}
