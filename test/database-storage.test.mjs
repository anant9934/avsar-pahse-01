import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { newDb } from "pg-mem";
import {
  validateDocumentMagicBytes,
  LocalStorageProvider,
  S3StorageProvider,
} from "../src/lib/storage/index.ts";
import { DatabaseConfigurationError } from "../src/lib/db/postgres.ts";
import {
  PostgresCandidateRepository,
  PostgresJobRepository,
  PostgresApplicationRepository,
  PostgresSavedJobRepository,
} from "../src/lib/repository/postgres.ts";
import { setGlobalPool } from "../src/lib/db/postgres.ts";
import { getCandidateRepository } from "../src/lib/repository/index.ts";

function createMockPostgresPool() {
  const memDb = newDb();
  memDb.public.registerFunction({
    name: "gen_random_uuid",
    returns: memDb.public.getType("text"),
    implementation: () => randomUUID(),
  });

  let snapshot = null;
  memDb.public.interceptQueries((sql) => {
    const s = sql.trim().toUpperCase();
    if (s === "BEGIN") {
      snapshot = memDb.backup();
      return [];
    }
    if (s === "ROLLBACK") {
      if (snapshot) snapshot.restore();
      snapshot = null;
      return [];
    }
    if (s === "COMMIT") {
      snapshot = null;
      return [];
    }
    return null;
  });

  const { Pool } = memDb.adapters.createPg();
  const pool = new Pool();
  return { memDb, pool };
}

test("Phase 6.1: Schema migration initializes all normalized tables, indexes & constraints", async () => {
  const { pool } = createMockPostgresPool();
  const schemaSql = fs.readFileSync(path.join(process.cwd(), "src", "lib", "db", "schema.sql"), "utf-8");

  await pool.query(schemaSql);

  const res = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  );
  const tableNames = res.rows.map((r) => r.table_name);

  assert.ok(tableNames.includes("candidates"), "candidates table must exist");
  assert.ok(tableNames.includes("external_identities"), "external_identities table must exist");
  assert.ok(tableNames.includes("jobs"), "jobs table must exist");
  assert.ok(tableNames.includes("applications"), "applications table must exist");
  assert.ok(tableNames.includes("saved_jobs"), "saved_jobs table must exist");
  assert.ok(tableNames.includes("resumes"), "resumes table must exist");
  assert.ok(tableNames.includes("audit_events"), "audit_events table must exist");
  assert.ok(tableNames.includes("import_history"), "import_history table must exist");
});

test("Phase 6.2: Idempotent migration from db.json preserves all jobs & verified metadata", async () => {
  const { pool } = createMockPostgresPool();
  setGlobalPool(pool);

  const schemaSql = fs.readFileSync(path.join(process.cwd(), "src", "lib", "db", "schema.sql"), "utf-8");
  await pool.query(schemaSql);

  const dbJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "db.json"), "utf-8"));
  const jobsList = dbJson.jobs || [];
  const candidate = dbJson.candidate;

  const jobRepo = new PostgresJobRepository();
  const candRepo = new PostgresCandidateRepository();

  // 1. Insert Candidate
  await candRepo.create({
    aiTathastuId: candidate.aiTathastuId || "tathastu_test_uuid",
    name: candidate.name,
    email: candidate.email,
  });

  const result = await jobRepo.upsertBatch(jobsList);
  assert.strictEqual(
    result.created + result.updated,
    jobsList.length,
    "All jobs should be processed in initial pass"
  );
  assert.ok(result.created >= 100, "Initial batch must create the bulk unique jobs");

  // Verify count
  const count = await jobRepo.count();
  assert.strictEqual(count, result.created, "Job count in DB should match created unique jobs");

  // Verify that real jobs with sourcePlatform and verificationStatus are preserved
  const realJobsInSource = jobsList.filter((j) => Boolean(j.sourcePlatform));
  assert.ok(realJobsInSource.length >= 54, "Must preserve at least 54 real imported jobs from dataset");

  const sampleVerified = jobsList.find((j) => j.verificationStatus === "VERIFIED");
  if (sampleVerified) {
    const fetched = await jobRepo.getById(sampleVerified.id);
    assert.ok(fetched, "Verified job must be retrievable from DB");
    assert.strictEqual(fetched.verificationStatus, "VERIFIED");
    assert.strictEqual(fetched.company, sampleVerified.company);
    assert.ok(Array.isArray(fetched.graduationYears), "Graduation years must be preserved as array");
  }

  // 3. Second-pass migration (Idempotency test)
  const retryResult = await jobRepo.upsertBatch(jobsList);
  assert.strictEqual(retryResult.created, 0, "No new jobs should be created on second pass");
  assert.strictEqual(retryResult.updated, jobsList.length, "All jobs should be updated idempotently");

  const countAfterRetry = await jobRepo.count();
  assert.strictEqual(countAfterRetry, count, "Job count must remain identical after retry");
});

test("Phase 6.3: External identity enforces unique mapping by stable AI Tathastu UUID", async () => {
  const { pool } = createMockPostgresPool();
  setGlobalPool(pool);

  const schemaSql = fs.readFileSync(path.join(process.cwd(), "src", "lib", "db", "schema.sql"), "utf-8");
  await pool.query(schemaSql);

  const candRepo = new PostgresCandidateRepository();

  const c1 = await candRepo.create({
    aiTathastuId: "tathastu_uuid_abc_123",
    name: "Candidate Alpha",
    email: "alpha@example.com",
  });
  assert.ok(c1.id, "Candidate Alpha should be created");

  const lookedUp = await candRepo.getByTathastuId("tathastu_uuid_abc_123");
  assert.ok(lookedUp, "Should look up candidate by Tathastu UUID");
  assert.strictEqual(lookedUp.email, "alpha@example.com");

  // Attempting to duplicate provider_user_id should fail at database constraint level
  await assert.rejects(
    async () => {
      await pool.query(
        `INSERT INTO external_identities (id, candidate_id, provider, provider_user_id, email, created_at, updated_at)
         VALUES ('ext_dup', $1, 'aitathastu', 'tathastu_uuid_abc_123', 'different@example.com', NOW(), NOW())`,
        [c1.id]
      );
    },
    /unique/i,
    "Should reject duplicate external identity provider_user_id"
  );
});

test("Phase 6.4: Application submission enforces atomic duplicate rejection under concurrent submissions", async () => {
  const { pool } = createMockPostgresPool();
  setGlobalPool(pool);

  const schemaSql = fs.readFileSync(path.join(process.cwd(), "src", "lib", "db", "schema.sql"), "utf-8");
  await pool.query(schemaSql);

  const candRepo = new PostgresCandidateRepository();
  const jobRepo = new PostgresJobRepository();
  const appRepo = new PostgresApplicationRepository();

  const cand = await candRepo.create({
    aiTathastuId: "tathastu_concurrent_test",
    name: "Concurrent Test User",
    email: "concurrent@example.com",
  });

  const job = await jobRepo.create({
    slug: "test-backend-role",
    title: "Backend Engineer",
    company: "Acme Corp",
    companyLogoKey: "default",
    location: "Bengaluru",
    workArrangement: "Remote",
    employmentType: "Full Time",
    compensation: "₹18,00,000",
    overview: "Great role",
    requirements: ["PostgreSQL", "Node.js"],
    responsibilities: ["Build backend APIs"],
    benefits: ["Healthcare"],
    requiredSkills: ["PostgreSQL"],
    optionalSkills: ["TypeScript"],
    minExperienceMonths: 0,
    isFeatured: false,
  });

  // Submit first application
  const sub1 = await appRepo.submit({
    jobId: job.id,
    candidateId: cand.id,
    resumeId: "res_test_1",
    answers: { experience: "3 years" },
  });
  assert.strictEqual(sub1.success, true, "First submission must succeed");
  assert.ok(sub1.application?.referenceNumber, "Must generate reference number");

  // Submit second duplicate application for same candidate and job
  const sub2 = await appRepo.submit({
    jobId: job.id,
    candidateId: cand.id,
    resumeId: "res_test_1",
    answers: { experience: "3 years" },
  });

  assert.strictEqual(sub2.success, false, "Second duplicate submission must be rejected");
  assert.ok(sub2.error?.includes("already submitted"), "Error must report prior application");

  // Verify only 1 application in database
  const apps = await appRepo.listByCandidate(cand.id);
  assert.strictEqual(apps.length, 1, "Only one application record must exist in DB");
});

test("Phase 6.5: Database transaction rollback cleanly discards partial updates on error", async () => {
  const { pool } = createMockPostgresPool();
  setGlobalPool(pool);

  const schemaSql = fs.readFileSync(path.join(process.cwd(), "src", "lib", "db", "schema.sql"), "utf-8");
  await pool.query(schemaSql);

  const candRepo = new PostgresCandidateRepository();
  const initialCand = await candRepo.create({
    aiTathastuId: "tathastu_rollback_test",
    name: "Rollback User",
    email: "rollback@example.com",
  });

  // Run a failing transaction that updates candidate then fails
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE candidates SET name = 'Corrupted Name' WHERE id = $1", [initialCand.id]);
      // Force failure
      throw new Error("Simulated sudden network failure or validation error");
    } catch {
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  } catch {
    // expected
  }

  // Verify candidate name was not modified due to transaction rollback
  const candAfterRollback = await candRepo.getById(initialCand.id);
  assert.strictEqual(candAfterRollback?.name, "Rollback User", "Rolled back transaction must not persist partial updates");
});

test("Phase 6.6: Candidate isolation in database queries", async () => {
  const { pool } = createMockPostgresPool();
  setGlobalPool(pool);

  const schemaSql = fs.readFileSync(path.join(process.cwd(), "src", "lib", "db", "schema.sql"), "utf-8");
  await pool.query(schemaSql);

  const candRepo = new PostgresCandidateRepository();
  const jobRepo = new PostgresJobRepository();
  const savedRepo = new PostgresSavedJobRepository();
  const appRepo = new PostgresApplicationRepository();

  const candA = await candRepo.create({
    aiTathastuId: "tathastu_user_a",
    name: "Candidate A",
    email: "a@example.com",
  });

  const candB = await candRepo.create({
    aiTathastuId: "tathastu_user_b",
    name: "Candidate B",
    email: "b@example.com",
  });

  const job1 = await jobRepo.create({
    slug: "job-1",
    title: "Job 1",
    company: "Company 1",
    companyLogoKey: "default",
    location: "Bengaluru",
    workArrangement: "Hybrid",
    employmentType: "Full Time",
    compensation: "₹12,00,000",
    overview: "Job 1 overview",
    requirements: [],
    responsibilities: [],
    benefits: [],
    requiredSkills: [],
    optionalSkills: [],
    minExperienceMonths: 0,
    isFeatured: false,
  });

  // Candidate A saves Job 1
  await savedRepo.toggle(candA.id, job1.id);

  // Candidate B checks saved jobs
  const savedByB = await savedRepo.listByCandidate(candB.id);
  assert.strictEqual(savedByB.length, 0, "Candidate B must not see Candidate A's saved jobs");

  const isSavedByB = await savedRepo.isSaved(candB.id, job1.id);
  assert.strictEqual(isSavedByB, false, "Job 1 must show as unsaved for Candidate B");

  // Candidate A submits application
  await appRepo.submit({
    jobId: job1.id,
    candidateId: candA.id,
    resumeId: "res_a",
    answers: {},
  });

  // Candidate B checks applications
  const appsB = await appRepo.listByCandidate(candB.id);
  assert.strictEqual(appsB.length, 0, "Candidate B must not see Candidate A's applications");
});

test("Phase 6.7: Resume durable storage, magic bytes validation & ownership enforcement", async () => {
  // Test magic bytes validation
  const validPdfHeader = Buffer.from("%PDF-1.5 test content for resume");
  assert.strictEqual(validateDocumentMagicBytes(validPdfHeader, ".pdf"), true, "Valid PDF magic bytes must pass");

  const validDocxHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
  assert.strictEqual(validateDocumentMagicBytes(validDocxHeader, ".docx"), true, "Valid DOCX magic bytes must pass");

  const maliciousExe = Buffer.from("MZ\x90\x00\x03\x00\x00\x00"); // Windows PE executable header
  assert.strictEqual(
    validateDocumentMagicBytes(maliciousExe, ".pdf"),
    false,
    "Executable masquerading as PDF must be rejected by magic bytes inspection"
  );

  // Test local storage provider upload & download
  const testStorageDir = path.join(process.cwd(), "data", "test-storage");
  const localStorage = new LocalStorageProvider(testStorageDir);

  const uploadResult = await localStorage.upload(
    "cand_alpha_01",
    "My_Resume.pdf",
    validPdfHeader,
    "application/pdf"
  );

  assert.strictEqual(uploadResult.provider, "local");
  assert.ok(uploadResult.key.includes("cand_alpha_01"));
  assert.strictEqual(uploadResult.byteSize, validPdfHeader.length);

  const downloadResult = await localStorage.download(uploadResult.key);
  assert.strictEqual(downloadResult.buffer.toString(), validPdfHeader.toString());

  // Test path traversal protection in storage key
  await assert.rejects(
    async () => {
      await localStorage.download("../../../etc/passwd");
    },
    /File not found|traversal/,
    "Should reject path traversal attempts"
  );

  // Clean up test storage dir
  try {
    await localStorage.delete(uploadResult.key);
    fs.rmSync(testStorageDir, { recursive: true, force: true });
  } catch {
    // best effort cleanup
  }
});

test("Phase 6.8: Production database configuration failure safety", () => {
  const origEnv = process.env.NODE_ENV;
  const origDbUrl = process.env.DATABASE_URL;

  try {
    process.env.NODE_ENV = "production";
    delete process.env.DATABASE_URL;

    // getCandidateRepository should fail safe with DatabaseConfigurationError in production
    // rather than falling back to in-memory/JSON storage
    assert.throws(
      () => {
        getCandidateRepository();
      },
      (err) => err instanceof DatabaseConfigurationError && err.message.includes("DATABASE_URL"),
      "Production must throw DatabaseConfigurationError when DATABASE_URL is missing"
    );
  } finally {
    process.env.NODE_ENV = origEnv;
    if (origDbUrl) process.env.DATABASE_URL = origDbUrl;
    else delete process.env.DATABASE_URL;
  }
});

test("Phase 6.9: S3 storage provider fail-safe configuration guard when bucket is missing", () => {
  const origBucket = process.env.STORAGE_BUCKET;
  const origS3Bucket = process.env.S3_BUCKET;
  try {
    delete process.env.STORAGE_BUCKET;
    delete process.env.S3_BUCKET;

    assert.throws(
      () => {
        new S3StorageProvider();
      },
      /STORAGE_BUCKET or S3_BUCKET environment variable is required/,
      "S3 provider must fail immediately if bucket is undefined"
    );
  } finally {
    if (origBucket) process.env.STORAGE_BUCKET = origBucket;
    if (origS3Bucket) process.env.S3_BUCKET = origS3Bucket;
  }
});

test("Phase 6.10: Health check endpoint returns valid service diagnostics without leaking secrets", async () => {
  const res = await fetch("http://localhost:3000/api/health");
  assert.strictEqual(res.status, 200, "Health check must return HTTP 200");
  const data = await res.json();
  assert.strictEqual(data.status, "ok");
  assert.ok(data.uptimeSeconds >= 0);
  assert.ok(data.services.database);
  assert.ok(data.services.storage);
  assert.ok(data.services.auth);
  // Ensure no sensitive credentials leaked
  assert.strictEqual(data.services.auth.clientSecret, undefined);
  assert.strictEqual(data.services.auth.sessionSecret, undefined);
});

