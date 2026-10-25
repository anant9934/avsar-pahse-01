"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { AvsarLogo } from "@/components/brand/AvsarLogo";
import { MobileShell } from "@/components/layout/MobileShell";

export default function WelcomePage() {
  return (
    <MobileShell showBottomNav={false} activeScreenNumber={1}>
      <div className="flex-1 flex flex-col justify-between px-6 pt-5 pb-8 relative overflow-hidden bg-[#F8F6F1]">
        {/* Brand Header */}
        <div className="flex items-center justify-between pt-2">
          <AvsarLogo size="md" showTagline={true} />
        </div>

        {/* Hero Editorial Heading */}
        <div className="mt-6 mb-2 z-10">
          <h2 className="text-3xl sm:text-4xl leading-[1.15] text-[#242720] tracking-tight">
            <span className="font-editorial-script text-4xl sm:text-5xl block text-[#242720]/90 font-serif italic mb-1">
              Your Skills.
            </span>
            <span className="font-extrabold block tracking-tight">
              Real Opportunities.
            </span>
          </h2>
        </div>

        {/* Visual Composition: Floating Tags + Student Photo */}
        <div className="relative my-auto py-4 flex items-center justify-center min-h-[360px]">
          {/* Organic background aura / shape */}
          <div className="absolute w-72 h-72 rounded-full bg-[#EBF3E8] filter blur-xl opacity-80 -z-0" />
          <div className="absolute -top-4 -right-2 w-40 h-40 rounded-full bg-[#F3EFE6] filter blur-lg -z-0" />

          {/* Floating Category Pills with Ribbon Effect */}
          <div className="absolute -top-1 right-2 z-20 transform rotate-[-4deg] animate-pulse">
            <span className="font-serif italic text-xs tracking-wider text-[#77786F] bg-white/80 backdrop-blur-sm border border-[#E8E6DF] px-3 py-1 rounded-full shadow-2xs">
              Internships
            </span>
          </div>

          <div className="absolute top-16 -left-2 z-20 transform rotate-[6deg]">
            <span className="font-serif italic text-xs tracking-wider text-[#77786F] bg-white/80 backdrop-blur-sm border border-[#E8E6DF] px-3 py-1 rounded-full shadow-2xs">
              Jobs
            </span>
          </div>

          <div className="absolute top-36 right-0 z-20 transform rotate-[3deg]">
            <span className="font-serif italic text-xs tracking-wider text-[#77786F] bg-white/80 backdrop-blur-sm border border-[#E8E6DF] px-3 py-1 rounded-full shadow-2xs">
              Growth
            </span>
          </div>

          <div className="absolute bottom-20 -left-1 z-20 transform rotate-[-5deg]">
            <span className="font-serif italic text-xs tracking-wider text-[#77786F] bg-white/80 backdrop-blur-sm border border-[#E8E6DF] px-3 py-1 rounded-full shadow-2xs">
              Career
            </span>
          </div>

          <div className="absolute bottom-4 right-4 z-20 transform rotate-[8deg]">
            <span className="font-serif italic text-xs tracking-wider text-[#77786F] bg-white/80 backdrop-blur-sm border border-[#E8E6DF] px-3 py-1 rounded-full shadow-2xs">
              Opportunities
            </span>
          </div>

          {/* Center Portrait Image */}
          <div className="relative z-10 w-64 h-80 sm:w-72 sm:h-88 rounded-[28px] overflow-hidden shadow-xl border-4 border-white">
            <Image
              src="/images/hero-student.jpg"
              alt="Avsar Career Opportunities Student"
              fill
              className="object-cover object-top"
              priority
            />
          </div>
        </div>

        {/* Bottom CTA & Sign In */}
        <div className="flex flex-col gap-3.5 z-10 pt-2">
          <Link
            href="/auth"
            className="w-full bg-[#285C45] hover:bg-[#1E4735] text-white font-bold py-3.5 px-6 rounded-full flex items-center justify-center gap-2 text-base shadow-sm hover:shadow transition-all group"
          >
            <span>Get Started</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>

          <p className="text-center text-xs text-[#77786F]">
            Already have an AI Tathastu account?{" "}
            <Link
              href="/auth"
              className="font-bold text-[#242720] underline underline-offset-2 hover:text-[#285C45]"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </MobileShell>
  );
}
