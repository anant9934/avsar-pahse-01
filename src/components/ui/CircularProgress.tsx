import React from "react";

interface CircularProgressProps {
  value: number; // 0 - 100
  size?: number; // diameter in px
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  color?: string;
  trackColor?: string;
  className?: string;
}

export function CircularProgress({
  value,
  size = 56,
  strokeWidth = 5,
  label,
  sublabel,
  color = "#285C45",
  trackColor = "#E4EBE2",
  className = "",
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span
          className="font-bold text-[#242720] leading-none"
          style={{ fontSize: size * 0.28 }}
        >
          {label ?? `${value}%`}
        </span>
        {sublabel && (
          <span
            className="text-[#77786F] font-medium leading-none mt-1"
            style={{ fontSize: size * 0.14 }}
          >
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}
