"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

interface MobileHeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  className?: string;
}

export function MobileHeader({
  title,
  showBack = true,
  onBack,
  rightAction,
  className = "",
}: MobileHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <header
      className={`sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-[#F8F6F1]/90 backdrop-blur-md border-b border-[#ECEAE3]/60 select-none ${className}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {showBack && (
          <button
            type="button"
            onClick={handleBack}
            className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-[#242720] hover:bg-[#EFECE5] transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.2px]" />
          </button>
        )}
        {title && (
          <h1 className="text-base sm:text-lg font-bold text-[#242720] truncate tracking-tight">
            {title}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {rightAction}
      </div>
    </header>
  );
}
