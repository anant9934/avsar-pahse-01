import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  reconcileStorageKeys,
  auditStorageIntegrity,
} from "../src/lib/storage/index.ts";

describe("Storage Reconciliation & Drift Auditing", () => {
  it("reports SYNCHRONIZED when database and storage keys match 1:1", () => {
    const dbResumes = [
      {
        id: "res_001",
        candidateId: "cand_1",
        storageKey: "cand_1/uuid1_resume.pdf",
        fileName: "resume.pdf",
      },
      {
        id: "res_002",
        candidateId: "cand_2",
        storageKey: "cand_2/uuid2_cv.pdf",
        fileName: "cv.pdf",
      },
    ];

    const storageKeys = [
      "cand_1/uuid1_resume.pdf",
      "cand_2/uuid2_cv.pdf",
    ];

    const report = reconcileStorageKeys(dbResumes, storageKeys);

    assert.equal(report.status, "SYNCHRONIZED");
    assert.equal(report.orphanedCount, 0);
    assert.equal(report.danglingCount, 0);
    assert.equal(report.dbRecordsCount, 2);
    assert.equal(report.storageObjectsCount, 2);
    assert.ok(typeof report.checkedAt === "string");
  });

  it("detects orphaned storage keys present in S3 but missing in DB", () => {
    const dbResumes = [
      {
        id: "res_001",
        candidateId: "cand_1",
        storageKey: "cand_1/uuid1_resume.pdf",
        fileName: "resume.pdf",
      },
    ];

    const storageKeys = [
      "cand_1/uuid1_resume.pdf",
      "cand_ghost/deleted_old_file.pdf",
      "cand_abandoned/temp_upload.docx",
    ];

    const report = reconcileStorageKeys(dbResumes, storageKeys);

    assert.equal(report.status, "DRIFT_DETECTED");
    assert.equal(report.orphanedCount, 2);
    assert.equal(report.danglingCount, 0);
    assert.deepEqual(report.orphanedStorageKeys, [
      "cand_ghost/deleted_old_file.pdf",
      "cand_abandoned/temp_upload.docx",
    ]);
  });

  it("detects dangling DB records whose storage files are missing", () => {
    const dbResumes = [
      {
        id: "res_valid",
        candidateId: "cand_1",
        storageKey: "cand_1/valid.pdf",
        fileName: "valid.pdf",
      },
      {
        id: "res_missing_file",
        candidateId: "cand_2",
        storageKey: "cand_2/lost_blob.pdf",
        fileName: "lost.pdf",
      },
      {
        id: "res_null_key",
        candidateId: "cand_3",
        storageKey: "",
        fileName: "unassigned.pdf",
      },
    ];

    const storageKeys = ["cand_1/valid.pdf"];

    const report = reconcileStorageKeys(dbResumes, storageKeys);

    assert.equal(report.status, "DRIFT_DETECTED");
    assert.equal(report.orphanedCount, 0);
    assert.equal(report.danglingCount, 2);
    assert.ok(report.danglingDbResumeIds.includes("res_missing_file"));
    assert.ok(report.danglingDbResumeIds.includes("res_null_key"));
  });

  it("efficiently processes 1,000+ objects with O(N+M) set operations", () => {
    const dbResumes = [];
    const storageKeys = [];

    for (let i = 0; i < 1000; i++) {
      const key = `cand_${i}/file_${i}.pdf`;
      dbResumes.push({
        id: `res_${i}`,
        candidateId: `cand_${i}`,
        storageKey: key,
        fileName: `file_${i}.pdf`,
      });
      storageKeys.push(key);
    }

    // Introduce 5 orphans and 5 dangling
    storageKeys.push("orphan_1.pdf", "orphan_2.pdf");
    dbResumes.push({
      id: "res_dangle_1",
      candidateId: "cand_x",
      storageKey: "missing_x.pdf",
      fileName: "x.pdf",
    });

    const start = performance.now();
    const report = reconcileStorageKeys(dbResumes, storageKeys);
    const durationMs = performance.now() - start;

    assert.equal(report.status, "DRIFT_DETECTED");
    assert.equal(report.orphanedCount, 2);
    assert.equal(report.danglingCount, 1);
    assert.ok(durationMs < 50, `Execution took ${durationMs}ms, expected < 50ms`);
  });

  it("auditStorageIntegrity works with mock StorageProvider", async () => {
    const mockStorage = {
      name: "local",
      exists: async (key) => key === "exists.pdf",
      upload: async () => ({ key: "", provider: "local", byteSize: 0, mimeType: "" }),
      download: async () => ({ buffer: Buffer.from(""), contentType: "", contentLength: 0 }),
      getSignedDownloadUrl: async () => null,
      delete: async () => {},
    };

    const report = await auditStorageIntegrity(mockStorage);
    assert.ok(report);
    assert.ok(typeof report.checkedAt === "string");
  });
});
