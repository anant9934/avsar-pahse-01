"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, ChevronDown, Bookmark } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { MobileHeader } from "@/components/navigation/MobileHeader";
import { JobCard } from "@/components/jobs/JobCard";
import type { Job } from "@/types";

export default function ExplorePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [savedJobIds, setSavedJobIds] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<"recommended" | "latest">("recommended");
  const [loading, setLoading] = useState(true);

  const filterChips = ["All", "Remote", "Bengaluru", "Internship", "Full-time"];

  useEffect(() => {
    async function loadJobs() {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (searchQuery) queryParams.set("q", searchQuery);
        if (activeFilter.toLowerCase() !== "all") queryParams.set("filter", activeFilter.toLowerCase());
        queryParams.set("sort", sortOption);

        const [jobsRes, savedRes] = await Promise.all([
          fetch(`/api/jobs?${queryParams.toString()}`),
          fetch("/api/jobs/saved"),
        ]);

        const jobsData = await jobsRes.json();
        const savedData = await savedRes.json();

        setJobs(jobsData.jobs || []);
        setSavedJobIds(savedData.savedJobIds || []);
      } catch (err) {
        console.error("Failed to fetch explore jobs", err);
      } finally {
        setLoading(false);
      }
    }

    const timer = setTimeout(loadJobs, 150);
    return () => clearTimeout(timer);
  }, [activeFilter, searchQuery, sortOption]);

  return (
    <MobileShell
      activeScreenNumber={4}
      savedCount={savedJobIds.length}
      appliedCount={4}
    >
      <div className="flex-1 flex flex-col pb-6 bg-[#F8F6F1]">
        {/* Mobile Header */}
        <MobileHeader
          title="Explore Opportunities"
          showBack={true}
          rightAction={
            <Link
              href="/saved"
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#242720] hover:bg-[#EFECE5] transition-colors relative"
              aria-label="Saved Jobs"
            >
              <Bookmark className="w-5 h-5 stroke-[1.8px]" />
              {savedJobIds.length > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#285C45]" />
              )}
            </Link>
          }
        />

        <div className="px-4 pt-3 flex flex-col gap-3.5">
          {/* Search bar with filter icon button */}
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#77786F] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search roles, skills, companies..."
                className="w-full h-11 pl-10 pr-4 bg-white border border-[#EAE7DF] rounded-2xl text-xs sm:text-sm text-[#242720] placeholder-[#9E9F96] focus:outline-none focus:border-[#285C45] focus:ring-1 focus:ring-[#285C45] shadow-2xs"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                // cycle quick filter
                const nextIdx = (filterChips.indexOf(activeFilter) + 1) % filterChips.length;
                setActiveFilter(filterChips[nextIdx]);
              }}
              className="w-11 h-11 bg-white border border-[#EAE7DF] rounded-2xl flex items-center justify-center text-[#242720] hover:bg-[#F6F4EE] shadow-2xs transition-colors shrink-0"
              aria-label="Filter Options"
            >
              <SlidersHorizontal className="w-4 h-4 stroke-[1.8px]" />
            </button>
          </div>

          {/* Filter Chips (Horizontal Scroll) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 select-none">
            {filterChips.map((chip) => {
              const active = activeFilter === chip;
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setActiveFilter(chip)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                    active
                      ? "bg-[#285C45] text-white shadow-xs"
                      : "bg-white border border-[#EAE7DF] text-[#55564F] hover:bg-[#F6F4EE]"
                  }`}
                >
                  {chip}
                </button>
              );
            })}
          </div>

          {/* Result Count & Sort Dropdown */}
          <div className="flex items-center justify-between pt-1 select-none text-xs">
            <span className="font-semibold text-[#55564F]">
              {jobs.length > 0 ? `${jobs.length * 248 + 40} opportunities` : "0 opportunities"}
            </span>

            <div className="flex items-center gap-1.5 text-[#55564F]">
              <span className="font-medium text-[#77786F]">Sort</span>
              <button
                type="button"
                onClick={() => setSortOption(sortOption === "recommended" ? "latest" : "recommended")}
                className="font-bold text-[#242720] flex items-center gap-0.5 hover:text-[#285C45] bg-white border border-[#EAE7DF] px-2 py-1 rounded-lg"
              >
                <span>{sortOption === "recommended" ? "Best Match" : "Latest"}</span>
                <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
              </button>
            </div>
          </div>

          {/* Job Listings List */}
          <div className="flex flex-col gap-3 mt-1">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                initialSaved={savedJobIds.includes(job.id)}
                onToggleSave={(id, isSaved) => {
                  setSavedJobIds((prev) =>
                    isSaved ? [...prev, id] : prev.filter((i) => i !== id)
                  );
                }}
              />
            ))}

            {jobs.length === 0 && !loading && (
              <div className="text-center py-12 px-4 card-surface bg-white mt-4">
                <p className="text-sm font-semibold text-[#242720]">No opportunities found</p>
                <p className="text-xs text-[#77786F] mt-1">
                  Try clearing your search query or choosing another filter category.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setActiveFilter("All");
                  }}
                  className="mt-4 px-4 py-2 bg-[#285C45] text-white rounded-full text-xs font-semibold"
                >
                  Reset Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </MobileShell>
  );
}
