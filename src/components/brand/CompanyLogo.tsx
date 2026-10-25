import React from "react";

interface CompanyLogoProps {
  name: string;
  logoKey?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function CompanyLogo({
  name,
  logoKey,
  size = "md",
  className = "",
}: CompanyLogoProps) {
  const key = (logoKey || name || "").toLowerCase().replace(/[^a-z]/g, "");

  const sizeClasses = {
    sm: "w-8 h-8 min-w-[2rem] text-xs rounded-xl",
    md: "w-11 h-11 min-w-[2.75rem] text-sm rounded-2xl",
    lg: "w-14 h-14 min-w-[3.5rem] text-base rounded-2xl",
    xl: "w-16 h-16 min-w-[4rem] text-lg rounded-3xl",
  };

  if (key.includes("google")) {
    return (
      <div
        className={`${sizeClasses[size]} bg-white border border-[#E8E6DF] flex items-center justify-center p-2 shadow-sm ${className}`}
        aria-label="Google"
      >
        <svg viewBox="0 0 24 24" className="w-full h-full">
          <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.4 7.33 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.15 0 9.92 0 12s.45 3.85 1.24 5.42l4.04-3.15z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.6 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
          />
        </svg>
      </div>
    );
  }

  if (key.includes("tata")) {
    return (
      <div
        className={`${sizeClasses[size]} bg-[#0C6FF9] text-white flex items-center justify-center font-bold tracking-tight shadow-sm ${className}`}
        aria-label="Tata Digital"
      >
        <span className="text-white drop-shadow-sm font-black">T</span>
      </div>
    );
  }

  if (key.includes("flipkart")) {
    return (
      <div
        className={`${sizeClasses[size]} bg-[#2874F0] text-white flex items-center justify-center shadow-sm relative overflow-hidden ${className}`}
        aria-label="Flipkart"
      >
        <div className="absolute top-0 right-0 w-3 h-3 bg-[#FFE11B] rounded-bl-full" />
        <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
          <path
            d="M5 7H19L17.5 19H6.5L5 7Z"
            fill="#FFE11B"
          />
          <path
            d="M9 7V5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5V7"
            stroke="#FFE11B"
            strokeWidth="2"
          />
        </svg>
      </div>
    );
  }

  if (key.includes("zoho")) {
    return (
      <div
        className={`${sizeClasses[size]} bg-[#E1251B] text-white flex items-center justify-center font-bold shadow-sm ${className}`}
        aria-label="Zoho"
      >
        <span className="text-white font-black tracking-wider">Z</span>
      </div>
    );
  }

  if (key.includes("swiggy")) {
    return (
      <div
        className={`${sizeClasses[size]} bg-[#FC8019] text-white flex items-center justify-center shadow-sm ${className}`}
        aria-label="Swiggy"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
        </svg>
      </div>
    );
  }

  // Fallback initials logo
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className={`${sizeClasses[size]} bg-[#EAF2E8] border border-[#DCE8D9] text-[#285C45] flex items-center justify-center font-bold shadow-sm ${className}`}
      aria-label={name}
    >
      {initials || "Co"}
    </div>
  );
}
