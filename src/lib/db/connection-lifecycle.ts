import type { Pool, PoolClient } from "pg";

export interface LeaseOptions {
  timeoutMs?: number;
  label?: string;
}

export interface ActiveLeaseRecord {
  id: string;
  label: string;
  acquiredAt: number;
}

// Active connection lease registry for leak detection and SRE diagnostics
const activeLeases = new Map<string, ActiveLeaseRecord>();
let leaseCounter = 0;

/**
 * Executes a callback with a strictly managed PoolClient connection lease.
 * Guarantees release in `finally` and enforces a hard execution timeout to
 * prevent serverless connection hoarding.
 */
export async function withConnectionLease<T>(
  pool: Pool,
  operation: (client: PoolClient) => Promise<T>,
  options: LeaseOptions = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 5000;
  const label = options.label || "unlabeled_operation";
  const leaseId = `lease_${++leaseCounter}_${Date.now()}`;

  const client = await pool.connect();
  const acquiredAt = Date.now();
  activeLeases.set(leaseId, { id: leaseId, label, acquiredAt });

  let timer: NodeJS.Timeout | null = null;
  let hasCompleted = false;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      if (!hasCompleted) {
        reject(
          new Error(
            `[Connection Lifecycle] Lease "${label}" (ID: ${leaseId}) timed out after ${timeoutMs}ms.`
          )
        );
      }
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([operation(client), timeoutPromise]);
    hasCompleted = true;
    return result;
  } finally {
    hasCompleted = true;
    if (timer) {
      clearTimeout(timer);
    }
    activeLeases.delete(leaseId);
    try {
      client.release();
    } catch {
      // Best-effort release
    }
  }
}

/**
 * Returns current count of active connection leases.
 */
export function getActiveLeaseCount(): number {
  return activeLeases.size;
}

/**
 * Returns diagnostic metadata on active connection leases for debugging.
 */
export function getActiveLeaseDiagnostics(): ActiveLeaseRecord[] {
  return Array.from(activeLeases.values());
}

/**
 * Clears active lease tracking (for testing reset).
 */
export function clearActiveLeasesForTesting(): void {
  activeLeases.clear();
}
