"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Sparkles, CheckCircle2, ShieldCheck, Compass } from "lucide-react";
import { AvsarLogo } from "@/components/brand/AvsarLogo";
import { MobileShell } from "@/components/layout/MobileShell";

export default function WelcomePage() {
  return (
    <MobileShell showBottomNav={false} activeScreenNumber={1}>
      <div className="flex-1 flex flex-col justify-between px-4 sm:px-6 md:px-8 pt-3 md:pt-6 pb-6 relative overflow-hidden bg-[#F8F6F1]">
        {/* Mobile-only Brand Header (Desktop uses top DesktopNavbar) */}
        <div className="flex md:hidden items-center justify-between pt-1 pb-2">
          <AvsarLogo size="md" showTagline={true} />
        </div>

        {/* Responsive Hero Section */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 lg:gap-12 items-center my-auto py-2 md:py-8 max-w-5xl mx-auto w-full">
          {/* Left Column: Editorial Value Proposition & Actions */}
          <div className="md:col-span-7 flex flex-col justify-center z-10 text-left order-2 md:order-1">
            {/* AI Tathastu Ecosystem Badge */}
            <div className="hidden sm:inline-flex items-center gap-1.5 self-start px-3 py-1 rounded-full bg-[#EAF4EB] text-[#285C45] text-xs font-semibold mb-3 border border-[#DCE8D9]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI-Powered Career Intelligence • AI Tathastu</span>
            </div>

            {/* Hero Editorial Heading */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl leading-[1.12] text-[#242720] tracking-tight">
              <span className="font-editorial-script text-4xl sm:text-5xl lg:text-6xl block text-[#242720]/90 font-serif italic mb-1">
                Your Skills.
              </span>
              <span className="font-extrabold block tracking-tight">
                Real Opportunities.
              </span>
            </h1>

            {/* Subheading / Value Proposition */}
            <p className="text-sm sm:text-base text-[#55564F] mt-2.5 sm:mt-3.5 mb-5 sm:mb-6 max-w-lg leading-relaxed font-normal">
              Connect directly with verified internships, high-growth engineering roles, and personalized opportunities matched to your real skills. Zero spam, zero noise.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Link
                href="/auth"
                className="bg-[#285C45] hover:bg-[#1E4735] text-white font-bold py-3 px-6 rounded-full flex items-center justify-center gap-2 text-sm sm:text-base shadow-sm hover:shadow transition-all group"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                href="/explore"
                className="bg-white hover:bg-[#F2EFE8] text-[#242720] border border-[#E0DCD3] font-semibold py-3 px-5 rounded-full flex items-center justify-center gap-2 text-sm sm:text-base shadow-2xs transition-colors"
              >
                <Compass className="w-4 h-4 text-[#285C45]" />
                <span>Explore 130+ Roles</span>
              </Link>
            </div>

            {/* Sign In & Secondary Action */}
            <p className="text-xs text-[#77786F] mt-3.5">
              Already have an AI Tathastu account?{" "}
              <Link
                href="/auth"
                className="font-bold text-[#242720] underline underline-offset-2 hover:text-[#285C45]"
              >
                Sign In
              </Link>
            </p>

            {/* Trust Proof Points */}
            <div className="hidden sm:flex items-center gap-4 mt-6 pt-5 border-t border-[#ECEAE3] text-xs text-[#55564F]">
              <div className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4 text-[#285C45]" />
                <span>130+ Verified Jobs</span>
              </div>
              <div className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4 text-[#285C45]" />
                <span>AI Skills Match Engine</span>
              </div>
              <div className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-4 h-4 text-[#285C45]" />
                <span>Direct Employer Links</span>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Visual Composition with Floating Badges */}
          <div className="md:col-span-5 flex items-center justify-center relative py-2 sm:py-4 order-1 md:order-2">
            {/* Organic background aura / shape */}
            <div className="absolute w-60 h-60 sm:w-72 sm:h-72 rounded-full bg-[#EBF3E8] filter blur-xl opacity-80 -z-0" />
            <div className="absolute -top-3 -right-2 w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-[#F3EFE6] filter blur-lg -z-0" />

            {/* Floating Category Pills with Ribbon Effect */}
            <div className="absolute top-1 sm:top-2 right-2 sm:right-4 z-20 transform rotate-[-4deg]">
              <span className="font-serif italic text-[11px] sm:text-xs tracking-wider text-[#77786F] bg-white/95 backdrop-blur-sm border border-[#E8E6DF] px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-2xs">
                Internships
              </span>
            </div>

            <div className="absolute top-12 sm:top-16 -left-1 sm:left-2 z-20 transform rotate-[6deg]">
              <span className="font-serif italic text-[11px] sm:text-xs tracking-wider text-[#77786F] bg-white/95 backdrop-blur-sm border border-[#E8E6DF] px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-2xs">
                Jobs
              </span>
            </div>

            <div className="absolute top-28 sm:top-36 -right-1 sm:right-2 z-20 transform rotate-[3deg]">
              <span className="font-serif italic text-[11px] sm:text-xs tracking-wider text-[#77786F] bg-white/95 backdrop-blur-sm border border-[#E8E6DF] px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-2xs">
                Growth
              </span>
            </div>

            <div className="absolute bottom-12 sm:bottom-16 -left-1 sm:left-2 z-20 transform rotate-[-5deg]">
              <span className="font-serif italic text-[11px] sm:text-xs tracking-wider text-[#77786F] bg-white/95 backdrop-blur-sm border border-[#E8E6DF] px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-2xs">
                Career
              </span>
            </div>

            <div className="absolute bottom-2 sm:bottom-4 right-2 sm:right-4 z-20 transform rotate-[8deg]">
              <span className="font-serif italic text-[11px] sm:text-xs tracking-wider text-[#77786F] bg-white/95 backdrop-blur-sm border border-[#E8E6DF] px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-2xs">
                Opportunities
              </span>
            </div>

            {/* Center Portrait Image */}
            <div className="relative z-10 w-52 h-68 sm:w-64 sm:h-80 md:w-68 md:h-84 lg:w-76 lg:h-92 rounded-[24px] sm:rounded-[28px] overflow-hidden shadow-xl border-4 border-white">
              <Image
                src="/images/hero-student.jpg"
                alt="Avsar Career Opportunities Student"
                fill
                sizes="(max-width: 768px) 260px, (max-width: 1200px) 320px, 360px"
                className="object-cover object-top"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </MobileShell>
  );
}
