import React from "react";
import Link from "next/link";

interface AvsarLogoProps {
  showTagline?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  href?: string;
}

export function AvsarLogo({
  showTagline = true,
  size = "md",
  className = "",
  href = "/",
}: AvsarLogoProps) {
  const iconSizes = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  };

  const titleSizes = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-3xl",
  };

  const content = (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Avsar Stylized Green Peak/Leaf Symbol */}
      <div
        className={`${iconSizes[size]} relative flex items-center justify-center shrink-0`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-sm"
        >
          {/* Left curved leaf / peak */}
          <path
            d="M18 3C11.5 8.5 7 17 8 26C11 26 15 24 18 20V3Z"
            fill="#285C45"
          />
          {/* Right curved peak with subtle tonal contrast */}
          <path
            d="M18 3C24.5 8.5 29 17 28 26C25 26 21 24 18 20V3Z"
            fill="#327357"
          />
          {/* Stem / center accent */}
          <path
            d="M18 20V33"
            stroke="#1E4735"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="flex flex-col">
        <span
          className={`${titleSizes[size]} font-bold tracking-tight text-[#242720] leading-none flex items-center gap-0.5`}
        >
          Avsar
          <span className="text-xs text-[#285C45] ml-0.5 font-normal">®</span>
        </span>
        {showTagline && (
          <span className="text-[10px] sm:text-[11px] font-medium text-[#77786F] tracking-tight leading-tight mt-0.5">
            Right Opportunities
            <br className="sm:hidden" /> For Every Journey
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-block hover:opacity-90 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}
