"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, ChevronDown, Bookmark, X, Check } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { MobileHeader } from "@/components/navigation/MobileHeader";
import { JobCard } from "@/components/jobs/JobCard";
import { useDebounce } from "@/hooks";
import type { Job } from "@/types";

export default function ExplorePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [savedJobIds, setSavedJobIds] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery, 350);
  const [sortOption, setSortOption] = useState<"recommended" | "latest">("recommended");
  const [loading, setLoading] = useState(true);
  const [totalOpportunities, setTotalOpportunities] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Advanced drawer filter draft state
  const [drawerArrangement, setDrawerArrangement] = useState<string>("all");
  const [drawerType, setDrawerType] = useState<string>("all");
  const [drawerBatch, setDrawerBatch] = useState<string>("all");
  const [drawerVerified, setDrawerVerified] = useState<boolean>(false);

  const drawerRef = useRef<HTMLDivElement>(null);

  const filterChips = [
    { label: "All", value: "all" },
    { label: "Remote", value: "remote" },
    { label: "Bengaluru", value: "bengaluru" },
    { label: "Internship", value: "internship" },
    { label: "Full-time", value: "full-time" },
    { label: "Verified", value: "verified" },
    { label: "Batch 2025", value: "batch-2025" },
    { label: "Batch 2026", value: "batch-2026" },
    { label: "Batch 2027", value: "batch-2027" },
  ];

  // Close filter drawer on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isFilterOpen) {
        setIsFilterOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFilterOpen]);

  useEffect(() => {
    async function loadJobs() {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (debouncedQuery.trim()) queryParams.set("q", debouncedQuery.trim());
        if (activeFilter.toLowerCase() !== "all") queryParams.set("filter", activeFilter.toLowerCase());
        queryParams.set("sort", sortOption);
        queryParams.set("page", "1");
        queryParams.set("limit", "15");

        const [jobsRes, savedRes] = await Promise.all([
          fetch(`/api/jobs?${queryParams.toString()}`),
          fetch("/api/jobs/saved"),
        ]);

        const jobsData = await jobsRes.json();
        const savedData = await savedRes.json();

        setJobs(jobsData.jobs || []);
        setTotalOpportunities(jobsData.total || 0);
        setHasMore(Boolean(jobsData.hasMore));
        setPage(1);
        setSavedJobIds(savedData.savedJobIds || []);
      } catch (err) {
        console.error("Failed to fetch explore jobs", err);
      } finally {
        setLoading(false);
      }
    }

    loadJobs();
  }, [activeFilter, debouncedQuery, sortOption]);

  const handleLoadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const queryParams = new URLSearchParams();
      if (searchQuery.trim()) queryParams.set("q", searchQuery.trim());
      if (activeFilter.toLowerCase() !== "all") queryParams.set("filter", activeFilter.toLowerCase());
      queryParams.set("sort", sortOption);
      queryParams.set("page", String(nextPage));
      queryParams.set("limit", "15");

      const res = await fetch(`/api/jobs?${queryParams.toString()}`);
      const data = await res.json();
      if (data.jobs) {
        setJobs((prev) => [...prev, ...data.jobs]);
        setPage(nextPage);
        setHasMore(Boolean(data.hasMore));
      }
    } catch (err) {
      console.error("Failed to load more jobs", err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleApplyDrawerFilters = () => {
    // Map selected drawer facets to primary filter or compose query
    if (drawerVerified) {
      setActiveFilter("verified");
    } else if (drawerArrangement !== "all") {
      setActiveFilter(drawerArrangement);
    } else if (drawerType !== "all") {
      setActiveFilter(drawerType);
    } else if (drawerBatch !== "all") {
      setActiveFilter(`batch-${drawerBatch}`);
    } else {
      setActiveFilter("all");
    }
    setIsFilterOpen(false);
  };

  const handleResetDrawerFilters = () => {
    setDrawerArrangement("all");
    setDrawerType("all");
    setDrawerBatch("all");
    setDrawerVerified(false);
    setActiveFilter("all");
    setSearchQuery("");
    setIsFilterOpen(false);
  };

  return (
    <MobileShell activeScreenNumber={4} savedCount={savedJobIds.length}>
      <div className="flex-1 flex flex-col pb-6 bg-[#F8F6F1]">
        {/* Mobile Header */}
        <MobileHeader
          title="Explore Opportunities"
          showBack={true}
          rightAction={
            <Link
              href="/saved"
              className="w-11 h-11 rounded-full flex items-center justify-center text-[#242720] hover:bg-[#EFECE5] transition-colors relative"
              aria-label="View Saved Jobs"
            >
              <Bookmark className="w-5 h-5 stroke-[1.8px]" aria-hidden="true" />
              {savedJobIds.length > 0 && (
                <span
                  className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#285C45]"
                  aria-hidden="true"
                />
              )}
            </Link>
          }
        />

        <div className="px-4 pt-3 flex flex-col gap-3.5">
          {/* Search bar with filter icon button */}
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 text-[#77786F] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search roles, skills, companies..."
                aria-label="Search opportunities"
                className="w-full h-11 pl-10 pr-9 bg-white border border-[#EAE7DF] rounded-2xl text-xs sm:text-sm text-[#242720] placeholder-[#9E9F96] focus:outline-none focus:border-[#285C45] focus:ring-1 focus:ring-[#285C45] shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search query"
                  className="w-8 h-8 absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-[#77786F] hover:text-[#242720] rounded-full hover:bg-[#F2EFE9] transition-colors"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsFilterOpen(true)}
              className={`w-11 h-11 bg-white border rounded-2xl flex items-center justify-center transition-colors shrink-0 shadow-2xs ${
                activeFilter !== "all"
                  ? "border-[#285C45] text-[#285C45] bg-[#EAF4EB]"
                  : "border-[#EAE7DF] text-[#242720] hover:bg-[#F6F4EE]"
              }`}
              aria-label="Open detailed filter options"
              aria-haspopup="dialog"
              aria-expanded={isFilterOpen}
            >
              <SlidersHorizontal className="w-4 h-4 stroke-[1.8px]" aria-hidden="true" />
            </button>
          </div>

          {/* Filter Chips (Horizontal Scroll) */}
          <div
            className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 select-none"
            role="region"
            aria-label="Quick category filters"
          >
            {filterChips.map((chip) => {
              const active = activeFilter.toLowerCase() === chip.value.toLowerCase();
              return (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => setActiveFilter(chip.value)}
                  aria-pressed={active}
                  className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap min-h-[38px] transition-all ${
                    active
                      ? "bg-[#285C45] text-white shadow-xs"
                      : "bg-white border border-[#EAE7DF] text-[#55564F] hover:bg-[#F6F4EE]"
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          {/* Result Count & Sort Dropdown */}
          <div className="flex items-center justify-between pt-1 select-none text-xs">
            <span
              className="font-semibold text-[#55564F]"
              aria-live="polite"
              aria-atomic="true"
            >
              {loading
                ? "Searching verified roles..."
                : totalOpportunities > 0
                ? `${jobs.length} of ${totalOpportunities} opportunities`
                : "0 opportunities"}
            </span>

            <div className="flex items-center gap-1.5 text-[#55564F]">
              <span className="font-medium text-[#77786F]">Sort:</span>
              <button
                type="button"
                onClick={() => setSortOption(sortOption === "recommended" ? "latest" : "recommended")}
                aria-label={`Sort order: ${sortOption === "recommended" ? "Best Match" : "Latest"}. Click to change.`}
                className="font-bold text-[#242720] flex items-center gap-1 hover:text-[#285C45] bg-white border border-[#EAE7DF] px-2.5 py-1.5 rounded-lg shadow-2xs"
              >
                <span>{sortOption === "recommended" ? "Best Match" : "Latest"}</span>
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Job Listings List or Shimmer Skeletons */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-1" aria-busy="true" aria-label="Loading opportunities">
              {[1, 2, 3, 4].map((i) => (
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
                  <div className="flex gap-2 mt-2">
                    <div className="w-16 h-5 rounded-md skeleton-shimmer" />
                    <div className="w-20 h-5 rounded-md skeleton-shimmer" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-1">
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
            </div>
          )}

          {hasMore && !loading && (
            <div className="text-center pt-3 pb-4">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-6 py-2.5 bg-white border border-[#285C45] text-[#285C45] hover:bg-[#EBF3ED] rounded-full text-xs font-bold transition-colors shadow-2xs disabled:opacity-50 min-h-[44px]"
              >
                {loadingMore ? "Loading more..." : "Load More Opportunities"}
              </button>
            </div>
          )}

          {jobs.length === 0 && !loading && (
            <div className="text-center py-12 px-4 card-surface bg-white mt-4">
              <p className="text-sm font-semibold text-[#242720]">No matching opportunities found</p>
              <p className="text-xs text-[#77786F] mt-1 max-w-xs mx-auto">
                Try clearing search terms or resetting filters to discover more open roles.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setActiveFilter("all");
                }}
                className="mt-4 px-5 py-2.5 bg-[#285C45] hover:bg-[#1E4735] text-white rounded-full text-xs font-semibold min-h-[44px] transition-colors"
              >
                Reset All Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Accessible Filter Drawer Modal */}
      {isFilterOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="filter-dialog-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs transition-opacity"
          onClick={() => setIsFilterOpen(false)}
        >
          <div
            ref={drawerRef}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-[#F8F6F1] rounded-t-3xl sm:rounded-3xl border border-[#ECEAE3] shadow-2xl p-5 flex flex-col gap-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E8E6DF]">
              <div>
                <h2 id="filter-dialog-title" className="text-base font-bold text-[#242720]">
                  Filter Opportunities
                </h2>
                <p className="text-xs text-[#77786F]">Fine-tune roles to match your preference</p>
              </div>
              <button
                type="button"
                onClick={() => setIsFilterOpen(false)}
                aria-label="Close filters"
                className="w-9 h-9 rounded-full flex items-center justify-center text-[#77786F] hover:bg-[#EAE7DF] transition-colors"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Arrangement */}
            <div>
              <span className="text-xs font-bold text-[#242720] block mb-2">Work Arrangement</span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "All", val: "all" },
                  { label: "Remote", val: "remote" },
                  { label: "Bengaluru", val: "bengaluru" },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => setDrawerArrangement(item.val)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      drawerArrangement === item.val
                        ? "bg-[#285C45] text-white border-[#285C45]"
                        : "bg-white text-[#55564F] border-[#E8E6DF] hover:bg-[#F2EFE9]"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Employment Type */}
            <div>
              <span className="text-xs font-bold text-[#242720] block mb-2">Employment Type</span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "All", val: "all" },
                  { label: "Internship", val: "internship" },
                  { label: "Full-time", val: "full-time" },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => setDrawerType(item.val)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      drawerType === item.val
                        ? "bg-[#285C45] text-white border-[#285C45]"
                        : "bg-white text-[#55564F] border-[#E8E6DF] hover:bg-[#F2EFE9]"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Graduation Batch */}
            <div>
              <span className="text-xs font-bold text-[#242720] block mb-2">Graduation Batch</span>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "All", val: "all" },
                  { label: "2025", val: "2025" },
                  { label: "2026", val: "2026" },
                  { label: "2027", val: "2027" },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => setDrawerBatch(item.val)}
                    className={`py-2 px-2 text-center rounded-xl text-xs font-semibold border transition-all ${
                      drawerBatch === item.val
                        ? "bg-[#285C45] text-white border-[#285C45]"
                        : "bg-white text-[#55564F] border-[#E8E6DF] hover:bg-[#F2EFE9]"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Verification Status */}
            <div className="flex items-center justify-between py-2 border-t border-[#E8E6DF]">
              <div>
                <span className="text-xs font-bold text-[#242720] block">Verified Only</span>
                <span className="text-[11px] text-[#77786F]">Show only employer-verified opportunities</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={drawerVerified}
                onClick={() => setDrawerVerified(!drawerVerified)}
                className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                  drawerVerified ? "bg-[#285C45]" : "bg-[#D8D6CE]"
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    drawerVerified ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-3 border-t border-[#E8E6DF]">
              <button
                type="button"
                onClick={handleResetDrawerFilters}
                className="flex-1 py-2.5 rounded-full border border-[#D8D6CE] text-[#55564F] hover:bg-[#EFECE5] font-semibold text-xs min-h-[44px] transition-colors"
              >
                Reset All
              </button>
              <button
                type="button"
                onClick={handleApplyDrawerFilters}
                className="flex-1 py-2.5 rounded-full bg-[#285C45] hover:bg-[#1E4735] text-white font-semibold text-xs min-h-[44px] transition-colors shadow-xs flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileShell>
  );
}
