"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Mail,
  ShieldCheck,
  RefreshCw,
  Zap,
  ArrowRight,
  HelpCircle,
  CheckCircle2,
} from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";

export default function AuthPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlError = params.get("error");
      const urlMsg = params.get("message");
      if (urlMsg) return urlMsg;
      if (urlError === "consent_denied") {
        return "AI Tathastu authorization was denied or cancelled. Please allow access to proceed.";
      }
      if (urlError === "invalid_state") {
        return "Authentication session expired or state mismatch. Please try signing in again.";
      }
      if (urlError === "account_disabled") {
        return "This AI Tathastu account is disabled or inactive. Please contact support.";
      }
    }
    return null;
  });

  const handleDemoSignIn = async () => {
    setLoading("demo");
    try {
      router.push("/api/auth/aitathastu/login?demo=rohan&return_to=/home");
    } catch (err) {
      console.error(err);
      setLoading(null);
    }
  };

  const handleOAuthSignIn = (provider: "google" | "email") => {
    setLoading(provider);
    router.push(`/api/auth/aitathastu/login?provider=${provider}&return_to=/home`);
  };

  return (
    <MobileShell showBottomNav={false} activeScreenNumber={2}>
      <div className="flex-1 flex flex-col justify-between px-6 pt-4 pb-8 bg-[#F8F6F1] md:max-w-md md:w-full md:mx-auto md:my-8 md:bg-white md:border md:border-[#ECEAE3] md:rounded-3xl md:p-8 md:shadow-xs">
        {/* Top bar with back and help icon */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-11 h-11 -ml-2 rounded-full flex items-center justify-center text-[#242720] hover:bg-[#EFECE5] transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.2px]" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setMessage("AI Tathastu is the unified single-sign-on (SSO) identity provider for Avsar.")}
            className="w-11 h-11 -mr-2 rounded-full flex items-center justify-center text-[#77786F] hover:bg-[#EFECE5] transition-colors"
            aria-label="Information about AI Tathastu authentication"
          >
            <HelpCircle className="w-5 h-5 stroke-[1.8px]" aria-hidden="true" />
          </button>
        </div>

        {/* Heading & Subtitle */}
        <div className="mt-8 mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#242720] tracking-tight leading-tight">
            Continue with
            <br />
            AI Tathastu
          </h1>
          <p className="text-sm font-medium text-[#77786F] mt-2 leading-relaxed">
            One account. Access Avsar with your existing AI Tathastu ID.
          </p>
        </div>

        {/* Message / Diagnostic toast */}
        {message && (
          <div className="mb-4 p-3 bg-[#EAF4EB] border border-[#DCE8D9] rounded-xl flex items-start gap-2 text-xs text-[#285C45]">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>{message}</p>
            </div>
            <button
              onClick={() => setMessage(null)}
              className="font-bold hover:underline"
            >
              ✕
            </button>
          </div>
        )}

        {/* Auth Methods List */}
        <div className="flex flex-col gap-3.5 my-auto">
          {/* Continue with Google */}
          <button
            type="button"
            onClick={() => handleOAuthSignIn("google")}
            disabled={loading !== null}
            className="w-full bg-white hover:bg-[#FAF9F6] border border-[#ECEAE3] text-[#242720] font-semibold py-3.5 px-5 rounded-2xl flex items-center justify-center gap-3 shadow-2xs hover:border-[#DEDCD4] transition-all"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.4 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.15 0 9.92 0 12s.45 3.85 1.24 5.42l4.04-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.6 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>{loading === "google" ? "Connecting..." : "Continue with Google"}</span>
          </button>

          {/* Divider */}
          <div className="flex items-center my-1 select-none">
            <div className="flex-1 border-t border-[#E8E6DF]" />
            <span className="px-4 text-xs font-semibold uppercase tracking-wider text-[#9E9F96]">
              OR
            </span>
            <div className="flex-1 border-t border-[#E8E6DF]" />
          </div>

          {/* Continue with Email Link */}
          <button
            type="button"
            onClick={() => handleOAuthSignIn("email")}
            disabled={loading !== null}
            className="w-full bg-white hover:bg-[#FAF9F6] border border-[#ECEAE3] text-[#242720] font-semibold py-3.5 px-5 rounded-2xl flex items-center justify-center gap-3 shadow-2xs hover:border-[#DEDCD4] transition-all"
          >
            <Mail className="w-5 h-5 text-[#242720] stroke-[1.8px]" />
            <span>{loading === "email" ? "Sending Link..." : "Continue with Email Link"}</span>
          </button>

          {/* Fast Demo One-Click Sign In */}
          <button
            type="button"
            onClick={handleDemoSignIn}
            disabled={loading !== null}
            className="w-full bg-[#EBF3E9] hover:bg-[#DDEBD9] border border-[#CDE1C8] text-[#285C45] font-semibold py-3 px-4 rounded-2xl flex items-center justify-center gap-2 text-xs transition-all mt-1"
          >
            <span>⚡ Instant Demo Access (Rohan Sharma)</span>
          </button>
        </div>

        {/* Security & Feature Badges */}
        <div className="grid grid-cols-3 gap-2 py-6 border-t border-[#ECEAE3]/80 my-2">
          <div className="flex flex-col items-center text-center gap-1.5">
            <div className="w-8 h-8 rounded-full bg-[#EBF3E9] flex items-center justify-center text-[#285C45]">
              <ShieldCheck className="w-4 h-4 stroke-[2.2px]" />
            </div>
            <span className="text-[11px] font-semibold text-[#55564F]">Secure</span>
          </div>

          <div className="flex flex-col items-center text-center gap-1.5">
            <div className="w-8 h-8 rounded-full bg-[#EBF3E9] flex items-center justify-center text-[#285C45]">
              <RefreshCw className="w-4 h-4 stroke-[2.2px]" />
            </div>
            <span className="text-[11px] font-semibold text-[#55564F]">Same Account</span>
          </div>

          <div className="flex flex-col items-center text-center gap-1.5">
            <div className="w-8 h-8 rounded-full bg-[#EBF3E9] flex items-center justify-center text-[#285C45]">
              <Zap className="w-4 h-4 stroke-[2.2px]" />
            </div>
            <span className="text-[11px] font-semibold text-[#55564F]">Quick Access</span>
          </div>
        </div>

        {/* Bottom Card: New to AI Tathastu? */}
        <div className="bg-[#F2EFE9] border border-[#E6E3DB] rounded-2xl p-5 text-center flex flex-col items-center">
          <h3 className="text-sm font-bold text-[#242720]">New to AI Tathastu?</h3>
          <p className="text-xs text-[#77786F] mt-1 mb-3">
            Create your account first to use Avsar.
          </p>
          <a
            href="https://www.aitathastu.com/onboarding"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-bold text-[#285C45] hover:underline"
          >
            <span>Create AI Tathastu Account</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </MobileShell>
  );
}
