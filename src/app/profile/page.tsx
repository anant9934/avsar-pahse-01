"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  User,
  GraduationCap,
  Briefcase,
  Code,
  FolderGit2,
  Sliders,
  ChevronRight,
  LogOut,
  Edit2,
  X,
  Check,
} from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { MobileHeader } from "@/components/navigation/MobileHeader";
import { CircularProgress } from "@/components/ui/CircularProgress";
import type { Candidate } from "@/types";

export default function CandidateProfilePage() {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isEditingBasic, setIsEditingBasic] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    headline: "",
    location: "",
    email: "",
    phone: "",
    skillsStr: "",
  });

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isEditingBasic) {
        setIsEditingBasic(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditingBasic]);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/profile");
        if (res.ok) {
          const data = await res.json();
          setCandidate(data.candidate);
          setEditForm({
            name: data.candidate.name,
            headline: data.candidate.headline,
            location: data.candidate.location,
            email: data.candidate.email,
            phone: data.candidate.phone,
            skillsStr: data.candidate.skills.join(", "),
          });
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadProfile();
  }, []);

  const handleSaveBasic = async () => {
    const updatedSkills = editForm.skillsStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          headline: editForm.headline,
          location: editForm.location,
          email: editForm.email,
          phone: editForm.phone,
          skills: updatedSkills,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCandidate(data.candidate);
        setIsEditingBasic(false);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2500);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const sections = [
    {
      id: "personal",
      label: "Personal Information",
      icon: User,
      detail: `${candidate?.location || "Bengaluru"} · ${candidate?.email || ""}`,
    },
    {
      id: "education",
      label: "Education",
      icon: GraduationCap,
      detail: candidate?.education?.[0]
        ? `${candidate.education[0].degree} (${candidate.education[0].endYear})`
        : "Visvesvaraya Technological University",
    },
    {
      id: "experience",
      label: "Work Experience",
      icon: Briefcase,
      detail: `${candidate?.experience?.length || 2} verified experiences`,
    },
    {
      id: "skills",
      label: "Skills",
      icon: Code,
      detail: `${candidate?.skills?.length || 10} technical skills added`,
    },
    {
      id: "projects",
      label: "Projects",
      icon: FolderGit2,
      detail: `${candidate?.projects?.length || 2} projects showcased`,
    },
    {
      id: "preferences",
      label: "Career Preferences",
      icon: Sliders,
      detail: `${candidate?.preferences?.targetRole || "Frontend"} · ${candidate?.preferences?.workArrangement || "Hybrid"}`,
    },
  ];

  return (
    <MobileShell activeScreenNumber={12}>
      <div className="flex-1 flex flex-col pb-8 bg-[#F8F6F1] relative">
        {/* Toast confirmation */}
        {showToast && (
          <div
            role="status"
            aria-live="polite"
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#242720] text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2"
          >
            <Check className="w-4 h-4 text-[#48B37C]" aria-hidden="true" />
            <span>Profile updated successfully!</span>
          </div>
        )}

        {/* Mobile Header */}
        <MobileHeader
          title="My Profile"
          showBack={true}
          rightAction={
            <Link
              href="/api/auth/logout"
              className="w-11 h-11 rounded-full flex items-center justify-center text-[#77786F] hover:text-[#D13636] hover:bg-[#F2EFE9] transition-colors"
              title="Sign Out"
              aria-label="Sign Out of Avsar"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
            </Link>
          }
        />

        <div className="px-5 pt-3 flex flex-col gap-4">
          {/* Candidate Profile Header Card */}
          <div className="flex flex-col items-center text-center pt-2 pb-1">
            <div className="relative w-20 h-20 rounded-full overflow-hidden border-3 border-white shadow-md mb-2.5">
              <Image
                src={candidate?.avatar || "/images/avatar-rohan.jpg"}
                alt={candidate?.name || "Rohan Sharma"}
                fill
                sizes="80px"
                className="object-cover"
                priority
              />
            </div>

            <div className="flex items-center gap-1.5">
              <h1 className="text-lg font-bold text-[#242720]">
                {candidate?.name || "Rohan Sharma"}
              </h1>
              <button
                type="button"
                onClick={() => setIsEditingBasic(!isEditingBasic)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#EAE7DF] text-[#77786F] transition-colors"
                aria-label="Edit Profile Details"
              >
                <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            <p className="text-xs text-[#77786F] mt-0.5">
              {candidate?.headline || "Aspiring Software Developer"}
            </p>
          </div>

          {/* Inline Edit Form Modal / Panel */}
          {isEditingBasic && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-details-title"
              className="card-surface p-4 bg-white border-[#285C45]/30 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between pb-1 border-b border-[#ECEAE3]">
                <span id="edit-details-title" className="text-xs font-bold text-[#242720]">
                  Edit Candidate Details
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingBasic(false)}
                  aria-label="Close edit form"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#77786F] hover:text-black hover:bg-[#F2EFE9]"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              <div>
                <label htmlFor="edit-name" className="text-[11px] font-bold text-[#77786F] block mb-1">
                  Full Name
                </label>
                <input
                  id="edit-name"
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full h-10 px-3 bg-[#FAF9F5] border border-[#EAE7DF] rounded-lg text-xs"
                />
              </div>

              <div>
                <label htmlFor="edit-headline" className="text-[11px] font-bold text-[#77786F] block mb-1">
                  Headline
                </label>
                <input
                  id="edit-headline"
                  type="text"
                  value={editForm.headline}
                  onChange={(e) => setEditForm({ ...editForm, headline: e.target.value })}
                  className="w-full h-10 px-3 bg-[#FAF9F5] border border-[#EAE7DF] rounded-lg text-xs"
                />
              </div>

              <div>
                <label htmlFor="edit-skills" className="text-[11px] font-bold text-[#77786F] block mb-1">
                  Skills (comma separated)
                </label>
                <input
                  id="edit-skills"
                  type="text"
                  value={editForm.skillsStr}
                  onChange={(e) => setEditForm({ ...editForm, skillsStr: e.target.value })}
                  className="w-full h-10 px-3 bg-[#FAF9F5] border border-[#EAE7DF] rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditingBasic(false)}
                  className="px-4 py-2 rounded-lg border border-[#EAE7DF] text-xs font-semibold min-h-[44px] hover:bg-[#F2EFE9] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveBasic}
                  className="px-5 py-2 rounded-lg bg-[#285C45] text-white text-xs font-bold hover:bg-[#1E4735] min-h-[44px] transition-colors shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {/* Profile Completion Card (Screen 12 Feature) */}
          <div className="card-surface p-4 bg-white flex items-center justify-between gap-3 shadow-2xs">
            <div className="min-w-0">
              <span className="text-[11px] uppercase font-bold text-[#77786F] block">
                Profile Completion
              </span>
              <h2 className="text-base font-extrabold text-[#242720] mt-0.5">
                {candidate?.profileCompletionPercentage || 80}% Complete
              </h2>
              <p className="text-xs text-[#77786F] mt-1 leading-snug">
                Complete your profile to get better matches
              </p>
            </div>

            <div className="shrink-0">
              <CircularProgress
                value={candidate?.profileCompletionPercentage || 80}
                size={58}
                strokeWidth={5}
                color="#285C45"
                trackColor="#EAF2E8"
              />
            </div>
          </div>

          {/* Profile Sections Accordion / Navigation List */}
          <div className="card-surface divide-y divide-[#ECEAE3] bg-white overflow-hidden shadow-2xs">
            {sections.map((sec) => {
              const Icon = sec.icon;
              const isOpen = activeSection === sec.id;

              return (
                <div key={sec.id} className="transition-colors">
                  <button
                    type="button"
                    onClick={() => setActiveSection(isOpen ? null : sec.id)}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-[#FAF9F5] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-[#EAF4EB] text-[#285C45] flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 stroke-[2px]" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs sm:text-sm font-bold text-[#242720] block">
                          {sec.label}
                        </span>
                        <span className="text-[11px] text-[#77786F] truncate block">
                          {sec.detail}
                        </span>
                      </div>
                    </div>

                    <ChevronRight
                      className={`w-4 h-4 text-[#9E9F96] transition-transform ${
                        isOpen ? "transform rotate-90 text-[#285C45]" : ""
                      }`}
                    />
                  </button>

                  {/* Expanded Detail View */}
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 bg-[#FAF9F5] text-xs text-[#55564F] space-y-2 border-t border-[#ECEAE3]">
                      {sec.id === "skills" && (
                        <div className="flex flex-wrap gap-1.5 pt-2">
                          {candidate?.skills.map((s) => (
                            <span
                              key={s}
                              className="px-2.5 py-1 rounded-full bg-white border border-[#E0DED5] text-xs font-semibold text-[#285C45]"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}

                      {sec.id === "education" && (
                        <div className="pt-2 space-y-1.5">
                          {candidate?.education.map((edu) => (
                            <div key={edu.id} className="p-2.5 bg-white rounded-lg border border-[#E8E6DF]">
                              <p className="font-bold text-[#242720]">{edu.degree} in {edu.field}</p>
                              <p className="text-[11px] text-[#77786F]">{edu.institution} ({edu.startYear} - {edu.endYear})</p>
                              {edu.gpa && <p className="text-[11px] text-[#285C45] font-semibold">GPA: {edu.gpa}</p>}
                            </div>
                          ))}
                        </div>
                      )}

                      {sec.id === "experience" && (
                        <div className="pt-2 space-y-2">
                          {candidate?.experience.map((exp) => (
                            <div key={exp.id} className="p-2.5 bg-white rounded-lg border border-[#E8E6DF]">
                              <p className="font-bold text-[#242720]">{exp.role} · {exp.company}</p>
                              <p className="text-[11px] text-[#77786F]">{exp.startDate} - {exp.endDate}</p>
                              <p className="text-[11px] mt-1 text-[#44463E]">{exp.description}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {sec.id === "projects" && (
                        <div className="pt-2 space-y-2">
                          {candidate?.projects.map((proj) => (
                            <div key={proj.id} className="p-2.5 bg-white rounded-lg border border-[#E8E6DF]">
                              <p className="font-bold text-[#242720]">{proj.title}</p>
                              <p className="text-[11px] text-[#44463E] mt-0.5">{proj.description}</p>
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {proj.technologies.map((t) => (
                                  <span key={t} className="text-[10px] bg-[#EAF4EB] text-[#285C45] px-1.5 py-0.5 rounded">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {sec.id === "preferences" && (
                        <div className="pt-2 p-2.5 bg-white rounded-lg border border-[#E8E6DF] space-y-1">
                          <p><strong>Role:</strong> {candidate?.preferences.targetRole}</p>
                          <p><strong>Preferred Location:</strong> {candidate?.preferences.preferredLocation}</p>
                          <p><strong>Work Model:</strong> {candidate?.preferences.workArrangement}</p>
                          <p><strong>Min Expected:</strong> {candidate?.preferences.minExpectedSalary}</p>
                        </div>
                      )}

                      {sec.id === "personal" && (
                        <div className="pt-2 p-2.5 bg-white rounded-lg border border-[#E8E6DF] space-y-1">
                          <p><strong>Email:</strong> {candidate?.email}</p>
                          <p><strong>Phone:</strong> {candidate?.phone}</p>
                          <p><strong>City:</strong> {candidate?.location}</p>
                          <p><strong>ERIS Readiness Score:</strong> {candidate?.erisScore}/100</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </MobileShell>
  );
}
