#!/usr/bin/env node

/**
 * Neon HTTPS Migration Runner
 * 
 * Safely migrates persistent candidate profiles, jobs, applications,
 * and resumes from data/db.json into Neon Serverless PostgreSQL over HTTPS (Port 443).
 * Bypasses local ISP port 5432/6543 blocking while guaranteeing zero credential hardcoding.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DB_JSON_PATH = path.join(ROOT_DIR, "data", "db.json");

async function executeNeonQuery(connStr, sql, params = []) {
  const parsed = new URL(connStr);
  const endpoint = parsed.host;
  const url = `https://${endpoint}/sql`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "neon-connection-string": connStr,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: sql,
      params,
    }),
  });

  const json = await res.json();
  if (json.message) {
    throw new Error(`Neon SQL Error: ${json.message} (in query: ${sql.substring(0, 60)}...)`);
  }
  return json;
}

async function main() {
  const connStr = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connStr) {
    console.error("Error: DATABASE_URL or POSTGRES_URL environment variable is required.");
    process.exit(1);
  }

  if (!fs.existsSync(DB_JSON_PATH)) {
    console.error(`Error: Source data file not found at ${DB_JSON_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(DB_JSON_PATH, "utf8");
  const data = JSON.parse(raw);

  const candidates = data.candidates || (data.candidate ? [data.candidate] : []);
  const jobs = data.jobs || [];
  const resumes = data.resumes || [];
  const applications = data.applications || [];
  const savedJobIds = data.savedJobIds || [];

  console.log(`[Neon Migration] Connecting to Neon over HTTPS...`);
  const check = await executeNeonQuery(connStr, "SELECT version(), current_database()");
  console.log(`[Neon Migration] Connected to database: ${check.rows[0].current_database}`);

  // 1. Migrate Candidates
  console.log(`[Neon Migration] Migrating ${candidates.length} candidates...`);
  for (const c of candidates) {
    await executeNeonQuery(
      connStr,
      `INSERT INTO candidates (
        id, name, headline, email, phone, location, avatar, bio,
        skills, education, experience, projects, preferences,
        eris_score, profile_completion_percentage, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        headline = EXCLUDED.headline,
        email = EXCLUDED.email,
        skills = EXCLUDED.skills,
        updated_at = NOW()`,
      [
        c.id,
        c.name,
        c.headline || "",
        c.email,
        c.phone || "+91 98765 00000",
        c.location || "Bengaluru, India",
        c.avatar || "/images/avatar-rohan.jpg",
        c.bio || "",
        JSON.stringify(c.skills || []),
        JSON.stringify(c.education || []),
        JSON.stringify(c.experience || []),
        JSON.stringify(c.projects || []),
        JSON.stringify(c.preferences || {}),
        c.erisScore ?? 85,
        c.profileCompletionPercentage ?? 50,
      ]
    );

    // External Identity mapping
    if (c.aiTathastuId) {
      await executeNeonQuery(
        connStr,
        `INSERT INTO external_identities (
          id, candidate_id, provider, provider_user_id, email, created_at, updated_at
        ) VALUES ($1, $2, 'aitathastu', $3, $4, NOW(), NOW())
        ON CONFLICT (provider, provider_user_id) DO UPDATE SET
          candidate_id = EXCLUDED.candidate_id,
          updated_at = NOW()`,
        [`ext_${c.id}_tathastu`, c.id, c.aiTathastuId, c.email]
      );
    }
  }

  // 2. Migrate Jobs
  console.log(`[Neon Migration] Migrating ${jobs.length} jobs...`);
  let jobCount = 0;
  for (const j of jobs) {
    await executeNeonQuery(
      connStr,
      `INSERT INTO jobs (
        id, slug, title, company, company_logo_key, hero_image, location,
        work_arrangement, employment_type, compensation, deadline, department,
        category, overview, requirements, responsibilities, benefits,
        required_skills, optional_skills, min_experience_months, education_requirement,
        is_featured, posted_at, source_job_id, source_platform, graduation_years,
        salary_details, apply_url, application_link_type, verification_status,
        verification_note, ppo_claim, ctc_claim, is_possibly_closed,
        is_external_application, source_metadata, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32,
        $33, $34, $35, $36, NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        company = EXCLUDED.company,
        compensation = EXCLUDED.compensation,
        verification_status = EXCLUDED.verification_status,
        updated_at = NOW()`,
      [
        j.id,
        j.slug || j.id,
        j.title,
        j.company,
        j.companyLogoKey || "default",
        j.heroImage || null,
        j.location || "Remote",
        j.workArrangement || "Remote",
        j.employmentType || "Full Time",
        j.compensation || "Competitive",
        j.deadline || null,
        j.department || null,
        j.category || "General",
        j.overview || "",
        JSON.stringify(j.requirements || []),
        JSON.stringify(j.responsibilities || []),
        JSON.stringify(j.benefits || []),
        JSON.stringify(j.requiredSkills || []),
        JSON.stringify(j.optionalSkills || []),
        j.minExperienceMonths || 0,
        j.educationRequirement || null,
        Boolean(j.isFeatured),
        j.postedAt || "Recently",
        j.sourceJobId || null,
        j.sourcePlatform || null,
        JSON.stringify(j.graduationYears || []),
        j.salaryDetails ? JSON.stringify(j.salaryDetails) : null,
        j.applyUrl || null,
        j.applicationLinkType || null,
        j.verificationStatus || "UNVERIFIED",
        j.verificationNote || null,
        j.ppoClaim || null,
        j.ctcClaim ? JSON.stringify(j.ctcClaim) : null,
        Boolean(j.isPossiblyClosed),
        Boolean(j.isExternalApplication),
        j.sourceMetadata ? JSON.stringify(j.sourceMetadata) : null,
      ]
    );
    jobCount++;
  }
  console.log(`[Neon Migration] Successfully migrated ${jobCount} jobs.`);

  // 3. Migrate Resumes
  console.log(`[Neon Migration] Migrating ${resumes.length} resumes...`);
  for (const r of resumes) {
    await executeNeonQuery(
      connStr,
      `INSERT INTO resumes (
        id, candidate_id, file_name, file_size, is_primary, file_path,
        storage_provider, storage_key, mime_type, byte_size, uploaded_at,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        file_name = EXCLUDED.file_name,
        storage_key = EXCLUDED.storage_key,
        updated_at = NOW()`,
      [
        r.id,
        r.candidateId,
        r.fileName,
        r.fileSize,
        Boolean(r.isPrimary),
        r.filePath || null,
        r.storageProvider || "local",
        r.storageKey || null,
        r.mimeType || "application/pdf",
        r.byteSize || null,
        r.uploadedAt || "Just now",
      ]
    );
  }

  // 4. Migrate Applications
  console.log(`[Neon Migration] Migrating ${applications.length} applications...`);
  let appCount = 0;
  for (const a of applications) {
    try {
      await executeNeonQuery(
        connStr,
        `INSERT INTO applications (
          id, job_id, candidate_id, status, reference_number, resume_id,
          resume_name, answers, applied_at, applied_date_formatted, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, NOW())
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          updated_at = NOW()`,
        [
          a.id,
          a.jobId,
          a.candidateId,
          a.status || "Under Review",
          a.referenceNumber,
          a.resumeId || "res_default",
          a.resumeName || "Resume.pdf",
          JSON.stringify(a.answers || {}),
          a.appliedDateFormatted || "Applied recently",
        ]
      );
      appCount++;
    } catch {
      // Ignore foreign key collisions if a test application references a missing test job
    }
  }
  console.log(`[Neon Migration] Successfully migrated ${appCount} applications.`);

  // 5. Migrate Saved Jobs
  console.log(`[Neon Migration] Migrating saved job bookmarks...`);
  for (const jobId of savedJobIds) {
    const candidateId = candidates[0]?.id || "cand_rohan_sharma_001";
    try {
      await executeNeonQuery(
        connStr,
        `INSERT INTO saved_jobs (id, candidate_id, job_id, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (candidate_id, job_id) DO NOTHING`,
        [`saved_${candidateId}_${jobId}`, candidateId, jobId]
      );
    } catch {
      // Ignore if job does not exist
    }
  }

  // 6. Record Initial Schema Migration Entry
  await executeNeonQuery(
    connStr,
    `INSERT INTO schema_migrations (version, name, applied_at)
     VALUES ('001', 'initial_schema_and_dataset', NOW())
     ON CONFLICT (version) DO NOTHING`
  );

  console.log("\n[Neon Migration] COMPLETE! Neon PostgreSQL is fully provisioned and seeded.");
}

main().catch((err) => {
  console.error("[Neon Migration] Fatal migration failure:", err);
  process.exit(1);
});
