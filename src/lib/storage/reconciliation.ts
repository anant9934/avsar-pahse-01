import type { Pool } from "pg";
import { getPgPool, isPostgresConfigured } from "../db/postgres.ts";
import type { StorageProvider } from "./index.ts";

export interface DbResumeEntry {
  id: string;
  candidateId: string;
  storageKey: string;
  fileName: string;
}

export interface StorageReconciliationReport {
  checkedAt: string;
  dbRecordsCount: number;
  storageObjectsCount: number;
  orphanedCount: number;
  danglingCount: number;
  orphanedStorageKeys: string[];
  danglingDbResumeIds: string[];
  status: "SYNCHRONIZED" | "DRIFT_DETECTED";
}

/**
 * Pure evaluation function for comparing database records with object storage keys.
 */
export function reconcileStorageKeys(
  dbResumes: DbResumeEntry[],
  storageKeys: string[]
): StorageReconciliationReport {
  const dbKeySet = new Set<string>();
  const danglingDbResumeIds: string[] = [];

  for (const record of dbResumes) {
    if (record.storageKey) {
      dbKeySet.add(record.storageKey);
    }
  }

  const storageKeySet = new Set(storageKeys);

  // 1. Detect dangling DB records (DB points to a key that does not exist in storage)
  for (const record of dbResumes) {
    if (!record.storageKey || !storageKeySet.has(record.storageKey)) {
      danglingDbResumeIds.push(record.id);
    }
  }

  // 2. Detect orphaned storage objects (storage has file not referenced in DB)
  const orphanedStorageKeys: string[] = [];
  for (const key of storageKeys) {
    if (!dbKeySet.has(key)) {
      orphanedStorageKeys.push(key);
    }
  }

  const isSynchronized = danglingDbResumeIds.length === 0 && orphanedStorageKeys.length === 0;

  return {
    checkedAt: new Date().toISOString(),
    dbRecordsCount: dbResumes.length,
    storageObjectsCount: storageKeys.length,
    orphanedCount: orphanedStorageKeys.length,
    danglingCount: danglingDbResumeIds.length,
    orphanedStorageKeys,
    danglingDbResumeIds,
    status: isSynchronized ? "SYNCHRONIZED" : "DRIFT_DETECTED",
  };
}

/**
 * Runs a live reconciliation check by querying the PostgreSQL resumes table
 * and testing existence against the active StorageProvider.
 */
export async function auditStorageIntegrity(
  storage: StorageProvider,
  options: { pool?: Pool; maxBatch?: number } = {}
): Promise<StorageReconciliationReport> {
  const dbResumes: DbResumeEntry[] = [];
  const checkedKeys: string[] = [];

  if (isPostgresConfigured() || options.pool) {
    const pool = options.pool || getPgPool();
    const limit = options.maxBatch || 500;

    const res = await pool.query<{
      id: string;
      candidate_id: string;
      storage_key: string | null;
      file_name: string;
    }>(
      `SELECT id, candidate_id, storage_key, file_name 
       FROM resumes 
       LIMIT $1`,
      [limit]
    );

    for (const row of res.rows) {
      if (row.storage_key) {
        dbResumes.push({
          id: row.id,
          candidateId: row.candidate_id,
          storageKey: row.storage_key,
          fileName: row.file_name,
        });

        // Test existence in storage
        const exists = await storage.exists(row.storage_key);
        if (exists) {
          checkedKeys.push(row.storage_key);
        }
      } else {
        // Record with missing storage_key is immediately considered dangling
        dbResumes.push({
          id: row.id,
          candidateId: row.candidate_id,
          storageKey: "",
          fileName: row.file_name,
        });
      }
    }
  }

  return reconcileStorageKeys(dbResumes, checkedKeys);
}
