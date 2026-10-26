#!/usr/bin/env node
/**
 * ==============================================================================
 * AVSAR PRODUCTION DATABASE MIGRATION SCRIPT (JSON -> PostgreSQL)
 * ==============================================================================
 * Idempotent, safe migration script moving persistent application data from
 * data/db.json into normalized PostgreSQL tables.
 *
 * Usage:
 *   node scripts/migrate-to-postgres.mjs [--dry-run]
 *
 * Environment:
 *   DATABASE_URL: PostgreSQL connection string (Required unless in mock/dry-run)
 * ==============================================================================
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const DB_JSON_PATH = path.join(DATA_DIR, "db.json");
const SCHEMA_PATH = path.join(ROOT_DIR, "src", "lib", "db", "schema.sql");

async function runMigration(options = {}) {
  const isDryRun = options.dryRun || process.argv.includes("--dry-run");
  console.log("==============================================================================");
  console.log(`AVSAR PRODUCTION DATABASE MIGRATION ${isDryRun ? "[DRY RUN]" : "[LIVE EXECUTION]"}`);
  console.log("==============================================================================");

  // 1. Validate source JSON file
  if (!fs.existsSync(DB_JSON_PATH)) {
    throw new Error(`Source database file not found at: ${DB_JSON_PATH}`);
  }

  let sourceData;
  try {
    const rawContent = fs.readFileSync(DB_JSON_PATH, "utf-8");
    sourceData = JSON.parse(rawContent);
  } catch (err) {
    throw new Error(`Failed to parse source db.json file: ${err.message}`);
  }

  // 2. Create timestamped recovery backup
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFilename = `db.json.migration-backup-${timestamp}.json`;
  const backupPath = path.join(DATA_DIR, backupFilename);
  fs.copyFileSync(DB_JSON_PATH, backupPath);
  console.log(`✓ Source data backup preserved at: ${backupPath}`);

  // 3. Inspect source data counts
  const candidatesList = sourceData.candidates || (sourceData.candidate ? [sourceData.candidate] : []);
  const jobsList = sourceData.jobs || [];
  const applicationsList = sourceData.applications || [];
  const resumesList = sourceData.resumes || [];
  const savedJobIds = sourceData.savedJobIds || [];
  const savedJobIdsByCandidate = sourceData.savedJobIdsByCandidate || {};

  console.log("\n[Source JSON Entity Statistics]:");
  console.log(`- Candidates:           ${candidatesList.length}`);
  console.log(`- Total Jobs:           ${jobsList.length}`);
  const realJobs = jobsList.filter((j) => Boolean(j.sourcePlatform));
  const verifiedJobs = jobsList.filter((j) => j.verificationStatus === "VERIFIED");
  console.log(`  • Platform/Dataset Jobs: ${realJobs.length}`);
  console.log(`  • Verified Jobs:         ${verifiedJobs.length}`);
  console.log(`- Applications:         ${applicationsList.length}`);
  console.log(`- Resumes:              ${resumesList.length}`);
  console.log(`- Saved Job Entries:    ${savedJobIds.length}`);

  if (isDryRun) {
    console.log("\n[DRY RUN COMPLETE]: Validation passed. No changes were made to the database.");
    return {
      backupPath,
      stats: {
        sourceCandidates: candidatesList.length,
        sourceJobs: jobsList.length,
        sourceApplications: applicationsList.length,
        sourceResumes: resumesList.length,
      },
    };
  }

  // 4. Connect to PostgreSQL
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL environment variable is not defined. Please specify your PostgreSQL connection string."
    );
  }

  const isLocalhost =
    databaseUrl.includes("localhost") ||
    databaseUrl.includes("127.0.0.1") ||
    databaseUrl.includes(".internal");

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: isLocalhost || databaseUrl.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
  });

  const client = await pool.connect();

  const report = {
    candidates: { created: 0, updated: 0, skipped: 0, errors: 0 },
    externalIdentities: { created: 0, skipped: 0 },
    jobs: { created: 0, updated: 0, verifiedPreserved: 0, errors: 0 },
    applications: { created: 0, skipped: 0, errors: 0 },
    savedJobs: { created: 0, skipped: 0 },
    resumes: { created: 0, physicalFilesFound: 0, physicalFilesMissing: 0, errors: 0 },
  };

  try {
    console.log("\n1. Applying PostgreSQL schema migrations...");
    const schemaSql = fs.readFileSync(SCHEMA_PATH, "utf-8");
    await client.query(schemaSql);
    console.log("✓ Database tables and indexes reconciled.");

    await client.query("BEGIN");

    // 5. Migrate Candidates & External Identities
    console.log("\n2. Migrating candidates & external identity mappings...");
    for (const cand of candidatesList) {
      try {
        const existing = await client.query(`SELECT id FROM candidates WHERE id = $1`, [cand.id]);
        if (existing.rows.length > 0) {
          await client.query(
            `UPDATE candidates SET
               name = $1, headline = $2, email = $3, phone = $4, location = $5,
               avatar = $6, bio = $7, skills = $8, education = $9, experience = $10,
               projects = $11, preferences = $12, eris_score = $13,
               profile_completion_percentage = $14, updated_at = NOW()
             WHERE id = $15`,
            [
              cand.name,
              cand.headline || "",
              cand.email,
              cand.phone || "+91 98765 00000",
              cand.location || "Bengaluru, India",
              cand.avatar || "/images/avatar-rohan.jpg",
              cand.bio || "",
              JSON.stringify(cand.skills || []),
              JSON.stringify(cand.education || []),
              JSON.stringify(cand.experience || []),
              JSON.stringify(cand.projects || []),
              JSON.stringify(cand.preferences || {}),
              cand.erisScore ?? 85,
              cand.profileCompletionPercentage ?? 50,
              cand.id,
            ]
          );
          report.candidates.updated++;
        } else {
          await client.query(
            `INSERT INTO candidates (
               id, name, headline, email, phone, location, avatar, bio,
               skills, education, experience, projects, preferences,
               eris_score, profile_completion_percentage, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())`,
            [
              cand.id,
              cand.name,
              cand.headline || "",
              cand.email,
              cand.phone || "+91 98765 00000",
              cand.location || "Bengaluru, India",
              cand.avatar || "/images/avatar-rohan.jpg",
              cand.bio || "",
              JSON.stringify(cand.skills || []),
              JSON.stringify(cand.education || []),
              JSON.stringify(cand.experience || []),
              JSON.stringify(cand.projects || []),
              JSON.stringify(cand.preferences || {}),
              cand.erisScore ?? 85,
              cand.profileCompletionPercentage ?? 50,
            ]
          );
          report.candidates.created++;
        }

        // Map AI Tathastu external identity if present
        if (cand.aiTathastuId) {
          const extId = `ext_${cand.id}_tathastu`;
          await client.query(
            `INSERT INTO external_identities (
               id, candidate_id, provider, provider_user_id, email, created_at, updated_at
             ) VALUES ($1, $2, 'aitathastu', $3, $4, NOW(), NOW())
             ON CONFLICT (provider, provider_user_id) DO UPDATE SET
               candidate_id = EXCLUDED.candidate_id,
               email = EXCLUDED.email,
               updated_at = NOW()`,
            [extId, cand.id, cand.aiTathastuId, cand.email]
          );
          report.externalIdentities.created++;
        }
      } catch (err) {
        console.error(`Error migrating candidate ${cand.id}:`, err);
        report.candidates.errors++;
      }
    }

    // 6. Migrate Jobs (Preserving all 54 imported real jobs + seed jobs)
    console.log("\n3. Migrating jobs and preserving source metadata...");
    for (const j of jobsList) {
      try {
        if (j.verificationStatus === "VERIFIED") {
          report.jobs.verifiedPreserved++;
        }

        const existing = await client.query(`SELECT id FROM jobs WHERE id = $1`, [j.id]);
        if (existing.rows.length > 0) {
          await client.query(
            `UPDATE jobs SET
               slug = $1, title = $2, company = $3, company_logo_key = $4, hero_image = $5,
               location = $6, work_arrangement = $7, employment_type = $8, compensation = $9,
               deadline = $10, department = $11, category = $12, overview = $13,
               requirements = $14, responsibilities = $15, benefits = $16,
               required_skills = $17, optional_skills = $18, min_experience_months = $19,
               education_requirement = $20, is_featured = $21, source_job_id = $22,
               source_platform = $23, graduation_years = $24, salary_details = $25,
               apply_url = $26, application_link_type = $27, verification_status = $28,
               verification_note = $29, ppo_claim = $30, ctc_claim = $31,
               is_possibly_closed = $32, is_external_application = $33,
               source_metadata = $34, updated_at = NOW()
             WHERE id = $35`,
            [
              j.slug || j.id,
              j.title,
              j.company,
              j.companyLogoKey || "default",
              j.heroImage || null,
              j.location,
              j.workArrangement,
              j.employmentType,
              j.compensation,
              j.deadline || null,
              j.department || null,
              j.category || null,
              j.overview || "",
              JSON.stringify(j.requirements || []),
              JSON.stringify(j.responsibilities || []),
              JSON.stringify(j.benefits || []),
              JSON.stringify(j.requiredSkills || []),
              JSON.stringify(j.optionalSkills || []),
              j.minExperienceMonths || 0,
              j.educationRequirement || null,
              Boolean(j.isFeatured),
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
              j.id,
            ]
          );
          report.jobs.updated++;
        } else {
          await client.query(
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
             )`,
            [
              j.id,
              j.slug || j.id,
              j.title,
              j.company,
              j.companyLogoKey || "default",
              j.heroImage || null,
              j.location,
              j.workArrangement,
              j.employmentType,
              j.compensation,
              j.deadline || null,
              j.department || null,
              j.category || null,
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
          report.jobs.created++;
        }
      } catch (err) {
        console.error(`Error migrating job ${j.id}:`, err);
        report.jobs.errors++;
      }
    }

    // 7. Migrate Resumes & File Tracking
    console.log("\n4. Migrating resume metadata & verifying file availability...");
    for (const r of resumesList) {
      try {
        if (r.filePath && fs.existsSync(r.filePath)) {
          report.resumes.physicalFilesFound++;
        } else {
          report.resumes.physicalFilesMissing++;
        }

        await client.query(
          `INSERT INTO resumes (
             id, candidate_id, file_name, file_size, is_primary,
             file_path, storage_provider, storage_key, uploaded_at, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
           ON CONFLICT (id) DO UPDATE SET
             candidate_id = EXCLUDED.candidate_id,
             file_name = EXCLUDED.file_name,
             file_size = EXCLUDED.file_size,
             is_primary = EXCLUDED.is_primary,
             file_path = EXCLUDED.file_path,
             storage_provider = EXCLUDED.storage_provider,
             storage_key = EXCLUDED.storage_key,
             updated_at = NOW()`,
          [
            r.id,
            r.candidateId || candidatesList[0]?.id,
            r.fileName,
            r.fileSize,
            Boolean(r.isPrimary),
            r.filePath || null,
            r.storageProvider || "local",
            r.storageKey || null,
            r.uploadedAt || "Just now",
          ]
        );
        report.resumes.created++;
      } catch (err) {
        console.error(`Error migrating resume ${r.id}:`, err);
        report.resumes.errors++;
      }
    }

    // 8. Migrate Applications (FK integrity check)
    console.log("\n5. Migrating applications...");
    for (const app of applicationsList) {
      try {
        const candId = app.candidateId || candidatesList[0]?.id;
        const jobId = app.jobId;

        // Verify foreign key integrity
        const candCheck = await client.query(`SELECT id FROM candidates WHERE id = $1`, [candId]);
        const jobCheck = await client.query(`SELECT id FROM jobs WHERE id = $1`, [jobId]);

        if (candCheck.rows.length === 0 || jobCheck.rows.length === 0) {
          console.warn(`Skipping application ${app.id}: FK reference missing (cand=${candId}, job=${jobId})`);
          report.applications.skipped++;
          continue;
        }

        await client.query(
          `INSERT INTO applications (
             id, job_id, candidate_id, status, reference_number,
             resume_id, resume_name, answers, applied_at,
             applied_date_formatted, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
           ON CONFLICT (candidate_id, job_id) DO UPDATE SET
             status = EXCLUDED.status,
             reference_number = EXCLUDED.reference_number,
             resume_id = EXCLUDED.resume_id,
             resume_name = EXCLUDED.resume_name,
             answers = EXCLUDED.answers,
             updated_at = NOW()`,
          [
            app.id,
            jobId,
            candId,
            app.status || "Under Review",
            app.referenceNumber || `AVS-LEGACY-${app.id}`,
            app.resumeId || "res_1",
            app.resumeName || "Resume.pdf",
            JSON.stringify(app.answers || {}),
            app.appliedAt ? new Date(app.appliedAt) : new Date(),
            app.appliedDateFormatted || "Applied recently",
          ]
        );
        report.applications.created++;
      } catch (err) {
        console.error(`Error migrating application ${app.id}:`, err);
        report.applications.errors++;
      }
    }

    // 9. Migrate Saved Jobs
    console.log("\n6. Migrating candidate bookmarks / saved jobs...");
    const candidateSavedEntries = [];

    // Combine candidate-scoped saved jobs
    if (sourceData.candidate && savedJobIds.length > 0) {
      for (const jid of savedJobIds) {
        candidateSavedEntries.push({ candidateId: sourceData.candidate.id, jobId: jid });
      }
    }
    for (const [candId, jids] of Object.entries(savedJobIdsByCandidate)) {
      for (const jid of jids) {
        if (!candidateSavedEntries.some((e) => e.candidateId === candId && e.jobId === jid)) {
          candidateSavedEntries.push({ candidateId: candId, jobId: jid });
        }
      }
    }

    for (const entry of candidateSavedEntries) {
      try {
        const candCheck = await client.query(`SELECT id FROM candidates WHERE id = $1`, [entry.candidateId]);
        const jobCheck = await client.query(`SELECT id FROM jobs WHERE id = $1`, [entry.jobId]);

        if (candCheck.rows.length === 0 || jobCheck.rows.length === 0) {
          report.savedJobs.skipped++;
          continue;
        }

        const id = `save_${entry.candidateId}_${entry.jobId}`;
        await client.query(
          `INSERT INTO saved_jobs (id, candidate_id, job_id, created_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (candidate_id, job_id) DO NOTHING`,
          [id, entry.candidateId, entry.jobId]
        );
        report.savedJobs.created++;
      } catch (err) {
        console.error(`Error migrating saved job ${entry.jobId}:`, err);
      }
    }

    await client.query("COMMIT");
    console.log("\n✓ Database transaction committed successfully.");

    // 10. Reconcile database record counts
    const candDbCount = await client.query(`SELECT COUNT(*) FROM candidates`);
    const jobsDbCount = await client.query(`SELECT COUNT(*) FROM jobs`);
    const appsDbCount = await client.query(`SELECT COUNT(*) FROM applications`);
    const resumesDbCount = await client.query(`SELECT COUNT(*) FROM resumes`);
    const savedDbCount = await client.query(`SELECT COUNT(*) FROM saved_jobs`);

    console.log("\n==============================================================================");
    console.log("POST-MIGRATION RECONCILIATION SUMMARY");
    console.log("==============================================================================");
    console.log(`- Candidates migrated:   ${candDbCount.rows[0].count} / ${candidatesList.length}`);
    console.log(`- Total jobs in DB:      ${jobsDbCount.rows[0].count} / ${jobsList.length}`);
    console.log(`  • Verified jobs:       ${report.jobs.verifiedPreserved}`);
    console.log(`- Applications in DB:    ${appsDbCount.rows[0].count} / ${applicationsList.length}`);
    console.log(`- Resumes in DB:         ${resumesDbCount.rows[0].count} / ${resumesList.length}`);
    console.log(`  • Physical files:      ${report.resumes.physicalFilesFound} present, ${report.resumes.physicalFilesMissing} require cloud sync`);
    console.log(`- Saved jobs in DB:      ${savedDbCount.rows[0].count}`);
    console.log("==============================================================================");

    return {
      success: true,
      backupPath,
      report,
      dbCounts: {
        candidates: parseInt(candDbCount.rows[0].count, 10),
        jobs: parseInt(jobsDbCount.rows[0].count, 10),
        applications: parseInt(appsDbCount.rows[0].count, 10),
        resumes: parseInt(resumesDbCount.rows[0].count, 10),
        savedJobs: parseInt(savedDbCount.rows[0].count, 10),
      },
    };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed, transaction rolled back safely.", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// Allow CLI invocation
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigration().catch((err) => {
    console.error("Migration fatal error:", err);
    process.exit(1);
  });
}

export { runMigration };
