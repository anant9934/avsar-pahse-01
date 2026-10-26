"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected client error securely for production monitoring
    console.error("[Avsar Client Error Boundary Caught]:", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="min-h-screen bg-[#F8F6F1] text-[#242720] flex flex-col justify-center items-center px-4 py-16 selection:bg-[#285C45] selection:text-white">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#FCE8E6] text-[#C5221F] mb-2 shadow-inner">
          <AlertTriangle className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#C5221F] bg-[#FAD2CF] px-3 py-1 rounded-full">
            Application Error
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1A1C18]">
            Something unexpected occurred
          </h1>
          <p className="text-sm text-[#575B52] leading-relaxed">
            We encountered a temporary problem while rendering this page. You can try reloading the section or returning to the home page.
          </p>
          {error.digest && (
            <p className="text-xs font-mono text-[#80868B] pt-1">
              Reference code: {error.digest}
            </p>
          )}
        </div>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#285C45] text-white font-medium hover:bg-[#1E4735] transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-[#285C45] focus:ring-offset-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          <Link
            href="/home"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-[#DCD8C8] bg-white text-[#242720] font-medium hover:bg-[#F3EFE6] transition-colors focus:outline-none focus:ring-2 focus:ring-[#285C45] focus:ring-offset-2"
          >
            <Home className="w-4 h-4 text-[#575B52]" />
            Go to Home
          </Link>
        </div>

        <div className="pt-8 border-t border-[#E5E0D0] text-xs text-[#7A7E74]">
          If this persists across sessions, please check service health at{" "}
          <Link href="/api/health" className="underline font-semibold text-[#285C45]">
            /api/health
          </Link>
          .
        </div>
      </div>
    </main>
  );
}
