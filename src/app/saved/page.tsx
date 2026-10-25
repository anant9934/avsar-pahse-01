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
    <MobileShell activeScreenNumber={4} savedCount={savedJobIds.length} appliedCount={4}>
      <div className="flex-1 flex flex-col pb-6 bg-[#F8F6F1]">
        <MobileHeader title="Saved Opportunities" showBack={true} />

        <div className="px-4 pt-3 flex flex-col gap-3">
          <span className="text-xs font-semibold text-[#55564F]">
            {savedJobs.length} {savedJobs.length === 1 ? "opportunity" : "opportunities"} saved
          </span>

          <div className="flex flex-col gap-3">
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

            {savedJobs.length === 0 && !loading && (
              <div className="text-center py-12 px-4 card-surface bg-white mt-4">
                <Bookmark className="w-8 h-8 text-[#9E9F96] mx-auto mb-2" />
                <p className="text-sm font-semibold text-[#242720]">No saved opportunities yet</p>
                <p className="text-xs text-[#77786F] mt-1">
                  Tap the bookmark icon on any job card to save it for later review.
                </p>
                <Link
                  href="/explore"
                  className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-[#285C45] text-white rounded-full text-xs font-semibold"
                >
                  <Compass className="w-3.5 h-3.5" />
                  Explore Opportunities
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </MobileShell>
  );
}
