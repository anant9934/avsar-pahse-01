"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, Bell, UserCheck, ArrowRight, X, Sparkles, CheckCircle2 } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { JobCard } from "@/components/jobs/JobCard";
import { CircularProgress } from "@/components/ui/CircularProgress";
import type { Job, Candidate } from "@/types";

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  unread: boolean;
  type: "match" | "application" | "profile";
}

export default function HomePage() {
  const router = useRouter();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [savedJobIds, setSavedJobIds] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState("For You");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: "notif-1",
      title: "Strong Match Detected",
      description: "Google Frontend Engineering Intern matches 92% of your profile skills.",
      time: "10m ago",
      unread: true,
      type: "match",
    },
    {
      id: "notif-2",
      title: "Application Submitted",
      description: "Your application for Frontend Engineering Intern is Under Review.",
      time: "2h ago",
      unread: true,
      type: "application",
    },
    {
      id: "notif-3",
      title: "ERIS Score Calibration",
      description: "Your profile ERIS Score is 85/100. Complete projects to reach 90+.",
      time: "1d ago",
      unread: false,
      type: "profile",
    },
  ]);

  const hasUnreadNotifs = notifications.some((n) => n.unread);
  const categories = ["For You", "Latest", "Internship", "Remote", "Full-time"];

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isNotifOpen) {
        setIsNotifOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isNotifOpen]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
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
      } finally {
        setLoading(false);
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

  const markAllNotifsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  return (
    <MobileShell activeScreenNumber={3} savedCount={savedJobIds.length}>
      <div className="flex-1 flex flex-col px-4 pt-3 pb-6 bg-[#F8F6F1]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Feed Column */}
          <div className="lg:col-span-8 flex flex-col">
            {/* Top Header: Greeting, Avatar & Notifications */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-xs font-medium text-[#77786F] block">
                  Good morning,
                </span>
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#242720] tracking-tight flex items-center gap-1.5">
                  <span>{candidate?.name?.split(" ")[0] || "Rohan"}</span>
                  <span className="text-xl" role="img" aria-label="waving hand">👋</span>
                </h1>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsNotifOpen(true)}
                  className="w-10 h-10 rounded-full bg-white border border-[#EAE7DF] flex items-center justify-center text-[#242720] hover:bg-[#F4F1EA] transition-colors relative shadow-2xs"
                  aria-label={hasUnreadNotifs ? "Notifications (new unread alerts)" : "Notifications"}
                  aria-haspopup="dialog"
                  aria-expanded={isNotifOpen}
                >
                  <Bell className="w-4 h-4 stroke-[1.8px]" aria-hidden="true" />
                  {hasUnreadNotifs && (
                    <span
                      className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#E5484D] ring-2 ring-white"
                      aria-hidden="true"
                    />
                  )}
                </button>

                <Link
                  href="/profile"
                  className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-2xs hover:ring-2 hover:ring-[#285C45] transition-all relative block shrink-0"
                  aria-label="View Candidate Profile"
                >
                  <Image
                    src={candidate?.avatar || "/images/avatar-rohan.jpg"}
                    alt="Candidate Profile Avatar"
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                </Link>
              </div>
            </div>

            {/* Search Bar with Clear Button */}
            <form onSubmit={handleSearchSubmit} className="relative mb-4" role="search">
              <Search
                className="w-4 h-4 text-[#77786F] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search jobs, skills or companies..."
                aria-label="Search jobs, skills, or companies"
                className="w-full h-11 pl-10 pr-9 bg-white border border-[#EAE7DF] rounded-2xl text-xs sm:text-sm text-[#242720] placeholder-[#9E9F96] focus:outline-none focus:border-[#285C45] focus:ring-1 focus:ring-[#285C45] shadow-2xs transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search input"
                  className="w-8 h-8 absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-[#77786F] hover:text-[#242720] rounded-full hover:bg-[#F2EFE9] transition-colors"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </form>

            {/* Quick Category Filter Pills */}
            <div
              className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 mb-4 select-none"
              role="region"
              aria-label="Dashboard opportunity filters"
            >
              {categories.map((cat) => {
                const isActive = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    aria-pressed={isActive}
                    className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap min-h-[38px] transition-all ${
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

            {/* Mobile-only Profile Completion Card */}
            <Link
              href="/profile"
              className="lg:hidden card-surface-interactive p-4 mb-5 flex items-center justify-between gap-3 bg-white"
              aria-label={`Profile Completion is ${candidate?.profileCompletionPercentage || 80} percent. Click to complete profile.`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-[#EAF4EB] text-[#285C45] flex items-center justify-center shrink-0">
                  <UserCheck className="w-5 h-5 stroke-[2px]" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#77786F] block">
                    Your Career Journey
                  </span>
                  <h2 className="text-xs sm:text-sm font-bold text-[#242720] truncate">
                    Profile completion (80%)
                  </h2>
                  <span className="text-[11px] text-[#285C45] font-medium flex items-center gap-1 mt-0.5">
                    Complete profile for 3x better matches <ArrowRight className="w-3 h-3" aria-hidden="true" />
                  </span>
                </div>
              </div>

              <div className="shrink-0">
                <CircularProgress
                  value={candidate?.profileCompletionPercentage || 80}
                  size={48}
                  strokeWidth={4.5}
                  color="#285C45"
                  trackColor="#EAF2E8"
                />
              </div>
            </Link>

            {/* Recommended for you Section */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base sm:text-lg font-bold text-[#242720]">
                Recommended for you
              </h2>
              <Link
                href="/explore"
                className="text-xs font-semibold text-[#285C45] hover:underline min-h-[32px] flex items-center gap-1"
              >
                <span>Explore all roles</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Job Cards List or Shimmer Skeletons */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5" aria-busy="true" aria-label="Loading recommended opportunities">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
          </div>

          {/* Desktop Right Sidebar Column */}
          <div className="hidden lg:flex lg:col-span-4 flex-col gap-4 sticky top-20">
            {/* Career Journey & Profile Completion Card */}
            <div className="bg-white rounded-3xl p-5 border border-[#ECEAE3] shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#77786F]">
                  Profile Status
                </span>
                <span className="text-xs font-bold text-[#285C45] bg-[#EAF4EB] px-2 py-0.5 rounded-full">
                  Verified
                </span>
              </div>

              <div className="flex items-center gap-4 mb-4">
                <CircularProgress
                  value={candidate?.profileCompletionPercentage || 80}
                  size={58}
                  strokeWidth={5}
                  color="#285C45"
                  trackColor="#EAF2E8"
                />
                <div>
                  <h3 className="text-sm font-bold text-[#242720]">
                    {candidate?.profileCompletionPercentage || 80}% Complete
                  </h3>
                  <p className="text-xs text-[#77786F] mt-0.5">
                    Verified profiles receive 3x higher recruiter response rates.
                  </p>
                </div>
              </div>

              <Link
                href="/profile"
                className="w-full py-2.5 px-4 bg-[#F5F3EC] hover:bg-[#EAE7DF] text-[#242720] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Edit Profile Details</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Quick Activity Stats */}
            <div className="bg-white rounded-3xl p-5 border border-[#ECEAE3] shadow-2xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#77786F] mb-3">
                Your Activity
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/saved"
                  className="p-3 bg-[#FAF9F6] rounded-2xl border border-[#ECEAE3] hover:border-[#285C45]/40 transition-colors"
                >
                  <span className="text-xl font-extrabold text-[#242720] block">
                    {savedJobIds.length}
                  </span>
                  <span className="text-xs text-[#77786F]">Saved Jobs</span>
                </Link>
                <Link
                  href="/applications"
                  className="p-3 bg-[#FAF9F6] rounded-2xl border border-[#ECEAE3] hover:border-[#285C45]/40 transition-colors"
                >
                  <span className="text-xl font-extrabold text-[#285C45] block">
                    Track
                  </span>
                  <span className="text-xs text-[#77786F]">Applications</span>
                </Link>
              </div>
            </div>

            {/* Verified Technical Skills Widget */}
            <div className="bg-white rounded-3xl p-5 border border-[#ECEAE3] shadow-2xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#77786F] mb-3">
                Top Matched Skills
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {["React", "TypeScript", "Next.js", "Tailwind CSS", "Node.js", "REST APIs", "Git"].map((skill) => (
                  <span
                    key={skill}
                    className="px-2.5 py-1 bg-[#EAF4EB] text-[#285C45] text-xs font-medium rounded-lg"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Accessible Notifications Drawer Modal */}
      {isNotifOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="notif-dialog-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs transition-opacity"
          onClick={() => setIsNotifOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-[#F8F6F1] rounded-t-3xl sm:rounded-3xl border border-[#ECEAE3] shadow-2xl p-5 flex flex-col gap-3.5 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E8E6DF]">
              <div>
                <h2 id="notif-dialog-title" className="text-base font-bold text-[#242720]">
                  Notifications
                </h2>
                <p className="text-xs text-[#77786F]">Stay updated on applications and matches</p>
              </div>
              <button
                type="button"
                onClick={() => setIsNotifOpen(false)}
                aria-label="Close notifications"
                className="w-9 h-9 rounded-full flex items-center justify-center text-[#77786F] hover:bg-[#EAE7DF] transition-colors"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-col gap-2.5">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3.5 rounded-2xl border transition-colors flex items-start gap-3 ${
                    notif.unread
                      ? "bg-white border-[#285C45]/30 shadow-2xs"
                      : "bg-[#F4F2EC] border-[#ECEAE3]"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      notif.type === "match"
                        ? "bg-[#EAF4EB] text-[#285C45]"
                        : notif.type === "application"
                        ? "bg-[#EDF4FE] text-[#2A67C4]"
                        : "bg-[#FEF7EA] text-[#B27715]"
                    }`}
                  >
                    {notif.type === "match" ? (
                      <Sparkles className="w-4 h-4" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="text-xs font-bold text-[#242720]">{notif.title}</h3>
                      <span className="text-[10px] text-[#77786F] shrink-0">{notif.time}</span>
                    </div>
                    <p className="text-xs text-[#55564F] mt-0.5 leading-relaxed">{notif.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#E8E6DF]">
              <button
                type="button"
                onClick={markAllNotifsRead}
                className="text-xs font-semibold text-[#285C45] hover:underline min-h-[36px] px-2"
              >
                Mark all as read
              </button>
              <button
                type="button"
                onClick={() => setIsNotifOpen(false)}
                className="px-4 py-2 bg-[#285C45] hover:bg-[#1E4735] text-white rounded-full text-xs font-semibold min-h-[38px] transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileShell>
  );
}
