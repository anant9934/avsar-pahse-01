import React, { Suspense } from "react";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { MobileShell } from "@/components/layout/MobileShell";
import { getJobRepository, getCandidateRepository } from "@/lib/repository";
import { calculateJobMatch } from "@/lib/matching";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { MatchExplanationClient } from "./MatchExplanationClient";

export default async function MatchExplanationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const jobRepo = getJobRepository();
  const candRepo = getCandidateRepository();

  const job = await jobRepo.getById(id);
  if (!job) {
    notFound();
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionToken ? verifySessionToken(sessionToken) : null;
  const candidateId = session?.userId || "cand_rohan_sharma_001";

  const candidate =
    (await candRepo.getById(candidateId)) ||
    (await candRepo.getById("cand_rohan_sharma_001")) ||
    (await candRepo.listAll())[0];
  const match = candidate ? calculateJobMatch(candidate, job) : null;

  return (
    <MobileShell showBottomNav={false} activeScreenNumber={6}>
      <Suspense fallback={<div className="p-8 text-center text-xs">Loading match analysis...</div>}>
        <MatchExplanationClient
          jobId={id}
          initialJob={job}
          initialMatch={match}
        />
      </Suspense>
    </MobileShell>
  );
}
