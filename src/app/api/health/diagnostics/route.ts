import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/auth/admin";
import { isPostgresConfigured, getPgPool } from "@/lib/db/postgres";
import { checkReplicationLag } from "@/lib/db/replica-lag";
import { getBackgroundQueue, getDurableQueue } from "@/lib/queue";
import { getDeadLetterSummary } from "@/lib/queue/dead-letter";
import { getCacheStats } from "@/lib/cache";
import { isGlobalRateLimitingActive } from "@/lib/ratelimit";
import { getAllCircuitStats } from "@/lib/circuit-breaker";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Restricted Operator Diagnostics Endpoint
 * 
 * Provides authorized operators and SREs with detailed internal telemetry,
 * database pool saturation, replication lag, queue depth, and circuit breaker status.
 * Requires valid Admin session cookie or Bearer authorization key.
 */
export async function GET(request: NextRequest) {
  const auth = checkAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: "Unauthorized: Operator credentials required to inspect system diagnostics." },
      { status: 401 }
    );
  }

  // 1. Database Connection Pool Diagnostics
  let poolDiagnostics: {
    configured: boolean;
    totalCount?: number;
    idleCount?: number;
    waitingCount?: number;
  } = { configured: false };

  if (isPostgresConfigured()) {
    try {
      const pool = getPgPool();
      poolDiagnostics = {
        configured: true,
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
      };
    } catch {
      poolDiagnostics = { configured: true };
    }
  }

  // 2. Read Replica Lag
  const replicaLag = await checkReplicationLag();

  // 3. Background Queue Metrics
  const memoryQueueStats = getBackgroundQueue().getStats();
  const durableQueueStats = await getDurableQueue().getStats();
  const deadLetterSummary = await getDeadLetterSummary();

  // 4. Cache Statistics
  const cacheStats = getCacheStats();

  // 5. Circuit Breaker States
  const breakers = getAllCircuitStats();

  // 6. Memory and Process Metrics
  const memoryUsage = process.memoryUsage();

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    diagnostics: {
      database: {
        pool: poolDiagnostics,
        replicaLag,
      },
      queue: {
        durable: durableQueueStats,
        memory: memoryQueueStats,
        deadLetter: deadLetterSummary,
      },
      cache: cacheStats,
      rateLimiting: {
        isGlobal: isGlobalRateLimitingActive(),
      },
      circuitBreakers: breakers,
      process: {
        nodeVersion: process.version,
        rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
        heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      },
    },
  });
}
