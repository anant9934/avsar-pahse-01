"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, Bell, UserCheck, ArrowRight } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { JobCard } from "@/components/jobs/JobCard";
import { CircularProgress } from "@/components/ui/CircularProgress";
import type { Job, Candidate } from "@/types";

export default function HomePage() {
  const router = useRouter();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [savedJobIds, setSavedJobIds] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState("For You");
  const [searchQuery, setSearchQuery] = useState("");

  const categories = ["For You", "Latest", "Internship", "Remote", "Full-time"];

  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, jobsRes, savedRes] = await Promise.all([
          fetch("/api/profile"),
          fetch(`/api/jobs?filter=${encodeURIComponent(activeCategory.toLowerCase())}`),
          fetch("/api/jobs/saved"),
        ]);

        const profileData = await profileRes.json();
        const jobsData = await jobsRes.json();
        const savedData = await savedRes.json();

        setCandidate(profileData.candidate);
        setJobs(jobsData.jobs || []);
        setSavedJobIds(savedData.savedJobIds || []);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      }
    }
    loadData();
  }, [activeCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/explore?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <MobileShell
      activeScreenNumber={3}
      savedCount={savedJobIds.length}
      appliedCount={4}
    >
      <div className="flex-1 flex flex-col px-4 pt-3 pb-6 bg-[#F8F6F1]">
        {/* Top Header: Greeting, Avatar & Notifications */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-xs font-medium text-[#77786F] block">
              Good morning,
            </span>
            <h1 className="text-xl font-extrabold text-[#242720] tracking-tight flex items-center gap-1.5">
              <span>{candidate?.name?.split(" ")[0] || "Rohan"}</span>
              <span className="text-xl">👋</span>
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="w-10 h-10 rounded-full bg-white border border-[#EAE7DF] flex items-center justify-center text-[#242720] hover:bg-[#F4F1EA] transition-colors relative shadow-2xs"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 stroke-[1.8px]" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#E5484D] ring-2 ring-white" />
            </button>

            <Link
              href="/profile"
              className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-2xs hover:ring-2 hover:ring-[#285C45] transition-all relative block shrink-0"
              aria-label="View Profile"
            >
              <Image
                src={candidate?.avatar || "/images/avatar-rohan.jpg"}
                alt="Profile Avatar"
                fill
                className="object-cover"
              />
            </Link>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative mb-4">
          <Search className="w-4 h-4 text-[#77786F] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search jobs, skills or companies..."
            className="w-full h-11 pl-10 pr-4 bg-white border border-[#EAE7DF] rounded-2xl text-xs sm:text-sm text-[#242720] placeholder-[#9E9F96] focus:outline-none focus:border-[#285C45] focus:ring-1 focus:ring-[#285C45] shadow-2xs transition-all"
          />
        </form>

        {/* Quick Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 mb-4 select-none">
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-[#285C45] text-white shadow-xs"
                    : "bg-white border border-[#EAE7DF] text-[#55564F] hover:bg-[#F6F4EE]"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Your Career Journey / Profile Completion Card */}
        <Link
          href="/profile"
          className="card-surface-interactive p-4 mb-5 flex items-center justify-between gap-3 bg-white"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-[#EAF4EB] text-[#285C45] flex items-center justify-center shrink-0">
              <UserCheck className="w-6 h-6 stroke-[2px]" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#77786F] block">
                Your Career Journey
              </span>
              <h2 className="text-sm font-bold text-[#242720] truncate">
                Profile completion
              </h2>
              <span className="text-xs text-[#285C45] font-medium flex items-center gap-1 mt-0.5">
                Complete profile for 3x better matches <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          <div className="shrink-0">
            <CircularProgress
              value={candidate?.profileCompletionPercentage || 80}
              size={54}
              strokeWidth={5}
              color="#285C45"
              trackColor="#EAF2E8"
            />
          </div>
        </Link>

        {/* Recommended for you Section */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-[#242720]">
            Recommended for you
          </h2>
          <Link
            href="/explore"
            className="text-xs font-semibold text-[#285C45] hover:underline"
          >
            See all
          </Link>
        </div>

        {/* Job Cards List */}
        <div className="flex flex-col gap-3">
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
      </div>
    </MobileShell>
  );
}
