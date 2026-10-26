import React, { Suspense } from "react";
import { notFound } from "next/navigation";
import { MobileShell } from "@/components/layout/MobileShell";
import { getJobRepository, getCandidateRepository, getSavedJobRepository } from "@/lib/repository";
import { calculateJobMatch } from "@/lib/matching";
import { JobDetailClient } from "./JobDetailClient";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const jobRepo = getJobRepository();
  const candRepo = getCandidateRepository();
  const savedRepo = getSavedJobRepository();

  const job = await jobRepo.getById(id);
  if (!job) {
    notFound();
  }

  const candidate = (await candRepo.getById("cand_rohan_sharma_001")) || (await candRepo.listAll())[0];
  const match = candidate ? calculateJobMatch(candidate, job) : null;
  const isSaved = candidate ? await savedRepo.isSaved(candidate.id, job.id) : false;

  return (
    <MobileShell showBottomNav={false} activeScreenNumber={5}>
      <Suspense fallback={<div className="p-8 text-center text-xs">Loading job details...</div>}>
        <JobDetailClient
          jobId={id}
          initialJob={job}
          initialMatch={match}
          initialIsSaved={isSaved}
        />
      </Suspense>
    </MobileShell>
  );
}
