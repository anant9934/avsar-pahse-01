import { NextResponse } from "next/server";
import { checkDatabaseHealth, isPostgresConfigured } from "@/lib/db/postgres";
import { getStorageProvider } from "@/lib/storage";
import { validateAuthConfig } from "@/lib/auth/aitathastu";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const uptime = process.uptime();
  const timestamp = new Date().toISOString();

  // 1. Check Database Health
  let databaseStatus: {
    status: "healthy" | "unhealthy";
    type: "neon" | "postgres" | "local_file" | "unconfigured";
    isPooled?: boolean;
    latencyMs?: number;
    recordCount?: number;
    error?: string;
  };

  if (isPostgresConfigured()) {
    const pgHealth = await checkDatabaseHealth();
    databaseStatus = {
      status: pgHealth.status,
      type: pgHealth.provider || "postgres",
      isPooled: pgHealth.isPooled,
      latencyMs: pgHealth.latencyMs,
      error: pgHealth.error,
    };
  } else if (process.env.NODE_ENV === "production") {
    // Production strictly requires Neon PostgreSQL; ephemeral file storage is rejected
    databaseStatus = {
      status: "unhealthy",
      type: "unconfigured",
      error: "CRITICAL: DATABASE_URL is required in production environment. Ephemeral local storage is prohibited.",
    };
  } else {
    try {
      const jobCount = db.getJobs().length;
      databaseStatus = {
        status: "healthy",
        type: "local_file",
        recordCount: jobCount,
      };
    } catch (err) {
      databaseStatus = {
        status: "unhealthy",
        type: "local_file",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // 2. Check Storage Provider Health
  let storageStatus: {
    provider: string;
    status: "healthy" | "unhealthy";
    error?: string;
  };
  try {
    const storage = getStorageProvider();
    storageStatus = {
      provider: storage.name,
      status: "healthy",
    };
  } catch (storageErr) {
    storageStatus = {
      provider: process.env.STORAGE_PROVIDER || "unconfigured",
      status: "unhealthy",
      error: storageErr instanceof Error ? storageErr.message : String(storageErr),
    };
  }

  // 3. Check Auth Configuration
  const authAudit = validateAuthConfig();

  const isHealthy = databaseStatus.status !== "unhealthy" && storageStatus.status === "healthy";
  const statusCode = isHealthy ? 200 : 503;

  return NextResponse.json(
    {
      status: isHealthy ? "ok" : "unhealthy",
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
      timestamp,
      uptimeSeconds: Math.floor(uptime),
      deployment: {
        platform: process.env.VERCEL ? "vercel" : "node",
        region: process.env.VERCEL_REGION || null,
        vercelEnv: process.env.VERCEL_ENV || null,
      },
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
    {
      status: statusCode,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}
