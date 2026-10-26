"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Bookmark, Compass } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { MobileHeader } from "@/components/navigation/MobileHeader";
import { JobCard } from "@/components/jobs/JobCard";
import type { Job } from "@/types";

export default function SavedJobsPage() {
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [savedJobIds, setSavedJobIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSaved() {
      try {
        const res = await fetch("/api/jobs/saved");
        if (res.ok) {
          const data = await res.json();
          setSavedJobIds(data.savedJobIds || []);
          setSavedJobs(data.savedJobs || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadSaved();
  }, []);

  return (
    <MobileShell savedCount={savedJobIds.length}>
      <div className="flex-1 flex flex-col pb-6 bg-[#F8F6F1]">
        {/* Mobile Header (Hidden on desktop) */}
        <div className="md:hidden">
          <MobileHeader title="Saved Opportunities" showBack={true} />
        </div>

        <div className="px-4 pt-2 sm:pt-4 flex flex-col gap-4">
          {/* Desktop Title Banner */}
          <div className="hidden md:flex flex-col gap-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#242720] tracking-tight">
              Saved Opportunities
            </h1>
            <p className="text-xs sm:text-sm text-[#77786F]">
              Keep track of roles you have bookmarked to review or apply before deadlines.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#55564F]" aria-live="polite">
              {loading
                ? "Loading saved opportunities..."
                : `${savedJobs.length} ${savedJobs.length === 1 ? "opportunity" : "opportunities"} saved`}
            </span>
            {savedJobs.length > 0 && (
              <Link
                href="/explore"
                className="text-xs font-semibold text-[#285C45] hover:underline"
              >
                Find more roles
              </Link>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="card-surface p-4 bg-white flex flex-col gap-3 min-h-[148px]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl skeleton-shimmer" />
                      <div className="flex flex-col gap-1.5">
                        <div className="w-32 h-4 rounded-md skeleton-shimmer" />
                        <div className="w-24 h-3 rounded-md skeleton-shimmer" />
                      </div>
                    </div>
                    <div className="w-16 h-6 rounded-full skeleton-shimmer" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  initialSaved={true}
                  onToggleSave={(id, isSaved) => {
                    if (!isSaved) {
                      setSavedJobs((prev) => prev.filter((j) => j.id !== id));
                      setSavedJobIds((prev) => prev.filter((i) => i !== id));
                    }
                  }}
                />
              ))}
            </div>
          )}

          {savedJobs.length === 0 && !loading && (
            <div className="text-center py-16 px-6 card-surface bg-white rounded-3xl border border-[#ECEAE3] max-w-lg mx-auto w-full my-8 shadow-2xs">
              <div className="w-14 h-14 rounded-2xl bg-[#F6F4EE] flex items-center justify-center mx-auto mb-3 text-[#77786F]">
                <Bookmark className="w-7 h-7 stroke-[1.6px]" aria-hidden="true" />
              </div>
              <h2 className="text-base font-bold text-[#242720]">No saved opportunities yet</h2>
              <p className="text-xs text-[#77786F] mt-1.5 max-w-sm mx-auto leading-relaxed">
                Bookmark exciting internships and engineering roles while browsing so you can easily compare, prepare your resume, and submit before deadlines.
              </p>
              <Link
                href="/explore"
                className="inline-flex items-center gap-1.5 mt-5 px-6 py-2.5 bg-[#285C45] hover:bg-[#1E4735] text-white rounded-full text-xs font-semibold shadow-2xs transition-colors"
              >
                <Compass className="w-4 h-4" aria-hidden="true" />
                <span>Explore 130+ Roles</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </MobileShell>
  );
}
