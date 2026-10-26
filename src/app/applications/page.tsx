"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronRight, FileCheck } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { MobileHeader } from "@/components/navigation/MobileHeader";
import { CompanyLogo } from "@/components/brand/CompanyLogo";
import type { Application, ApplicationStatus } from "@/types";

export default function MyApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [activeTab, setActiveTab] = useState<string>("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadApplications() {
      try {
        const res = await fetch("/api/applications");
        if (res.ok) {
          const data = await res.json();
          setApplications(data.applications || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadApplications();
  }, []);

  const counts = {
    all: applications.length,
    underReview: applications.filter((a) => a.status === "Under Review").length,
    interview: applications.filter((a) => a.status === "Interview").length,
    shortlisted: applications.filter((a) => a.status === "Shortlisted").length,
    rejected: applications.filter((a) => a.status === "Rejected").length,
  };

  const tabs = [
    { id: "All", label: `All (${counts.all})` },
    { id: "Under Review", label: `Under Review (${counts.underReview})` },
    { id: "Interview", label: `Interview (${counts.interview})` },
    { id: "Shortlisted", label: `Shortlisted (${counts.shortlisted})` },
    { id: "Rejected", label: `Rejected (${counts.rejected})` },
  ];

  const filteredApps = applications.filter((app) => {
    if (activeTab === "All") return true;
    return app.status === activeTab;
  });

  const getStatusBadgeClass = (status: ApplicationStatus) => {
    switch (status) {
      case "Under Review":
        return "badge-under-review";
      case "Shortlisted":
        return "badge-shortlisted";
      case "Interview":
        return "badge-interview";
      case "Rejected":
        return "badge-rejected";
      default:
        return "bg-[#F4F1EA] text-[#55564F]";
    }
  };

  return (
    <MobileShell activeScreenNumber={11} appliedCount={applications.length}>
      <div className="flex-1 flex flex-col pb-6 bg-[#F8F6F1]">
        {/* Mobile Header (Hidden on desktop) */}
        <div className="md:hidden">
          <MobileHeader title="My Applications" showBack={true} />
        </div>

        <div className="px-4 pt-2 sm:pt-4 flex flex-col gap-4">
          {/* Desktop Title Banner */}
          <div className="hidden md:flex flex-col gap-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#242720] tracking-tight">
              Application Tracker
            </h1>
            <p className="text-xs sm:text-sm text-[#77786F]">
              Track the real-time review status, reference IDs, and responses for your submitted applications.
            </p>
          </div>

          {/* Status Filter Tabs (Horizontal Scroll) */}
          <div
            className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 select-none"
            role="region"
            aria-label="Application status filters"
          >
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-pressed={active}
                  className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap min-h-[38px] transition-all ${
                    active
                      ? "bg-[#285C45] text-white shadow-xs"
                      : "bg-white border border-[#EAE7DF] text-[#55564F] hover:bg-[#F6F4EE]"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Applications List or Skeletons */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1" aria-busy="true">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="card-surface p-4 bg-white flex items-center justify-between gap-3 min-h-[92px]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl skeleton-shimmer" />
                    <div className="flex flex-col gap-2">
                      <div className="w-32 h-4 rounded-md skeleton-shimmer" />
                      <div className="w-24 h-3 rounded-md skeleton-shimmer" />
                    </div>
                  </div>
                  <div className="w-16 h-6 rounded-md skeleton-shimmer" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
              {filteredApps.map((app) => (
                <div
                  key={app.id}
                  className="card-surface p-4 flex items-center justify-between gap-3 bg-white hover:border-[#D6D3C9] transition-all"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <CompanyLogo
                      name={app.job?.company || "Company"}
                      logoKey={app.job?.companyLogoKey}
                      size="md"
                      className="shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-[#242720] leading-snug truncate">
                          {app.job?.title || "Role"}
                        </h3>
                        {app.referenceNumber && (
                          <span className="text-[10px] text-[#77786F] font-mono bg-[#F2EFE9] px-1.5 py-0.5 rounded shrink-0">
                            {app.referenceNumber}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#77786F] mt-0.5 truncate">
                        {app.job?.company} · {app.appliedDateFormatted}
                      </p>

                      {/* Status Badge */}
                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md inline-block ${getStatusBadgeClass(
                            app.status
                          )}`}
                        >
                          {app.status}
                        </span>
                        {app.resumeName && (
                          <span className="text-[10px] text-[#77786F] truncate max-w-[140px]">
                            📄 {app.resumeName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/jobs/${app.jobId}`}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-[#9E9F96] hover:text-[#242720] hover:bg-[#F4F1EA] transition-colors shrink-0"
                    aria-label={`View details for ${app.job?.title || "application"}`}
                  >
                    <ChevronRight className="w-5 h-5" aria-hidden="true" />
                  </Link>
                </div>
              ))}

              {filteredApps.length === 0 && !loading && (
                <div className="text-center py-12 px-4 card-surface bg-white mt-4 col-span-full">
                  <FileCheck className="w-8 h-8 text-[#9E9F96] mx-auto mb-2" aria-hidden="true" />
                  <p className="text-sm font-semibold text-[#242720]">No applications found</p>
                  <p className="text-xs text-[#77786F] mt-1">
                    You don&apos;t have any applications matching the &quot;{activeTab}&quot; filter.
                  </p>
                  <Link
                    href="/explore"
                    className="inline-flex items-center gap-1.5 mt-4 px-5 py-2.5 bg-[#285C45] hover:bg-[#1E4735] text-white rounded-full text-xs font-semibold min-h-[44px] transition-colors"
                  >
                    Explore Open Opportunities
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </MobileShell>
  );
}
