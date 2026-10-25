"use client";

import React, { useState, useEffect, use, Suspense } from "react";
import Link from "next/link";
import {
  Code,
  Briefcase,
  GraduationCap,
  MapPin,
  CheckCircle2,
  Info,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { MobileHeader } from "@/components/navigation/MobileHeader";
import { CircularProgress } from "@/components/ui/CircularProgress";
import type { Job, MatchAnalysis } from "@/types";

function MatchExplanationContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [job, setJob] = useState<Job | null>(null);
  const [match, setMatch] = useState<MatchAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMatch() {
      try {
        const res = await fetch(`/api/jobs/${id}`);
        if (!res.ok) throw new Error("Job not found");
        const data = await res.json();
        setJob(data.job);
        setMatch(data.match);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadMatch();
  }, [id]);

  if (loading || !job || !match) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-sm text-[#77786F]">
        Analyzing candidate match fit...
      </div>
    );
  }

  const breakdownItems = [
    {
      label: "Skills Match",
      value: match.breakdown.skillsMatch,
      icon: Code,
    },
    {
      label: "Experience Match",
      value: match.breakdown.experienceMatch,
      icon: Briefcase,
    },
    {
      label: "Education Match",
      value: match.breakdown.educationMatch,
      icon: GraduationCap,
    },
    {
      label: "Location Match",
      value: match.breakdown.locationMatch,
      icon: MapPin,
    },
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#F8F6F1] pb-24">
      {/* Header */}
      <MobileHeader title="Your Match Analysis" showBack={true} />

      <div className="px-5 pt-4 flex flex-col gap-5">
        {/* Main Visual Score Gauge */}
        <div className="card-surface p-6 flex flex-col items-center justify-center text-center bg-white">
          <div className="my-2">
            <CircularProgress
              value={match.overallScore}
              size={140}
              strokeWidth={10}
              color="#285C45"
              trackColor="#EAF2E8"
              sublabel={match.ratingLabel}
            />
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-xs text-[#285C45] bg-[#EAF4EB] px-3 py-1 rounded-full font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{match.eligibility.isEligible ? "Fully Eligible to Apply" : "Prerequisites Met"}</span>
          </div>

          <p className="text-xs text-[#77786F] mt-2 max-w-xs leading-relaxed">
            Calculated using Avsar&apos;s deterministic multi-factor fit model against your verified AI Tathastu profile.
          </p>
        </div>

        {/* Match Breakdown Section */}
        <div className="card-surface p-4 bg-white">
          <h3 className="text-sm font-bold text-[#242720] mb-3.5 flex items-center gap-2">
            <span>Match Breakdown</span>
          </h3>

          <div className="flex flex-col gap-3.5">
            {breakdownItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-[#44463E] font-medium">
                      <div className="w-6 h-6 rounded-lg bg-[#EAF4EB] text-[#285C45] flex items-center justify-center">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span>{item.label}</span>
                    </div>
                    <span className="font-bold text-[#242720]">{item.value}%</span>
                  </div>

                  {/* Horizontal Progress Bar */}
                  <div className="w-full h-2 bg-[#EAF2E8] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#285C45] rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Matching Skills */}
        <div className="card-surface p-4 bg-white">
          <h3 className="text-sm font-bold text-[#242720] mb-2 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#285C45]" />
            <span>Top Matching Skills</span>
          </h3>
          <p className="text-xs text-[#77786F] mb-3">
            Skills verified in your profile that directly match this job&apos;s core requirements.
          </p>

          <div className="flex flex-wrap gap-2">
            {match.topMatchingSkills.map((skill) => (
              <span
                key={skill}
                className="bg-[#FAF9F5] border border-[#E0DED5] px-3 py-1 rounded-full text-xs font-semibold text-[#242720] flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#285C45]" />
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* Missing / Optional Qualifications */}
        {match.missingSkills.length > 0 && (
          <div className="card-surface p-4 bg-white">
            <h3 className="text-sm font-bold text-[#242720] mb-2 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-[#77786F]" />
              <span>Missing / Optional</span>
            </h3>
            <p className="text-xs text-[#77786F] mb-3">
              Non-blocking skills. Adding evidence for these can boost your interview priority.
            </p>

            <div className="flex flex-wrap gap-2">
              {match.missingSkills.map((skill) => (
                <span
                  key={skill}
                  className="bg-[#FAF9F6] border border-dashed border-[#CFCBC0] px-3 py-1 rounded-full text-xs font-medium text-[#77786F]"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom CTA to Apply */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#ECEAE3] max-w-md mx-auto px-4 py-3">
        <Link
          href={`/jobs/${job.id}/apply`}
          className="w-full bg-[#285C45] hover:bg-[#1E4735] text-white font-bold py-3.5 px-6 rounded-full flex items-center justify-center gap-2 text-sm shadow-sm transition-all group"
        >
          <span>Proceed to Application</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}

export default function MatchExplanationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <MobileShell showBottomNav={false} activeScreenNumber={6}>
      <Suspense fallback={<div className="p-8 text-center text-xs">Loading match analysis...</div>}>
        <MatchExplanationContent params={params} />
      </Suspense>
    </MobileShell>
  );
}
