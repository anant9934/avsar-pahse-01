import { NextResponse } from "next/server";
import { checkDatabaseHealth, isPostgresConfigured } from "@/lib/db/postgres";
import { getStorageProvider } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Dependency Readiness Probe (RFC 8615 / Kubernetes standard)
 * 
 * Verifies that the platform's core persistent dependencies (PostgreSQL database
 * and private object storage provider) are operational and capable of serving traffic.
 */
export async function GET() {
  const timestamp = new Date().toISOString();

  // 1. Verify Primary Database Readiness
  let databaseReady = false;
  let databaseType: string = "unconfigured";

  if (isPostgresConfigured()) {
    const dbHealth = await checkDatabaseHealth();
    databaseReady = dbHealth.status === "healthy";
    databaseType = dbHealth.provider || "postgres";
  } else if (process.env.NODE_ENV === "production") {
    // In production, failure to configure PostgreSQL is a fatal readiness blocker
    databaseReady = false;
    databaseType = "unconfigured";
  } else {
    // Local development fallback
    databaseReady = true;
    databaseType = "local_file";
  }

  // 2. Verify Storage Provider Readiness
  let storageReady = false;
  let storageProviderName = "unconfigured";

  try {
    const storage = getStorageProvider();
    storageReady = Boolean(storage);
    storageProviderName = storage.name;
  } catch {
    storageReady = false;
  }

  const isReady = databaseReady && storageReady;
  const statusCode = isReady ? 200 : 503;

  return NextResponse.json(
    {
      status: isReady ? "ready" : "unready",
      timestamp,
      checks: {
        database: {
          ready: databaseReady,
          type: databaseType,
        },
        storage: {
          ready: storageReady,
          provider: storageProviderName,
        },
      },
    },
    {
      status: statusCode,
      headers: {
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        "X-Health-Check": "readiness",
      },
    }
  );
}
