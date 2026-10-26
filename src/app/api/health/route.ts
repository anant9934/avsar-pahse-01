import { NextResponse } from "next/server";
import { checkDatabaseHealth, isPostgresConfigured } from "@/lib/db/postgres";
import { getStorageProvider } from "@/lib/storage";
import { validateAuthConfig } from "@/lib/auth/aitathastu";
import { db } from "@/lib/db";

export async function GET() {
  const uptime = process.uptime();
  const timestamp = new Date().toISOString();

  // 1. Check Database Health
  let databaseStatus: {
    status: "healthy" | "degraded" | "unhealthy";
    type: "postgres" | "local_file";
    latencyMs?: number;
    recordCount?: number;
    error?: string;
  };

  if (isPostgresConfigured()) {
    const pgHealth = await checkDatabaseHealth();
    databaseStatus = {
      status: pgHealth.status === "healthy" ? "healthy" : "unhealthy",
      type: "postgres",
      latencyMs: pgHealth.latencyMs,
      error: pgHealth.error,
    };
  } else {
    try {
      const jobCount = db.getJobs().length;
      databaseStatus = {
        status: process.env.NODE_ENV === "production" ? "degraded" : "healthy",
        type: "local_file",
        recordCount: jobCount,
        error:
          process.env.NODE_ENV === "production"
            ? "Running on file repository fallback. DATABASE_URL required for multi-instance production."
            : undefined,
      };
    } catch (err) {
      databaseStatus = {
        status: "unhealthy",
        type: "local_file",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // 2. Check Storage Provider
  let storageStatus: {
    provider: string;
    status: "healthy" | "unhealthy";
  };
  try {
    const storage = getStorageProvider();
    storageStatus = {
      provider: storage.name,
      status: "healthy",
    };
  } catch {
    storageStatus = {
      provider: process.env.STORAGE_PROVIDER || "unknown",
      status: "unhealthy",
    };
  }

  // 3. Check Auth Configuration
  const authAudit = validateAuthConfig();

  const isHealthy = databaseStatus.status !== "unhealthy" && storageStatus.status === "healthy";
  const statusCode = isHealthy ? 200 : 503;

  return NextResponse.json(
    {
      status: isHealthy ? "ok" : "unhealthy",
      environment: process.env.NODE_ENV || "development",
      timestamp,
      uptimeSeconds: Math.floor(uptime),
      services: {
        database: databaseStatus,
        storage: storageStatus,
        auth: {
          isConfigured: authAudit.isConfigured,
          isProductionReady: authAudit.isProductionReady,
          issuer: authAudit.configSummary.issuer,
          clientId: authAudit.configSummary.clientId,
        },
      },
    },
    { status: statusCode }
  );
}
