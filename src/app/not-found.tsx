import Link from "next/link";
import { Compass, Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#F8F6F1] text-[#242720] flex flex-col justify-center items-center px-4 py-16 selection:bg-[#285C45] selection:text-white">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#EAE7DC] text-[#285C45] mb-2 shadow-inner">
          <Compass className="w-10 h-10 animate-pulse" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#285C45] bg-[#E2DFD2] px-3 py-1 rounded-full">
            Error 404
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1A1C18]">
            Opportunity Not Found
          </h1>
          <p className="text-sm sm:text-base text-[#575B52] leading-relaxed">
            The page or opportunity you are searching for might have been moved, expired, or does not exist.
          </p>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/home"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#285C45] text-white font-medium hover:bg-[#1E4735] transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-[#285C45] focus:ring-offset-2"
          >
            <Home className="w-4 h-4" />
            Go to Home
          </Link>
          <Link
            href="/explore"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-[#DCD8C8] bg-white text-[#242720] font-medium hover:bg-[#F3EFE6] transition-colors focus:outline-none focus:ring-2 focus:ring-[#285C45] focus:ring-offset-2"
          >
            <Search className="w-4 h-4 text-[#575B52]" />
            Explore Jobs
          </Link>
        </div>

        <div className="pt-8 border-t border-[#E5E0D0] text-xs text-[#7A7E74]">
          Need assistance? Return to{" "}
          <Link href="/welcome" className="underline font-semibold text-[#285C45] hover:text-[#1E4735]">
            Avsar Welcome
          </Link>{" "}
          or contact AI Tathastu support.
        </div>
      </div>
    </main>
  );
}
