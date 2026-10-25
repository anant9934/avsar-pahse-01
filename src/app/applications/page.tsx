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
        {/* Header */}
        <MobileHeader title="My Applications" showBack={true} />

        <div className="px-4 pt-3 flex flex-col gap-3.5">
          {/* Status Filter Tabs (Horizontal Scroll) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 select-none">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
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

          {/* Applications List */}
          <div className="flex flex-col gap-3 mt-1">
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
                    <h3 className="text-sm font-bold text-[#242720] leading-snug truncate">
                      {app.job?.title || "Role"}
                    </h3>
                    <p className="text-xs text-[#77786F] mt-0.5 truncate">
                      {app.job?.company} · {app.appliedDateFormatted}
                    </p>

                    {/* Status Badge */}
                    <div className="mt-2">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md inline-block ${getStatusBadgeClass(
                          app.status
                        )}`}
                      >
                        {app.status}
                      </span>
                    </div>
                  </div>
                </div>

                <Link
                  href={`/jobs/${app.jobId}`}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#9E9F96] hover:text-[#242720] hover:bg-[#F4F1EA] transition-colors shrink-0"
                  aria-label="View application detail"
                >
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </div>
            ))}

            {filteredApps.length === 0 && !loading && (
              <div className="text-center py-12 px-4 card-surface bg-white mt-4">
                <FileCheck className="w-8 h-8 text-[#9E9F96] mx-auto mb-2" />
                <p className="text-sm font-semibold text-[#242720]">No applications found</p>
                <p className="text-xs text-[#77786F] mt-1">
                  You don&apos;t have any applications matching the &quot;{activeTab}&quot; filter.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </MobileShell>
  );
}
