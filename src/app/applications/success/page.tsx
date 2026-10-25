"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Copy, CheckCheck } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import type { Job } from "@/types";

function SuccessContent() {
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref") || "AVS-2025-0412-8937";
  const jobId = searchParams.get("job") || "job_google_fe_intern";

  const [job, setJob] = useState<Job | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadJob() {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (res.ok) {
          const data = await res.json();
          setJob(data.job);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadJob();
  }, [jobId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(refCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col justify-between px-6 pt-12 pb-8 text-center bg-[#F8F6F1]">
      <div className="my-auto flex flex-col items-center">
        {/* Festive Confetti Dots & Large Green Checkmark Circle */}
        <div className="relative mb-6">
          {/* Decorative celebratory colorful dots */}
          <div className="absolute -top-3 left-4 w-2 h-2 rounded-full bg-[#E5484D] animate-bounce" />
          <div className="absolute -top-4 right-6 w-2.5 h-2.5 rounded-full bg-[#3B82F6]" />
          <div className="absolute top-4 -left-4 w-2 h-2 rounded-full bg-[#EAB308]" />
          <div className="absolute top-10 -right-5 w-2 h-2 rounded-full bg-[#10B981]" />
          <div className="absolute -bottom-2 -left-2 w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" />
          <div className="absolute -bottom-3 right-5 w-2 h-2 rounded-full bg-[#F97316]" />

          {/* Center Checkmark Circle */}
          <div className="w-20 h-20 rounded-full bg-[#285C45] text-white flex items-center justify-center shadow-lg ring-8 ring-[#EAF4EB]">
            <Check className="w-10 h-10 stroke-[3px]" />
          </div>
        </div>

        {/* Title & Subtitle */}
        <h1 className="text-2xl font-extrabold text-[#242720] tracking-tight">
          Application Submitted!
        </h1>
        <p className="text-xs sm:text-sm text-[#77786F] mt-2 max-w-xs leading-relaxed">
          You&apos;ve successfully applied for{" "}
          <strong className="text-[#242720]">
            {job?.title || "Frontend Developer Intern"}
          </strong>{" "}
          at <strong className="text-[#242720]">{job?.company || "Google"}</strong>.
        </p>

        {/* Application Reference Code Card */}
        <div className="card-surface p-4 mt-6 w-full max-w-xs bg-white flex items-center justify-between gap-3 shadow-2xs">
          <div className="text-left">
            <span className="text-[10px] uppercase font-bold text-[#77786F] block tracking-wider">
              Application Reference
            </span>
            <span className="text-sm font-mono font-bold text-[#242720] tracking-tight">
              {refCode}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="p-2 rounded-xl hover:bg-[#F4F1EA] text-[#77786F] hover:text-[#242720] transition-colors"
            title="Copy reference code"
          >
            {copied ? (
              <CheckCheck className="w-4 h-4 text-[#285C45]" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 w-full max-w-xs mx-auto mt-6">
        <Link
          href="/applications"
          className="w-full bg-[#285C45] hover:bg-[#1E4735] text-white font-bold py-3.5 px-6 rounded-full text-xs sm:text-sm shadow-sm transition-all"
        >
          View Application
        </Link>

        <Link
          href="/explore"
          className="w-full bg-white hover:bg-[#FAF9F5] border border-[#DEDCD4] text-[#242720] font-bold py-3.5 px-6 rounded-full text-xs sm:text-sm shadow-2xs transition-all"
        >
          Explore More Jobs
        </Link>
      </div>
    </div>
  );
}

export default function ApplicationSuccessPage() {
  return (
    <MobileShell showBottomNav={false} activeScreenNumber={10}>
      <Suspense fallback={<div className="p-8 text-center text-xs">Loading confirmation...</div>}>
        <SuccessContent />
      </Suspense>
    </MobileShell>
  );
}
