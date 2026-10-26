import type { Pool } from "pg";
import {
  getReadPool,
  getWritePool,
  hasDedicatedReadReplica,
} from "./read-replica.ts";

/**
 * Tracks recent candidate write timestamps to enforce Read-After-Write (RAW) consistency.
 * Prevents reading stale data from asynchronous read-replicas immediately following a mutation.
 */
const recentMutations = new Map<string, number>();

const DEFAULT_PIN_WINDOW_MS = 5000; // 5 seconds post-mutation window

/**
 * Pins a candidate's subsequent reads to the primary database for a specified duration.
 */
export function pinCandidateToPrimary(
  candidateId: string,
  durationMs = DEFAULT_PIN_WINDOW_MS
): void {
  if (!candidateId) return;
  const pinUntil = Date.now() + durationMs;
  recentMutations.set(candidateId, pinUntil);
}

/**
 * Evaluates whether a candidate's reads must be routed to the primary database.
 * Returns true if:
 * 1. No dedicated read-replica is configured.
 * 2. Candidate performed a mutation within the active pin window.
 */
export function shouldRouteToPrimary(candidateId?: string | null): boolean {
  if (!hasDedicatedReadReplica()) {
    return true; // No replica configured; primary is authoritative
  }

  if (!candidateId) {
    return false; // Anonymous or unauthenticated reads can safely use read replica
  }

  const pinUntil = recentMutations.get(candidateId);
  if (!pinUntil) {
    return false;
  }

  if (Date.now() < pinUntil) {
    return true; // Active pin window
  }

  // Window expired; clean up and allow read replica
  recentMutations.delete(candidateId);
  return false;
}

/**
 * Returns either the primary write pool or read replica pool based on read-after-write consistency rules.
 */
export function getConsistentReadPool(candidateId?: string | null): Pool {
  if (shouldRouteToPrimary(candidateId)) {
    return getWritePool();
  }
  return getReadPool();
}

export interface ReplicaLagReport {
  configured: boolean;
  lagSeconds: number | null;
  healthy: boolean;
  status: "SYNCHRONIZED" | "LAGGING" | "NOT_CONFIGURED" | "UNAVAILABLE";
}

/**
 * Inspects real-time replication lag on the configured read-replica.
 */
export async function checkReplicationLag(): Promise<ReplicaLagReport> {
  if (!hasDedicatedReadReplica()) {
    return {
      configured: false,
      lagSeconds: null,
      healthy: true,
      status: "NOT_CONFIGURED",
    };
  }

  try {
    const readPool = getReadPool();
    const result = await readPool.query<{ lag_seconds: string | number | null }>(
      `SELECT EXTRACT(EPOCH FROM (NOW() - pg_last_xact_replay_timestamp())) AS lag_seconds`
    );

    const rawLag = result.rows[0]?.lag_seconds;
    const lagSeconds = rawLag !== null && rawLag !== undefined ? Number(rawLag) : 0;
    const isHealthy = lagSeconds < 10; // Under 10 seconds is acceptable for read replica

    return {
      configured: true,
      lagSeconds: isNaN(lagSeconds) ? 0 : lagSeconds,
      healthy: isHealthy,
      status: isHealthy ? "SYNCHRONIZED" : "LAGGING",
    };
  } catch {
    return {
      configured: true,
      lagSeconds: null,
      healthy: false,
      status: "UNAVAILABLE",
    };
  }
}

/**
 * For testing and test reset: clears all active candidate pins.
 */
export function clearCandidatePinsForTesting(): void {
  recentMutations.clear();
}
