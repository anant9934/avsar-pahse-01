"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Smartphone, Monitor, ShieldCheck } from "lucide-react";
import { BottomNav } from "@/components/navigation/BottomNav";

interface MobileShellProps {
  children: React.ReactNode;
  showBottomNav?: boolean;
  savedCount?: number;
  appliedCount?: number;
  activeScreenNumber?: number;
  className?: string;
}

export function MobileShell({
  children,
  showBottomNav = true,
  savedCount,
  appliedCount,
  activeScreenNumber,
  className = "",
}: MobileShellProps) {
  const pathname = usePathname();
  const [deviceMode, setDeviceMode] = useState<"phone" | "fluid">("phone");
  const [fetchedAppliedCount, setFetchedAppliedCount] = useState<number | undefined>(undefined);
  const [fetchedSavedCount, setFetchedSavedCount] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (appliedCount !== undefined) return;
    let ignore = false;
    fetch("/api/applications")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!ignore && Array.isArray(data)) setFetchedAppliedCount(data.length);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [appliedCount, pathname]);

  useEffect(() => {
    if (savedCount !== undefined) return;
    let ignore = false;
    fetch("/api/jobs/saved")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!ignore && data && Array.isArray(data.savedJobIds)) {
          setFetchedSavedCount(data.savedJobIds.length);
        }
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [savedCount, pathname]);

  const liveAppliedCount = appliedCount !== undefined ? appliedCount : fetchedAppliedCount;
  const liveSavedCount = savedCount !== undefined ? savedCount : fetchedSavedCount;

  // Screen quick navigation list matching the 13 reference screens
  const screens = [
    { num: 1, label: "Welcome", href: "/welcome" },
    { num: 2, label: "Auth", href: "/auth" },
    { num: 3, label: "Home", href: "/home" },
    { num: 4, label: "Explore", href: "/explore" },
    { num: 5, label: "Job Detail", href: "/jobs/job_google_fe_intern" },
    { num: 6, label: "Match", href: "/jobs/job_google_fe_intern/match" },
    { num: 7, label: "Apply", href: "/jobs/job_google_fe_intern/apply" },
    { num: 8, label: "Resume", href: "/jobs/job_google_fe_intern/apply?step=2" },
    { num: 9, label: "Review", href: "/jobs/job_google_fe_intern/apply?step=4" },
    { num: 10, label: "Success", href: "/applications/success?ref=AVS-2025-0412-8937&job=job_google_fe_intern" },
    { num: 11, label: "Applied", href: "/applications" },
    { num: 12, label: "Profile", href: "/profile" },
    { num: 13, label: "Admin", href: "/admin" },
  ];

  return (
    <div className="min-h-screen bg-[#F8F6F1] md:bg-[#EDEAE3] flex flex-col items-center w-full overflow-x-hidden">
      {/* Skip to main content link for keyboard & screen reader accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#285C45] focus:text-white focus:rounded-full focus:shadow-lg focus:font-semibold focus:text-xs"
      >
        Skip to main content
      </a>

      {/* Top Reviewer Nav & Device Mode Switcher (Visible on desktop/tablets only) */}
      <div className="hidden md:flex w-full bg-[#242720] text-white text-xs px-4 py-2 items-center justify-between gap-2 shadow-sm z-50">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#EBF3E9] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#48B37C]" />
            AVSAR UI Suite
          </span>
          <span className="text-white/50">|</span>
          {/* Quick jump pills */}
          <div className="hidden lg:flex items-center gap-1 overflow-x-auto max-w-2xl py-0.5">
            {screens.map((s) => {
              const active = activeScreenNumber === s.num || pathname === s.href;
              return (
                <Link
                  key={s.num}
                  href={s.href}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    active
                      ? "bg-[#285C45] text-white font-bold"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                  title={`Screen ${s.num}: ${s.label}`}
                >
                  {s.num}. {s.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Toggle between phone frame and full responsive view */}
          <div className="flex items-center bg-white/10 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setDeviceMode("phone")}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                deviceMode === "phone"
                  ? "bg-[#285C45] text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Mobile Frame
            </button>
            <button
              type="button"
              onClick={() => setDeviceMode("fluid")}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                deviceMode === "fluid"
                  ? "bg-[#285C45] text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              Responsive
            </button>
          </div>

          <Link
            href="/admin"
            className="flex items-center gap-1 bg-[#285C45] hover:bg-[#1E4735] text-white px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Admin (Screen 13)
          </Link>
        </div>
      </div>

      {/* Main Container */}
      <div
        className={`w-full transition-all duration-200 ${
          deviceMode === "phone"
            ? "max-w-full md:max-w-[420px] my-0 md:my-6 md:rounded-[36px] md:shadow-2xl md:ring-1 md:ring-black/10 overflow-hidden"
            : "max-w-4xl my-0 md:my-6 md:rounded-2xl shadow-sm"
        } bg-[#F8F6F1] flex flex-col min-h-screen relative`}
      >
        {/* iOS style status bar indicator on desktop mobile frame */}
        <div className="hidden md:flex items-center justify-between px-6 pt-3 pb-1 text-[11px] font-bold text-[#242720] select-none">
          <span>9:41</span>
          <div className="w-20 h-4 bg-black/10 rounded-full mx-auto" />
          <div className="flex items-center gap-1.5 text-xs">
            <span>5G</span>
            <span className="w-4 h-2.5 border border-[#242720] rounded-sm relative flex items-center p-0.5">
              <span className="w-full h-full bg-[#242720] rounded-2xs" />
            </span>
          </div>
        </div>

        {/* Page Content */}
        <main id="main-content" tabIndex={-1} className={`flex-1 flex flex-col outline-hidden ${showBottomNav ? "pb-16" : ""} ${className}`}>
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        {showBottomNav && (
          <BottomNav
            savedCount={liveSavedCount}
            appliedCount={liveAppliedCount}
            fluid={deviceMode === "fluid"}
          />
        )}
      </div>
    </div>
  );
}
