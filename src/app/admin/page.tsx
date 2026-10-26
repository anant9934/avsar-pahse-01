"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard,
  Briefcase,
  FileCheck2,
  Users,
  Building2,
  BarChart3,
  Settings,
  Search,
  Bell,
  ChevronDown,
  ArrowUpRight,
  Plus,
  ArrowLeft,
  X,
  CheckCircle2,
  Lock,
  Unlock,
  FileText,
  Upload,
} from "lucide-react";
import { AvsarLogo } from "@/components/brand/AvsarLogo";
import type { AdminMetrics } from "@/types";

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [timeRange, setTimeRange] = useState("Last 6 months");
  const [showAddJobModal, setShowAddJobModal] = useState(false);
  const [newJobForm, setNewJobForm] = useState({
    title: "",
    company: "",
    location: "Bengaluru",
    workArrangement: "Hybrid",
    employmentType: "Internship",
    compensation: "₹40,000/month",
    deadline: "30 May 2025",
    requiredSkills: "React, Next.js, TypeScript",
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [adminPasskey, setAdminPasskey] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");
  const [importResults, setImportResults] = useState<{
    success?: boolean;
    importedCount?: number;
    duplicatesSkipped?: number;
    errorsCount?: number;
    error?: string;
  } | null>(null);

  useEffect(() => {
    async function loadMetrics() {
      try {
        const authRes = await fetch("/api/auth/admin");
        const authData = await authRes.json();
        setIsAuthorized(authData.isAdmin);

        if (authData.isAdmin) {
          const res = await fetch("/api/admin/metrics");
          if (res.ok) {
            const data = await res.json();
            setMetrics(data.metrics);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadMetrics();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowAddJobModal(false);
        setShowImportModal(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleAdminLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!adminPasskey.trim()) {
      setToastMessage("Please enter the administrator secret key.");
      return;
    }
    try {
      const res = await fetch("/api/auth/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: adminPasskey.trim() }),
      });
      if (res.ok) {
        setIsAuthorized(true);
        setToastMessage("Admin console unlocked successfully!");
        const mRes = await fetch("/api/admin/metrics");
        if (mRes.ok) {
          const mData = await mRes.json();
          setMetrics(mData.metrics);
        }
      } else {
        const data = await res.json();
        setToastMessage(`Authorization failed: ${data.error || "Invalid secret"}`);
      }
    } catch {
      setToastMessage("Failed to authenticate as admin");
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newJobForm.title,
          company: newJobForm.company,
          slug: newJobForm.title.toLowerCase().replace(/[^a-z0-9]/g, "-"),
          companyLogoKey: "google",
          location: newJobForm.location,
          workArrangement: newJobForm.workArrangement,
          employmentType: newJobForm.employmentType,
          compensation: newJobForm.compensation,
          deadline: newJobForm.deadline,
          department: "Engineering",
          overview: `Opportunity for ${newJobForm.title} at ${newJobForm.company}.`,
          requirements: ["Strong foundational computer science skills", "Hands-on framework experience"],
          benefits: ["Competitive compensation", "Mentorship from staff engineers"],
          requiredSkills: newJobForm.requiredSkills.split(",").map((s) => s.trim()),
          optionalSkills: ["Git", "Docker"],
          minExperienceMonths: 0,
          educationRequirement: "Pursuing Bachelor's degree or equivalent",
        }),
      });

      const resData = await res.json();
      if (res.ok) {
        setToastMessage(`Job listing "${newJobForm.title}" created successfully!`);
        setShowAddJobModal(false);
        const mRes = await fetch("/api/admin/metrics");
        if (mRes.ok) {
          const mData = await mRes.json();
          setMetrics(mData.metrics);
        }
      } else {
        setToastMessage(`Job creation rejected: ${resData.error || "Validation error"}`);
      }
    } catch (err) {
      console.error(err);
      setToastMessage("Network error creating job");
    }
  };

  const handleImportJson = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportResults(null);
    try {
      let parsedPayload: unknown;
      try {
        parsedPayload = JSON.parse(importJsonText);
      } catch {
        setImportResults({ error: "Invalid JSON format: Could not parse text." });
        return;
      }

      const res = await fetch("/api/admin/import-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedPayload),
      });

      const data = await res.json();
      if (res.ok) {
        setImportResults(data);
        setToastMessage(`Import completed: ${data.importedCount} added, ${data.duplicatesSkipped} duplicates skipped.`);
        const mRes = await fetch("/api/admin/metrics");
        if (mRes.ok) {
          const mData = await mRes.json();
          setMetrics(mData.metrics);
        }
      } else {
        setImportResults({ error: data.error || "Import failed" });
      }
    } catch {
      setImportResults({ error: "Network error during JSON import." });
    }
  };

  const navItems = [
    { label: "Dashboard", icon: LayoutDashboard },
    { label: "Jobs", icon: Briefcase },
    { label: "Applications", icon: FileCheck2 },
    { label: "Candidates", icon: Users },
    { label: "Employers", icon: Building2 },
    { label: "Analytics", icon: BarChart3 },
    { label: "Settings", icon: Settings },
  ];

  // SVG spline curve generation for applications chart
  const chartData = metrics?.monthlyOverview || [
    { month: "Jan", applications: 280 },
    { month: "Feb", applications: 410 },
    { month: "Mar", applications: 390 },
    { month: "Apr", applications: 620 },
    { month: "May", applications: 510 },
    { month: "Jun", applications: 840 },
  ];

  const maxVal = 1000;
  const svgWidth = 600;
  const svgHeight = 160;
  const points = chartData.map((d, i) => {
    const x = (i / (chartData.length - 1)) * (svgWidth - 40) + 20;
    const y = svgHeight - (d.applications / maxVal) * (svgHeight - 30) - 15;
    return { x, y, ...d };
  });

  const pathD = points.reduce((acc, p, i, a) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = a[i - 1];
    const cp1x = prev.x + (p.x - prev.x) / 2;
    const cp1y = prev.y;
    const cp2x = prev.x + (p.x - prev.x) / 2;
    const cp2y = p.y;
    return `${acc} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p.x} ${p.y}`;
  }, "");

  const areaD = `${pathD} L ${points[points.length - 1].x} ${svgHeight} L ${points[0].x} ${svgHeight} Z`;

  if (isAuthorized === false) {
    return (
      <div className="min-h-screen bg-[#F8F6F1] flex items-center justify-center p-6 text-[#242720]">
        <div className="card-surface p-8 bg-white max-w-md w-full text-center shadow-xl">
          <div className="w-12 h-12 rounded-full bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-[#242720] mb-1">Administrator Authorization Required</h2>
          <p className="text-xs text-[#77786F] mb-6">
            This dashboard is restricted to authorized platform administrators. Please enter the master passkey or unlock developer admin access.
          </p>
          <form onSubmit={handleAdminLogin} className="space-y-3">
            <input
              type="password"
              placeholder="Admin passkey (default: avsar_admin_secret_2025)"
              value={adminPasskey}
              onChange={(e) => setAdminPasskey(e.target.value)}
              className="w-full h-10 px-3 bg-[#FAF9F5] border border-[#EAE7DF] rounded-xl text-xs"
            />
            <button
              type="submit"
              className="w-full h-10 bg-[#285C45] hover:bg-[#1E4735] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2"
            >
              <Unlock className="w-4 h-4" /> Unlock Console
            </button>
          </form>
          <div className="mt-4 pt-4 border-t border-[#ECEAE3] flex justify-between items-center text-xs">
            <Link href="/home" className="text-[#77786F] hover:text-[#285C45]">← Return to Candidate View</Link>
            <button
              type="button"
              onClick={() => handleAdminLogin()}
              className="text-[#285C45] font-bold hover:underline"
            >
              Fast Dev Unlock
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F6F1] flex flex-col md:flex-row text-[#242720]">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-[#EAF4EB] border border-[#285C45]/30 text-[#285C45] px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 hover:opacity-75">
            ✕
          </button>
        </div>
      )}

      {/* Desktop Left Sidebar (Screen 13) */}
      <aside className="w-full md:w-64 bg-white border-r border-[#ECEAE3] flex flex-col justify-between shrink-0">
        <div>
          {/* Brand Logo */}
          <div className="p-6 border-b border-[#ECEAE3]/60 flex items-center justify-between">
            <AvsarLogo size="md" showTagline={false} />
            <Link
              href="/home"
              className="text-[11px] font-semibold text-[#285C45] hover:underline flex items-center gap-1"
              title="Switch to Mobile Candidate View"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Mobile
            </Link>
          </div>

          {/* Nav List */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.label;

              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setActiveNav(item.label)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? "bg-[#285C45] text-white shadow-xs"
                      : "text-[#55564F] hover:bg-[#FAF9F5] hover:text-[#242720]"
                  }`}
                >
                  <Icon className="w-4 h-4 stroke-[2px]" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User profile section at bottom of sidebar */}
        <div className="p-4 border-t border-[#ECEAE3] flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-full overflow-hidden border border-[#E8E6DF] shrink-0">
            <Image
              src="/images/avatar-rohan.jpg"
              alt="Admin User"
              fill
              className="object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold text-[#242720] truncate block">
              Admin Console
            </span>
            <span className="text-[11px] text-[#77786F] truncate block">
              Super Administrator
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-16 px-6 bg-white border-b border-[#ECEAE3] flex items-center justify-between gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#77786F] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search jobs, candidates, employers..."
              className="w-full h-9 pl-9 pr-4 bg-[#FAF9F5] border border-[#ECEAE3] rounded-xl text-xs text-[#242720] placeholder-[#9E9F96] focus:outline-none focus:border-[#285C45]"
            />
          </div>

          {/* Right actions: Notifications & Admin Profile */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="w-9 h-9 rounded-full hover:bg-[#FAF9F5] flex items-center justify-center text-[#55564F] transition-colors relative"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#285C45]" />
            </button>

            <div className="flex items-center gap-2 pl-2 border-l border-[#ECEAE3] select-none">
              <div className="relative w-8 h-8 rounded-full overflow-hidden border border-[#ECEAE3]">
                <Image
                  src="/images/avatar-rohan.jpg"
                  alt="Admin"
                  fill
                  className="object-cover"
                />
              </div>
              <span className="text-xs font-bold text-[#242720]">Admin</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#77786F]" />
            </div>
          </div>
        </header>

        {/* Dashboard Body */}
        <main className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* Title and Action */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-extrabold text-[#242720] tracking-tight">
              Dashboard
            </h1>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#285C45] text-[#285C45] hover:bg-[#F2F7F3] rounded-full text-xs font-bold shadow-2xs transition-all"
              >
                <FileText className="w-4 h-4" />
                <span>Import JSON</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAddJobModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#285C45] hover:bg-[#1E4735] text-white rounded-full text-xs font-bold shadow-xs transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Post New Job</span>
              </button>
            </div>
          </div>

          {/* Metric KPI Cards (4 Across matching Screen 13) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Jobs */}
            <div className="card-surface p-5 bg-white">
              <span className="text-xs font-semibold text-[#77786F] block">Total Jobs</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-extrabold text-[#242720]">
                  {metrics?.totalJobs || 256}
                </span>
                <span className="text-[11px] font-bold text-[#285C45] bg-[#EAF4EB] px-2 py-0.5 rounded-full flex items-center gap-0.5">
                  <ArrowUpRight className="w-3 h-3" />
                  +{metrics?.totalJobsGrowth || 12}%
                </span>
              </div>
            </div>

            {/* Card 2: Applications */}
            <div className="card-surface p-5 bg-white">
              <span className="text-xs font-semibold text-[#77786F] block">Applications</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-extrabold text-[#242720]">
                  {(metrics?.applicationsCount || 4320).toLocaleString()}
                </span>
                <span className="text-[11px] font-bold text-[#285C45] bg-[#EAF4EB] px-2 py-0.5 rounded-full flex items-center gap-0.5">
                  <ArrowUpRight className="w-3 h-3" />
                  +{metrics?.applicationsGrowth || 8}%
                </span>
              </div>
            </div>

            {/* Card 3: Active Candidates */}
            <div className="card-surface p-5 bg-white">
              <span className="text-xs font-semibold text-[#77786F] block">Active Candidates</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-extrabold text-[#242720]">
                  {(metrics?.activeCandidates || 1210).toLocaleString()}
                </span>
                <span className="text-[11px] font-bold text-[#285C45] bg-[#EAF4EB] px-2 py-0.5 rounded-full flex items-center gap-0.5">
                  <ArrowUpRight className="w-3 h-3" />
                  +{metrics?.activeCandidatesGrowth || 18}%
                </span>
              </div>
            </div>

            {/* Card 4: Employers */}
            <div className="card-surface p-5 bg-white">
              <span className="text-xs font-semibold text-[#77786F] block">Employers</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-extrabold text-[#242720]">
                  {metrics?.employersCount || 86}
                </span>
                <span className="text-[11px] font-bold text-[#285C45] bg-[#EAF4EB] px-2 py-0.5 rounded-full flex items-center gap-0.5">
                  <ArrowUpRight className="w-3 h-3" />
                  +{metrics?.employersGrowth || 5}%
                </span>
              </div>
            </div>
          </div>

          {/* Applications Overview Area Chart (Screen 13) */}
          <div className="card-surface p-5 bg-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#242720]">Applications Overview</h3>
                <span className="text-[11px] text-[#77786F]">Monthly application conversion trend</span>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setTimeRange(timeRange === "Last 6 months" ? "Last 12 months" : "Last 6 months")}
                  className="px-3 py-1 bg-[#FAF9F5] border border-[#ECEAE3] rounded-lg font-bold text-[#242720] flex items-center gap-1 hover:bg-[#F2EFE9] transition-colors"
                >
                  <span>{timeRange}</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* SVG Area & Line Chart */}
            <div className="relative w-full h-48">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-full overflow-visible"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#285C45" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#285C45" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal reference grid lines */}
                {[0, 250, 500, 750, 1000].map((v) => {
                  const y = svgHeight - (v / maxVal) * (svgHeight - 30) - 15;
                  return (
                    <g key={v}>
                      <line
                        x1="20"
                        y1={y}
                        x2={svgWidth - 20}
                        y2={y}
                        stroke="#F0EEE8"
                        strokeDasharray="4 4"
                      />
                      <text x="5" y={y + 3} fill="#9E9F96" fontSize="9" textAnchor="start">
                        {v}
                      </text>
                    </g>
                  );
                })}

                {/* Gradient filled area */}
                <path d={areaD} fill="url(#chartGradient)" />

                {/* Smooth stroke line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="#285C45"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* Data point dots */}
                {points.map((p, idx) => (
                  <circle
                    key={idx}
                    cx={p.x}
                    cy={p.y}
                    r="4"
                    fill="#FFFFFF"
                    stroke="#285C45"
                    strokeWidth="2.5"
                  />
                ))}
              </svg>

              {/* X-axis labels */}
              <div className="flex justify-between px-6 pt-2 text-[11px] font-semibold text-[#77786F]">
                {chartData.map((d) => (
                  <span key={d.month}>{d.month}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Applications Table (Screen 13) */}
          <div className="card-surface bg-white overflow-hidden">
            <div className="p-4 border-b border-[#ECEAE3] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#242720]">Recent Applications</h3>
              <span className="text-xs font-semibold text-[#285C45] hover:underline cursor-pointer">
                View All
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#ECEAE3] bg-[#FAF9F5] text-[#77786F] font-bold">
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Job Title</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Applied On</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECEAE3]">
                  {metrics?.recentApplications.map((app) => (
                    <tr key={app.id} className="hover:bg-[#FAF9F6] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-[#EAF4EB] text-[#285C45] font-bold text-xs flex items-center justify-center shrink-0">
                            {app.candidateName[0]}
                          </div>
                          <div>
                            <span className="font-bold text-[#242720] block">
                              {app.candidateName}
                            </span>
                            <span className="text-[10px] text-[#77786F]">
                              {app.candidateEmail}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-[#242720] block">
                          {app.jobTitle}
                        </span>
                        <span className="text-[10px] text-[#77786F]">
                          {app.company}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold inline-block ${
                            app.status === "Shortlisted"
                              ? "bg-[#EAF4EB] text-[#285C45] border border-[#D0E6D2]"
                              : app.status === "Interview"
                              ? "bg-[#EDF4FE] text-[#2A67C4] border border-[#CFE2FC]"
                              : "bg-[#FEF7EA] text-[#B27715] border border-[#FDE3B2]"
                          }`}
                        >
                          {app.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#77786F] font-medium">
                        {app.appliedOn}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Post New Job Modal */}
      {showAddJobModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="post-opp-title"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowAddJobModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card-surface p-6 bg-white w-full max-w-lg shadow-2xl relative"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#ECEAE3]">
              <h3 id="post-opp-title" className="text-base font-bold text-[#242720]">
                Post New Opportunity
              </h3>
              <button
                type="button"
                onClick={() => setShowAddJobModal(false)}
                aria-label="Close dialog"
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#77786F] hover:text-black hover:bg-[#F2EFE9] transition-colors"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#242720] block mb-1">Job Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AI Research Intern"
                  value={newJobForm.title}
                  onChange={(e) => setNewJobForm({ ...newJobForm, title: e.target.value })}
                  className="w-full h-9 px-3 bg-[#FAF9F5] border border-[#EAE7DF] rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#242720] block mb-1">Company</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Google"
                    value={newJobForm.company}
                    onChange={(e) => setNewJobForm({ ...newJobForm, company: e.target.value })}
                    className="w-full h-9 px-3 bg-[#FAF9F5] border border-[#EAE7DF] rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#242720] block mb-1">Location</label>
                  <input
                    type="text"
                    value={newJobForm.location}
                    onChange={(e) => setNewJobForm({ ...newJobForm, location: e.target.value })}
                    className="w-full h-9 px-3 bg-[#FAF9F5] border border-[#EAE7DF] rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#242720] block mb-1">Compensation</label>
                  <input
                    type="text"
                    value={newJobForm.compensation}
                    onChange={(e) => setNewJobForm({ ...newJobForm, compensation: e.target.value })}
                    className="w-full h-9 px-3 bg-[#FAF9F5] border border-[#EAE7DF] rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#242720] block mb-1">Deadline</label>
                  <input
                    type="text"
                    value={newJobForm.deadline}
                    onChange={(e) => setNewJobForm({ ...newJobForm, deadline: e.target.value })}
                    className="w-full h-9 px-3 bg-[#FAF9F5] border border-[#EAE7DF] rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-[#242720] block mb-1">Required Skills</label>
                <input
                  type="text"
                  placeholder="React, TypeScript, Python"
                  value={newJobForm.requiredSkills}
                  onChange={(e) => setNewJobForm({ ...newJobForm, requiredSkills: e.target.value })}
                  className="w-full h-9 px-3 bg-[#FAF9F5] border border-[#EAE7DF] rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#ECEAE3]">
                <button
                  type="button"
                  onClick={() => setShowAddJobModal(false)}
                  className="px-4 py-2 border border-[#EAE7DF] rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#285C45] hover:bg-[#1E4735] text-white rounded-lg font-bold"
                >
                  Publish Opportunity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Jobs JSON Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="card-surface p-6 bg-white w-full max-w-xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#ECEAE3]">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#285C45]" />
                <h3 className="text-base font-bold text-[#242720]">Import Opportunities from JSON</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportResults(null);
                }}
                className="text-[#77786F] hover:text-black"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#77786F] mt-3">
              Paste a JSON array of job listings (supports standard Avsar schema or <code className="bg-[#FAF9F5] px-1 py-0.5 rounded text-[#242720]">jobs.json</code> schema). Duplicate jobs are automatically detected and skipped.
            </p>

            <form onSubmit={handleImportJson} className="mt-4 space-y-3">
              <div className="relative">
                <textarea
                  rows={8}
                  required
                  placeholder='[\n  {\n    "company": "Siemens",\n    "role": "Trainee",\n    "location": ["Bengaluru"],\n    "required_skills": ["Attention to detail", "Data accuracy"]\n  }\n]'
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  className="w-full p-3 font-mono text-[11px] bg-[#FAF9F5] border border-[#EAE7DF] rounded-xl text-[#242720] focus:outline-none focus:border-[#285C45]"
                />
              </div>

              {/* Import Feedback / Errors */}
              {importResults && (
                <div
                  className={`p-3 rounded-xl text-xs ${
                    importResults.error
                      ? "bg-[#FEF2F2] border border-[#FCA5A5] text-[#B91C1C]"
                      : "bg-[#EAF4EB] border border-[#A7D7B0] text-[#285C45]"
                  }`}
                >
                  {importResults.error ? (
                    <span className="font-semibold">{importResults.error}</span>
                  ) : (
                    <div>
                      <p className="font-bold">✓ Import Completed</p>
                      <p className="mt-1">
                        • <strong>{importResults.importedCount}</strong> new jobs added
                      </p>
                      <p>
                        • <strong>{importResults.duplicatesSkipped}</strong> duplicates skipped
                      </p>
                      {importResults.errorsCount && importResults.errorsCount > 0 ? (
                        <p className="text-amber-800 mt-1">
                          • {importResults.errorsCount} items skipped due to validation errors
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-[#ECEAE3]">
                <button
                  type="button"
                  onClick={() => {
                    setImportJsonText(
                      JSON.stringify(
                        [
                          {
                            company: "Amazon Web Services",
                            role: "Cloud Support Associate",
                            location: ["Bengaluru, India"],
                            work_model: "On-site",
                            required_skills: ["Linux", "Networking", "Python", "Cloud Fundamentals"],
                            description: "Troubleshoot complex cloud architectures and automate cloud infrastructure.",
                            salary: "₹65,000/month",
                            deadline: "15 Jun 2025"
                          }
                        ],
                        null,
                        2
                      )
                    );
                  }}
                  className="text-xs text-[#285C45] hover:underline font-semibold"
                >
                  Insert Sample Job
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowImportModal(false);
                      setImportResults(null);
                    }}
                    className="px-4 py-2 border border-[#EAE7DF] rounded-lg text-xs font-semibold"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#285C45] hover:bg-[#1E4735] text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Run Import</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
