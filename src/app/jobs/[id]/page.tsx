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
  AlertTriangle,
  HelpCircle,
  ExternalLink,
  ArrowRight,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Clock,
  X,
  Check,
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
  const [showExternalModal, setShowExternalModal] = useState(false);
  const [showCopiedToast, setShowCopiedToast] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && showExternalModal) {
        setShowExternalModal(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showExternalModal]);

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
    if (typeof navigator !== "undefined" && navigator.share && job) {
      navigator.share({
        title: `${job.title} at ${job.company}`,
        text: `Check out this opportunity on Avsar: ${job.title}`,
        url: window.location.href,
      }).catch(() => {});
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setShowCopiedToast(true);
      setTimeout(() => setShowCopiedToast(false), 2500);
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
    <div className="flex-1 flex flex-col pb-24 bg-[#F8F6F1] relative">
      {/* Toast Alert */}
      {showCopiedToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#242720] text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2"
        >
          <Check className="w-4 h-4 text-[#48B37C]" aria-hidden="true" />
          <span>Opportunity link copied to clipboard!</span>
        </div>
      )}

      {/* Top Hero Image and Navigation */}
      <div className="relative w-full h-48 sm:h-56 bg-[#285C45]">
        <Image
          src={job.heroImage || "/images/modern-office.jpg"}
          alt={job.company}
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-85"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/30" />

        {/* Top Floating App Bar */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-11 h-11 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-[#242720] hover:bg-white shadow-sm transition-all"
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5px]" aria-hidden="true" />
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="w-11 h-11 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-[#242720] hover:bg-white shadow-sm transition-all"
              aria-label="Share opportunity"
            >
              <Share2 className="w-4 h-4 stroke-[2px]" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleToggleSave}
              className="w-11 h-11 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-[#242720] hover:bg-white shadow-sm transition-all"
              aria-label={isSaved ? "Remove from saved" : "Save opportunity"}
              aria-pressed={isSaved}
            >
              <Bookmark className={`w-4 h-4 stroke-[2px] ${isSaved ? "fill-[#285C45] text-[#285C45]" : ""}`} aria-hidden="true" />
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
          <div className="min-w-0">
            <span className="text-xs font-bold text-[#77786F] block tracking-wide uppercase">
              {job.company}
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#242720] tracking-tight leading-snug">
              {job.title}
            </h1>
          </div>
        </div>

        {/* Verification Status & Link Type Pill Bar */}
        <div className="flex flex-wrap items-center gap-1.5 mt-1 mb-2">
          {job.verificationStatus === "VERIFIED" && (
            <span className="inline-flex items-center gap-1 bg-[#EBF3ED] text-[#285C45] px-2.5 py-1 rounded-full text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Verified Listing
            </span>
          )}
          {job.verificationStatus === "PARTIALLY_VERIFIED" && (
            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              Partially Verified
            </span>
          )}
          {job.verificationStatus === "UNVERIFIED" && (
            <span className="inline-flex items-center gap-1 bg-[#EFECE5] text-[#55564F] px-2.5 py-1 rounded-full text-xs font-medium">
              <HelpCircle className="w-3.5 h-3.5" />
              Community Alert
            </span>
          )}
          {job.verificationStatus === "DISCREPANCY" && (
            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-full text-xs font-bold">
              <AlertTriangle className="w-3.5 h-3.5" />
              Listing Discrepancy
            </span>
          )}
          {job.isPossiblyClosed && (
            <span className="inline-flex items-center gap-1 bg-red-100 text-red-900 border border-red-200 px-2.5 py-1 rounded-full text-xs font-bold">
              <Clock className="w-3.5 h-3.5" />
              Possibly Closed
            </span>
          )}
          {job.applicationLinkType && (
            <span className="bg-white border border-[#EAE7DF] text-[#77786F] px-2.5 py-1 rounded-full text-xs">
              {job.applicationLinkType}
            </span>
          )}
          {job.graduationYears && job.graduationYears.length > 0 && (
            <span className="bg-white border border-[#EAE7DF] text-[#285C45] font-semibold px-2.5 py-1 rounded-full text-xs">
              Batch: {job.graduationYears.join(", ")}
            </span>
          )}
        </div>

        {/* Closed Listing Warning Alert */}
        {job.isPossiblyClosed && (
          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">Notice: Potentially Expired or Closed Role</strong>
              <span>
                {job.verificationNote ||
                  "Source metadata indicates this requisition deadline has passed or applications may have closed on the host portal. Verify vacancy before submitting credentials."}
              </span>
            </div>
          </div>
        )}

        {/* Verification Note (when present and not closed) */}
        {!job.isPossiblyClosed && job.verificationNote && (
          <div className="mb-3 p-2.5 bg-white border border-[#EAE7DF] rounded-xl flex items-start gap-2 text-xs text-[#55564F]">
            <ShieldCheck className="w-4 h-4 text-[#285C45] shrink-0 mt-0.5" />
            <span>{job.verificationNote}</span>
          </div>
        )}

        {/* Location and Arrangement Metadata */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#55564F] mb-3">
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

            {/* Eligibility summary */}
            <p className="text-xs text-[#285C45] font-semibold mb-2">
              {match.eligibility.isEligible ? "✓ Eligible Candidate" : "⚠ Eligibility Check Notice"}: {match.eligibility.reason}
            </p>

            <div className="space-y-1.5">
              {match.highlights.slice(0, 3).map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-[#242720]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#285C45] shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </Link>
        )}

        {/* Tab Content Panels */}
        <div className="mt-4 pb-8">
          {activeTab === "Overview" && (
            <div className="flex flex-col gap-4 text-xs sm:text-sm leading-relaxed text-[#4A4B42]">
              <div>
                <h4 className="font-bold text-[#242720] text-sm mb-1.5">Role Overview</h4>
                <p>{job.overview}</p>
              </div>

              {job.responsibilities && job.responsibilities.length > 0 && (
                <div>
                  <h4 className="font-bold text-[#242720] text-sm mb-1.5">Responsibilities</h4>
                  <ul className="list-disc pl-4 space-y-1 text-xs sm:text-sm">
                    {job.responsibilities.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h4 className="font-bold text-[#242720] text-sm mb-2">Required Skills</h4>
                <div className="flex flex-wrap gap-1.5">
                  {job.requiredSkills.length > 0 ? (
                    job.requiredSkills.map((sk) => (
                      <span
                        key={sk}
                        className="px-3 py-1 bg-white border border-[#E0DED7] rounded-full text-xs font-semibold text-[#242720]"
                      >
                        {sk}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-[#77786F] italic">No mandatory skills listed in original post.</span>
                  )}
                </div>
              </div>

              {job.optionalSkills.length > 0 && (
                <div>
                  <h4 className="font-bold text-[#242720] text-sm mb-2">Preferred / Optional Skills</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {job.optionalSkills.map((sk) => (
                      <span
                        key={sk}
                        className="px-3 py-1 bg-white border border-[#E0DED7] rounded-full text-xs font-medium text-[#55564F]"
                      >
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>
              )}

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

              {job.graduationYears && job.graduationYears.length > 0 && (
                <div className="p-3 bg-white border border-[#EAE7DF] rounded-xl">
                  <span className="text-[11px] font-bold uppercase text-[#77786F] block mb-1">
                    Eligible Graduation Batches
                  </span>
                  <p className="font-semibold text-[#285C45] text-xs">
                    {job.graduationYears.join(", ")}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "About" && (
            <div className="text-xs sm:text-sm leading-relaxed text-[#4A4B42] space-y-3">
              <h4 className="font-bold text-[#242720] text-sm">About {job.company}</h4>
              <p>
                {job.company} opportunities verified through Avsar Career Network.
              </p>
              <div className="p-3 bg-white border border-[#EAE7DF] rounded-xl text-xs space-y-1.5">
                <p><strong>Department / Category:</strong> {job.department}</p>
                <p><strong>Work Model:</strong> {job.workArrangement} ({job.location})</p>
                <p><strong>Source Channel:</strong> {job.sourcePlatform || "Avsar Opportunity Feed"}</p>
                <p><strong>Link Type:</strong> {job.applicationLinkType || "Direct Application"}</p>
                {job.sourceJobId && (
                  <p><strong>Source Job Requisition ID:</strong> {job.sourceJobId}</p>
                )}
              </div>
            </div>
          )}

          {activeTab === "Reviews" && (
            <div className="text-xs text-[#55564F] space-y-3">
              <div className="p-3 bg-white border border-[#EAE7DF] rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[#242720]">Career Network Insights</span>
                  <span className="text-amber-500 font-bold">★ 4.8 / 5</span>
                </div>
                <p className="text-xs text-[#55564F]">
                  &ldquo;Competitive career opportunity with structured evaluation and practical industry experience.&rdquo;
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

        {job.isExternalApplication ? (
          <button
            type="button"
            onClick={() => setShowExternalModal(true)}
            className="flex-1 bg-[#285C45] hover:bg-[#1E4735] text-white font-bold py-3.5 px-6 rounded-full flex items-center justify-center gap-2 text-xs sm:text-sm shadow-sm transition-all group"
          >
            <span>Apply Externally</span>
            <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        ) : (
          <Link
            href={`/jobs/${job.id}/apply`}
            className="flex-1 bg-[#285C45] hover:bg-[#1E4735] text-white font-bold py-3.5 px-6 rounded-full flex items-center justify-center gap-2 text-xs sm:text-sm shadow-sm transition-all group"
          >
            <span>Apply Now</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        )}
      </div>

      {/* External Application Redirection Safeguard Modal */}
      {showExternalModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="external-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setShowExternalModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-xl border border-[#EAE7DF] animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EEE6]">
              <div className="flex items-center gap-2">
                <ExternalLink className="w-5 h-5 text-[#285C45]" aria-hidden="true" />
                <h3 id="external-modal-title" className="font-bold text-base text-[#242720]">
                  External Portal
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowExternalModal(false)}
                aria-label="Close external portal warning"
                className="w-10 h-10 rounded-full flex items-center justify-center text-[#77786F] hover:bg-[#F2EFE9] transition-colors"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="py-4 text-xs text-[#55564F] space-y-3">
              <p>
                You are leaving <strong>Avsar</strong> to complete your application on an external employer portal or referral channel:
              </p>
              <div className="p-3 bg-[#F8F6F1] rounded-xl border border-[#EAE7DF] break-all">
                <p className="font-semibold text-[#242720] mb-0.5">{job.applicationLinkType || "Direct Career Page"}</p>
                <p className="text-[11px] text-[#77786F]">{job.applyUrl}</p>
              </div>
              {job.isPossiblyClosed && (
                <p className="text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  ⚠️ Note: Source records indicate this listing might be closed or expired. Please confirm before submitting personal details.
                </p>
              )}
              <p className="text-[11px] text-[#8F9187]">
                Always safeguard sensitive credentials. Avsar does not store external application passwords.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowExternalModal(false)}
                className="flex-1 py-3 bg-[#F2EFE9] text-[#242720] font-semibold rounded-full text-xs min-h-[44px] hover:bg-[#EAE7DF] transition-colors"
              >
                Cancel
              </button>
              <a
                href={job.applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowExternalModal(false)}
                className="flex-1 py-3 bg-[#285C45] text-white font-bold rounded-full text-xs text-center hover:bg-[#1E4735] flex items-center justify-center gap-1.5 min-h-[44px] transition-colors"
              >
                <span>Continue</span>
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      )}
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
