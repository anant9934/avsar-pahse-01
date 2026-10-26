"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Bookmark, Sparkles } from "lucide-react";
import { CompanyLogo } from "@/components/brand/CompanyLogo";
import type { Job } from "@/types";

interface JobCardProps {
  job: Job;
  matchScore?: number;
  initialSaved?: boolean;
  onToggleSave?: (jobId: string, saved: boolean) => void;
  variant?: "compact" | "detailed";
}

export function JobCard({
  job,
  matchScore,
  initialSaved = false,
  onToggleSave,
}: JobCardProps) {
  const [isSaved, setIsSaved] = useState(initialSaved);
  const [isSaving, setIsSaving] = useState(false);

  const handleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSaving(true);
    const nextSaved = !isSaved;
    setIsSaved(nextSaved);

    try {
      await fetch("/api/jobs/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      onToggleSave?.(job.id, nextSaved);
    } catch (err) {
      console.error("Failed to toggle save", err);
      setIsSaved(!nextSaved);
    } finally {
      setIsSaving(false);
    }
  };

  const displayMatch = matchScore ?? (job as unknown as { matchScore?: number }).matchScore;

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="block card-surface-interactive p-4 relative group"
    >
      <div className="flex items-start justify-between gap-3">
        {/* Company logo and Job header */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <CompanyLogo
            name={job.company}
            logoKey={job.companyLogoKey}
            size="md"
            className="shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-[#242720] leading-snug truncate group-hover:text-[#285C45] transition-colors">
              {job.title}
            </h3>
            <p className="text-xs font-medium text-[#77786F] truncate mt-0.5">
              {job.company} · {job.location} · {job.workArrangement}
            </p>
          </div>
        </div>

        {/* Top right: Match Score Pill & Bookmark */}
        <div className="flex items-center gap-2 shrink-0">
          {displayMatch !== undefined && (
            <span className="badge-match" title="Calculated match fit">
              <Sparkles className="w-3 h-3 text-[#285C45]" />
              {displayMatch}% Match
            </span>
          )}
        </div>
      </div>

      {/* Middle row: Metadata tags */}
      <div className="flex flex-wrap items-center gap-1.5 mt-3 text-xs font-medium text-[#55564F]">
        <span className="bg-[#F4F2EC] px-2.5 py-1 rounded-md text-[#363830]">
          {job.employmentType}
        </span>
        {job.compensation && (
          <span className="bg-[#F4F2EC] px-2.5 py-1 rounded-md font-semibold text-[#285C45]">
            {job.compensation}
          </span>
        )}
        {job.isPossiblyClosed && (
          <span className="bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md text-[11px] font-bold">
            ⏳ Possibly Closed
          </span>
        )}
        {!job.isPossiblyClosed && job.verificationStatus === "VERIFIED" && (
          <span className="bg-[#EBF3ED] text-[#285C45] px-2 py-0.5 rounded-md text-[11px] font-semibold">
            ✓ Verified
          </span>
        )}
        {!job.isPossiblyClosed && job.verificationStatus === "PARTIALLY_VERIFIED" && (
          <span className="bg-amber-50 text-amber-700 border border-amber-200/60 px-2 py-0.5 rounded-md text-[11px] font-semibold">
            ⚡ Partial
          </span>
        )}
        {!job.isPossiblyClosed && job.verificationStatus === "UNVERIFIED" && (
          <span className="bg-[#F2EFE9] text-[#77786F] px-2 py-0.5 rounded-md text-[11px]">
            Alert
          </span>
        )}
        {job.graduationYears && job.graduationYears.length > 0 && (
          <span className="bg-[#FAF9F5] border border-[#EAE7DF] text-[#55564F] px-2 py-0.5 rounded-md text-[11px]">
            Batch {job.graduationYears.map((y) => `'${String(y).slice(-2)}`).join(", ")}
          </span>
        )}
      </div>

      {/* Skills tags and Save Button */}
      <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-[#F2EFE9]">
        <div className="flex flex-wrap items-center gap-1.5 flex-1 overflow-hidden">
          {job.requiredSkills.slice(0, 3).map((skill) => (
            <span
              key={skill}
              className="text-[11px] font-medium bg-[#FAF9F5] border border-[#E8E6DF] text-[#5A5C52] px-2 py-0.5 rounded-full"
            >
              {skill}
            </span>
          ))}
          {job.requiredSkills.length > 3 && (
            <span className="text-[10px] text-[#8F9187] font-medium">
              +{job.requiredSkills.length - 3}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleBookmark}
          disabled={isSaving}
          aria-label={isSaved ? `Remove ${job.title} from saved` : `Save ${job.title}`}
          aria-pressed={isSaved}
          className={`w-11 h-11 -mr-2 -my-2 flex items-center justify-center rounded-full hover:bg-[#F2EFE9] transition-colors ${
            isSaved ? "text-[#285C45]" : "text-[#9E9F96] hover:text-[#242720]"
          }`}
        >
          <Bookmark
            className={`w-4 h-4 ${isSaved ? "fill-[#285C45]" : ""}`}
            aria-hidden="true"
          />
        </button>
      </div>
    </Link>
  );
}
