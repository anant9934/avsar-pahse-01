"use client";

import React, { useState, useEffect, useRef, use, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileText,
  MoreVertical,
  User,
  HelpCircle,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { MobileHeader } from "@/components/navigation/MobileHeader";
import type { Job, Candidate, Resume } from "@/types";

function ApplicationFlowContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const stepParam = searchParams.get("step");
  const initialStep = stepParam ? parseInt(stepParam, 10) : 1;

  const [currentStep, setCurrentStep] = useState<number>(initialStep || 1);
  const [job, setJob] = useState<Job | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>("res_1");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Additional questions state
  const [experienceNotes, setExperienceNotes] = useState("");
  const [noticePeriod, setNoticePeriod] = useState("Immediate");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [declaredConsent, setDeclaredConsent] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [jobRes, profileRes, resumesRes] = await Promise.all([
          fetch(`/api/jobs/${id}`),
          fetch("/api/profile"),
          fetch("/api/resumes"),
        ]);

        if (jobRes.ok) {
          const jd = await jobRes.json();
          setJob(jd.job);
        }
        if (profileRes.ok) {
          const pd = await profileRes.json();
          setCandidate(pd.candidate);
          if (pd.candidate?.portfolio) {
            setPortfolioUrl(pd.candidate.portfolio);
          }
        }
        if (resumesRes.ok) {
          const rd = await resumesRes.json();
          setResumes(rd.resumes || []);
          const primary = rd.resumes?.find((r: Resume) => r.isPrimary);
          if (primary) setSelectedResumeId(primary.id);
          else if (rd.resumes?.length > 0) setSelectedResumeId(rd.resumes[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadData();
  }, [id]);

  // Handle resume file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File exceeds maximum size of 5 MB");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/resumes", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setResumes((prev) => [data.resume, ...prev]);
      setSelectedResumeId(data.resume.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  // Submit Application
  const handleSubmitApplication = async () => {
    if (!declaredConsent) {
      setSubmitError("Please confirm the accuracy declaration before submitting.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job?.id || id,
          resumeId: selectedResumeId,
          answers: {
            relevantExperience: experienceNotes,
            noticePeriod,
            portfolioUrl,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.application) {
          router.push(
            `/applications/success?ref=${data.application.referenceNumber}&job=${job?.id || id}`
          );
          return;
        }
        throw new Error(data.error || "Failed to submit application");
      }

      router.push(
        `/applications/success?ref=${data.application.referenceNumber}&job=${job?.id || id}`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSubmitError(msg);
      setSubmitting(false);
    }
  };

  const selectedResume = resumes.find((r) => r.id === selectedResumeId) || resumes[0];

  return (
    <div className="flex-1 flex flex-col bg-[#F8F6F1] pb-24">
      <MobileHeader
        title={
          currentStep === 1
            ? "Apply for this role"
            : currentStep === 2
            ? "Upload Your Resume"
            : currentStep === 3
            ? "Additional Questions"
            : "Review Your Application"
        }
        showBack={true}
        onBack={() => {
          if (currentStep > 1) setCurrentStep((prev) => prev - 1);
          else router.back();
        }}
      />

      <div className="px-5 pt-4 flex-1 flex flex-col justify-between">
        {/* STEP 1: Application Flow Stepper Overview */}
        {currentStep === 1 && (
          <div className="flex-1 flex flex-col gap-6">
            <div className="flex flex-col gap-5 py-2">
              <div className="flex items-start gap-4 relative">
                <div className="w-8 h-8 rounded-full bg-[#285C45] text-white flex items-center justify-center font-bold text-sm shrink-0 z-10 shadow-xs">
                  1
                </div>
                <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-[#DCE8D9] -ml-[1px]" />
                <div className="pt-0.5 min-w-0">
                  <h3 className="text-sm font-bold text-[#242720]">Review & Requirements</h3>
                  <p className="text-xs text-[#77786F] mt-0.5">Check eligibility and documents</p>
                </div>
              </div>

              <div className="flex items-start gap-4 relative">
                <div className="w-8 h-8 rounded-full bg-[#FAF9F5] border-2 border-[#DCE8D9] text-[#285C45] flex items-center justify-center font-bold text-sm shrink-0 z-10">
                  2
                </div>
                <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-[#DCE8D9] -ml-[1px]" />
                <div className="pt-0.5 min-w-0">
                  <h3 className="text-sm font-bold text-[#242720]">Resume & Documents</h3>
                  <p className="text-xs text-[#77786F] mt-0.5">Upload or select resume</p>
                </div>
              </div>

              <div className="flex items-start gap-4 relative">
                <div className="w-8 h-8 rounded-full bg-[#FAF9F5] border-2 border-[#E8E6DF] text-[#77786F] flex items-center justify-center font-bold text-sm shrink-0 z-10">
                  3
                </div>
                <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-[#DCE8D9] -ml-[1px]" />
                <div className="pt-0.5 min-w-0">
                  <h3 className="text-sm font-bold text-[#242720]">Additional Questions</h3>
                  <p className="text-xs text-[#77786F] mt-0.5">Answer a few questions</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-[#FAF9F5] border-2 border-[#E8E6DF] text-[#77786F] flex items-center justify-center font-bold text-sm shrink-0 z-10">
                  4
                </div>
                <div className="pt-0.5 min-w-0">
                  <h3 className="text-sm font-bold text-[#242720]">Review & Submit</h3>
                  <p className="text-xs text-[#77786F] mt-0.5">Confirm and apply</p>
                </div>
              </div>
            </div>

            {job?.isPossiblyClosed && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Applications Closed for this Role</strong>
                  <span>
                    Source metadata indicates this role is no longer accepting new applications. Applications cannot be submitted.
                  </span>
                </div>
              </div>
            )}

            {job?.isExternalApplication && job?.applyUrl && (
              <div className="p-3.5 bg-[#EAF4EB] border border-[#CDE5D0] rounded-xl text-xs text-[#242720] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#285C45]">{job.applicationLinkType || "External Application"}</span>
                  <span className="text-[11px] bg-white border border-[#CDE5D0] px-2 py-0.5 rounded-full text-[#285C45] font-semibold">
                    Leaves Avsar
                  </span>
                </div>
                <p className="text-[11px] text-[#55564F]">
                  This role accepts applications directly on the host employer or partner channel.
                </p>
                <a
                  href={job.applyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#285C45] hover:underline"
                >
                  <span>Open External Application Portal</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            {job && (
              <div className="card-surface p-4 bg-white mt-auto">
                <span className="text-[11px] font-bold uppercase text-[#77786F] block mb-1">
                  Applying to
                </span>
                <h4 className="text-sm font-bold text-[#242720]">{job.title}</h4>
                <p className="text-xs text-[#55564F]">
                  {job.company} · {job.location} · {job.compensation}
                </p>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Resume Upload */}
        {currentStep === 2 && (
          <div className="flex-1 flex flex-col gap-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#C5DAC1] bg-[#FAFDF9] rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-[#F2FAF0] transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileUpload}
                aria-label="Upload resume file (PDF, DOC, or DOCX up to 5 megabytes)"
                className="hidden"
              />

              <div className="w-12 h-12 rounded-full bg-[#EAF4EB] text-[#285C45] flex items-center justify-center mb-3">
                <FileText className="w-6 h-6 stroke-[2px]" />
              </div>

              <h3 className="text-sm font-bold text-[#242720]">
                {isUploading ? "Uploading..." : "Drag & drop your resume"}
              </h3>
              <p className="text-xs text-[#77786F] mt-1 mb-4">
                PDF, DOC, DOCX (Max 5 MB)
              </p>

              <button
                type="button"
                className="px-5 py-2 rounded-full bg-[#242720] text-white text-xs font-semibold hover:bg-black transition-colors"
              >
                Choose File
              </button>
            </div>

            {uploadError && (
              <p className="text-xs text-red-600 font-medium px-1">{uploadError}</p>
            )}

            <div className="mt-2">
              <h4 className="text-xs font-bold text-[#77786F] uppercase tracking-wider mb-2.5">
                Or select an existing resume
              </h4>

              <div className="flex flex-col gap-2.5">
                {resumes.map((resume) => {
                  const isSelected = selectedResumeId === resume.id;
                  return (
                    <div
                      key={resume.id}
                      onClick={() => setSelectedResumeId(resume.id)}
                      className={`card-surface p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-all ${
                        isSelected
                          ? "border-[#285C45] bg-[#FAFDF9] ring-1 ring-[#285C45]"
                          : "bg-white hover:border-[#D6D3C9]"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "border-[#285C45] bg-[#285C45]"
                              : "border-[#B8B6AD] bg-white"
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>

                        <div className="w-9 h-9 rounded-xl bg-[#EAF4EB] text-[#285C45] flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>

                        <div className="min-w-0">
                          <h5 className="text-xs font-bold text-[#242720] truncate">
                            {resume.fileName}
                          </h5>
                          <span className="text-[11px] text-[#77786F]">
                            {resume.uploadedAt} · {resume.fileSize}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="text-[#9E9F96] hover:text-[#242720] p-1"
                        aria-label="Resume options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Additional Questions */}
        {currentStep === 3 && (
          <div className="flex-1 flex flex-col gap-4">
            <div className="card-surface p-4 bg-white space-y-4">
              <div>
                <label className="text-xs font-bold text-[#242720] block mb-1">
                  Relevant Projects / Experience Summary
                </label>
                <textarea
                  rows={3}
                  value={experienceNotes}
                  onChange={(e) => setExperienceNotes(e.target.value)}
                  placeholder="Briefly highlight your experience with the required tech stack..."
                  className="w-full p-3 bg-[#FAF9F5] border border-[#EAE7DF] rounded-xl text-xs text-[#242720] focus:outline-none focus:border-[#285C45]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#242720] block mb-1">
                  Earliest Start Date / Notice Period
                </label>
                <input
                  type="text"
                  value={noticePeriod}
                  onChange={(e) => setNoticePeriod(e.target.value)}
                  className="w-full h-10 px-3 bg-[#FAF9F5] border border-[#EAE7DF] rounded-xl text-xs text-[#242720] focus:outline-none focus:border-[#285C45]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#242720] block mb-1">
                  Portfolio / GitHub Profile Link
                </label>
                <input
                  type="url"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  className="w-full h-10 px-3 bg-[#FAF9F5] border border-[#EAE7DF] rounded-xl text-xs text-[#242720] focus:outline-none focus:border-[#285C45]"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Review Your Application */}
        {currentStep === 4 && (
          <div className="flex-1 flex flex-col gap-3.5">
            {submitError && (
              <div className="p-3 bg-[#FDF0F0] border border-[#FACDCD] rounded-xl flex items-start gap-2 text-xs text-[#D13636]">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{submitError}</p>
              </div>
            )}

            <div className="card-surface p-4 bg-white">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#77786F] uppercase tracking-wide">
                  <User className="w-3.5 h-3.5 text-[#285C45]" />
                  <span>Personal Information</span>
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/profile")}
                  className="text-xs font-bold text-[#285C45] hover:underline"
                >
                  Edit
                </button>
              </div>
              <div className="text-xs text-[#242720] space-y-0.5">
                <p className="font-bold">{candidate?.name || "Candidate"}</p>
                <p className="text-[#77786F]">{candidate?.email || "No email on file"}</p>
                <p className="text-[#77786F]">{candidate?.location || "Location not specified"}</p>
              </div>
            </div>

            <div className="card-surface p-4 bg-white">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#77786F] uppercase tracking-wide">
                  <FileText className="w-3.5 h-3.5 text-[#285C45]" />
                  <span>Resume</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="text-xs font-bold text-[#285C45] hover:underline"
                >
                  Edit
                </button>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#EAF4EB] text-[#285C45] flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-[#242720]">
                  {selectedResume?.fileName || "Selected Resume"}
                </span>
              </div>
            </div>

            <div className="card-surface p-4 bg-white">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#77786F] uppercase tracking-wide">
                  <HelpCircle className="w-3.5 h-3.5 text-[#285C45]" />
                  <span>Additional Questions</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="text-xs font-bold text-[#285C45] hover:underline"
                >
                  Edit
                </button>
              </div>
              <p className="text-xs text-[#55564F]">3 answers completed</p>
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FAF9F5] border border-[#EAE7DF] cursor-pointer text-xs text-[#55564F] select-none mt-2">
              <input
                type="checkbox"
                checked={declaredConsent}
                onChange={(e) => setDeclaredConsent(e.target.checked)}
                className="mt-0.5 rounded text-[#285C45] focus:ring-[#285C45] w-4 h-4"
              />
              <span className="leading-relaxed">
                I confirm that the information provided is accurate and I agree to the terms and privacy policy.
              </span>
            </label>
          </div>
        )}

        {/* Bottom Sticky Action */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#ECEAE3] max-w-md mx-auto px-4 py-3 safe-area-bottom">
          {currentStep < 4 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => prev + 1)}
              disabled={Boolean(job?.isPossiblyClosed)}
              className="w-full bg-[#285C45] hover:bg-[#1E4735] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 px-6 rounded-full flex items-center justify-center gap-2 text-sm shadow-sm transition-all group"
            >
              <span>{job?.isPossiblyClosed ? "Listing is Closed" : "Continue"}</span>
              {!job?.isPossiblyClosed && (
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmitApplication}
              disabled={submitting || Boolean(job?.isPossiblyClosed)}
              className="w-full bg-[#285C45] hover:bg-[#1E4735] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 px-6 rounded-full flex items-center justify-center gap-2 text-sm shadow-sm transition-all group"
            >
              <span>
                {job?.isPossiblyClosed
                  ? "Listing is Closed"
                  : submitting
                  ? "Submitting Application..."
                  : "Submit Application"}
              </span>
              {!job?.isPossiblyClosed && (
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ApplicationFlowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <MobileShell showBottomNav={false} activeScreenNumber={7}>
      <Suspense fallback={<div className="p-8 text-center text-xs">Loading application flow...</div>}>
        <ApplicationFlowContent params={params} />
      </Suspense>
    </MobileShell>
  );
}
