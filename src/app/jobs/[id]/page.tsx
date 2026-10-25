"use client";

import React, { useState, useEffect, use, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Bookmark,
  Share2,
  MapPin,
  Calendar,
  Banknote,
  CheckCircle2,
  PlusCircle,
  ArrowRight,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { CompanyLogo } from "@/components/brand/CompanyLogo";
import type { Job, MatchAnalysis } from "@/types";

function JobDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [job, setJob] = useState<Job | null>(null);
  const [match, setMatch] = useState<MatchAnalysis | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"Overview" | "Requirements" | "About" | "Reviews">("Overview");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadJob() {
      try {
        const res = await fetch(`/api/jobs/${id}`);
        if (!res.ok) throw new Error("Job not found");
        const data = await res.json();
        setJob(data.job);
        setMatch(data.match);
        setIsSaved(data.isSaved);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadJob();
  }, [id]);

  const handleToggleSave = async () => {
    if (!job) return;
    const nextSaved = !isSaved;
    setIsSaved(nextSaved);
    try {
      await fetch("/api/jobs/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
    } catch (err) {
      console.error(err);
      setIsSaved(!nextSaved);
    }
  };

  const handleShare = () => {
    if (navigator.share && job) {
      navigator.share({
        title: `${job.title} at ${job.company}`,
        text: `Check out this opportunity on Avsar: ${job.title}`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Opportunity link copied to clipboard!");
    }
  };

  if (loading || !job) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-sm text-[#77786F]">
        Loading opportunity details...
      </div>
    );
  }

  const tabs: Array<"Overview" | "Requirements" | "About" | "Reviews"> = [
    "Overview",
    "Requirements",
    "About",
    "Reviews",
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#F8F6F1] pb-24 relative">
      {/* Top Hero Container with Office Photo */}
      <div className="relative h-56 sm:h-64 w-full bg-[#E5E3DC]">
        <Image
          src={job.heroImage || "/images/office-google.jpg"}
          alt={`${job.company} Office`}
          fill
          className="object-cover"
          priority
        />
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />

        {/* Top floating bar */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center text-[#242720] hover:bg-white shadow-sm transition-colors"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.2px]" />
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleSave}
              className={`w-10 h-10 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center transition-colors shadow-sm ${
                isSaved ? "text-[#285C45]" : "text-[#242720] hover:bg-white"
              }`}
              aria-label={isSaved ? "Saved" : "Save"}
            >
              <Bookmark className={`w-5 h-5 ${isSaved ? "fill-[#285C45]" : ""}`} />
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="w-10 h-10 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center text-[#242720] hover:bg-white shadow-sm transition-colors"
              aria-label="Share"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content Overlap Card */}
      <div className="relative -mt-6 rounded-t-[28px] bg-[#F8F6F1] pt-4 px-4 flex flex-col z-10">
        {/* Company Brand Header */}
        <div className="flex items-center gap-3 mb-2">
          <CompanyLogo
            name={job.company}
            logoKey={job.companyLogoKey}
            size="md"
            className="border-2 border-white shadow-xs"
          />
          <div>
            <span className="text-xs font-bold text-[#77786F] block tracking-wide uppercase">
              {job.company}
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#242720] tracking-tight leading-snug">
              {job.title}
            </h1>
          </div>
        </div>

        {/* Location and Arrangement Metadata */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#55564F] mt-1 mb-3">
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-[#77786F]" />
            {job.location}
          </span>
          <span>·</span>
          <span>{job.workArrangement}</span>
          <span>·</span>
          <span>{job.employmentType}</span>
        </div>

        {/* Compensation and Deadline Pill Row */}
        <div className="grid grid-cols-2 gap-2.5 my-1">
          <div className="bg-white border border-[#EAE7DF] rounded-2xl p-3 flex items-center gap-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-xl bg-[#EAF4EB] text-[#285C45] flex items-center justify-center shrink-0">
              <Banknote className="w-4 h-4 stroke-[2px]" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-semibold text-[#77786F] block">
                Compensation
              </span>
              <span className="text-xs sm:text-sm font-bold text-[#242720] truncate block">
                {job.compensation}
              </span>
            </div>
          </div>

          <div className="bg-white border border-[#EAE7DF] rounded-2xl p-3 flex items-center gap-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-xl bg-[#F4F1EA] text-[#55564F] flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 stroke-[2px]" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-semibold text-[#77786F] block">
                Deadline
              </span>
              <span className="text-xs sm:text-sm font-bold text-[#242720] truncate block">
                {job.deadline}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-[#E8E6DF] mt-3 select-none">
          {tabs.map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-xs sm:text-sm font-bold text-center transition-colors relative ${
                  active ? "text-[#285C45]" : "text-[#77786F] hover:text-[#242720]"
                }`}
              >
                {tab}
                {active && (
                  <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#285C45] rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* "Why this matches you" Highlight Card */}
        {match && (
          <Link
            href={`/jobs/${job.id}/match`}
            className="mt-4 p-4 rounded-2xl bg-[#EAF4EB] border border-[#D0E6D2] block hover:bg-[#E2F0E4] transition-colors shadow-2xs"
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#285C45]" />
                <h3 className="text-sm font-bold text-[#242720]">
                  Why this matches you
                </h3>
              </div>
              <div className="flex items-center gap-1">
                <span className="badge-match text-xs font-bold">
                  {match.overallScore}% Match
                </span>
                <ChevronRight className="w-4 h-4 text-[#285C45]" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-xs text-[#2E4A3B]">
              {match.highlights.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  {item.includes("optional") || item.includes("Add") ? (
                    <PlusCircle className="w-3.5 h-3.5 text-[#5F8B73] shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#285C45] shrink-0 mt-0.5" />
                  )}
                  <span className="font-medium leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </Link>
        )}

        {/* Tab Content Panels */}
        <div className="mt-4 pb-6">
          {activeTab === "Overview" && (
            <div className="flex flex-col gap-4 text-xs sm:text-sm leading-relaxed text-[#4A4B42]">
              <div>
                <h4 className="font-bold text-[#242720] text-sm mb-1.5">Role Overview</h4>
                <p>{job.overview}</p>
              </div>

              {job.responsibilities && job.responsibilities.length > 0 && (
                <div>
                  <h4 className="font-bold text-[#242720] text-sm mb-1.5">Key Responsibilities</h4>
                  <ul className="list-disc pl-4 space-y-1 text-xs sm:text-sm">
                    {job.responsibilities.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h4 className="font-bold text-[#242720] text-sm mb-1.5">Required Skills</h4>
                <div className="flex flex-wrap gap-1.5">
                  {job.requiredSkills.map((sk) => (
                    <span
                      key={sk}
                      className="bg-white border border-[#E8E6DF] px-2.5 py-1 rounded-full text-xs font-semibold text-[#285C45]"
                    >
                      {sk}
                    </span>
                  ))}
                </div>
              </div>

              {job.benefits && job.benefits.length > 0 && (
                <div>
                  <h4 className="font-bold text-[#242720] text-sm mb-1.5">Benefits & Perks</h4>
                  <ul className="list-disc pl-4 space-y-1 text-xs sm:text-sm">
                    {job.benefits.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {activeTab === "Requirements" && (
            <div className="flex flex-col gap-3 text-xs sm:text-sm text-[#4A4B42]">
              <h4 className="font-bold text-[#242720] text-sm">Eligibility & Prerequisites</h4>
              <ul className="list-disc pl-4 space-y-2">
                {job.requirements.map((req, i) => (
                  <li key={i}>{req}</li>
                ))}
              </ul>

              <div className="mt-2 p-3 bg-white border border-[#EAE7DF] rounded-xl">
                <span className="text-[11px] font-bold uppercase text-[#77786F] block mb-1">
                  Minimum Degree Requirement
                </span>
                <p className="font-semibold text-[#242720] text-xs">
                  {job.educationRequirement}
                </p>
              </div>
            </div>
          )}

          {activeTab === "About" && (
            <div className="text-xs sm:text-sm leading-relaxed text-[#4A4B42] space-y-3">
              <h4 className="font-bold text-[#242720] text-sm">About {job.company}</h4>
              <p>
                {job.company} is a leading global technology company building innovative tools,
                platforms, and AI-driven infrastructure that connect billions of users worldwide.
              </p>
              <div className="p-3 bg-white border border-[#EAE7DF] rounded-xl text-xs space-y-1">
                <p><strong>Department:</strong> {job.department}</p>
                <p><strong>Work Model:</strong> {job.workArrangement} ({job.location})</p>
                <p><strong>Recruiter Verification:</strong> Verified Employer Partner on Avsar</p>
              </div>
            </div>
          )}

          {activeTab === "Reviews" && (
            <div className="text-xs text-[#55564F] space-y-3">
              <div className="p-3 bg-white border border-[#EAE7DF] rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[#242720]">Former Intern Review</span>
                  <span className="text-amber-500 font-bold">★ 4.9 / 5</span>
                </div>
                <p className="text-xs text-[#55564F]">
                  &ldquo;Incredible mentorship, high ownership of production code, and a very supportive culture for young engineers.&rdquo;
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#ECEAE3] max-w-md mx-auto px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={handleToggleSave}
          className="flex-1 max-w-[120px] bg-white border border-[#DEDCD4] hover:bg-[#FAF9F5] text-[#242720] font-bold py-3.5 px-4 rounded-full flex items-center justify-center gap-2 text-xs sm:text-sm transition-all"
        >
          <Bookmark className={`w-4 h-4 ${isSaved ? "fill-[#285C45] text-[#285C45]" : ""}`} />
          <span>{isSaved ? "Saved" : "Save"}</span>
        </button>

        <Link
          href={`/jobs/${job.id}/apply`}
          className="flex-1 bg-[#285C45] hover:bg-[#1E4735] text-white font-bold py-3.5 px-6 rounded-full flex items-center justify-center gap-2 text-xs sm:text-sm shadow-sm transition-all group"
        >
          <span>Apply Now</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}

export default function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <MobileShell showBottomNav={false} activeScreenNumber={5}>
      <Suspense fallback={<div className="p-8 text-center text-xs">Loading job details...</div>}>
        <JobDetailContent params={params} />
      </Suspense>
    </MobileShell>
  );
}
