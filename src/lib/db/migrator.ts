import fs from "node:fs";
import path from "node:path";
import type { Pool, PoolClient } from "pg";
import { getPgPool, isPostgresConfigured } from "./postgres.ts";

export interface MigrationRecord {
  version: string;
  name: string;
  appliedAt: Date;
}

export interface DiscoveredMigration {
  version: string;
  name: string;
  filename: string;
  filepath: string;
}

export interface MigrationRunResult {
  applied: DiscoveredMigration[];
  alreadyApplied: string[];
  dryRun: boolean;
}

export class MigrationError extends Error {
  version: string;
  cause?: unknown;

  constructor(message: string, version: string, cause?: unknown) {
    super(message);
    this.name = "MigrationError";
    this.version = version;
    this.cause = cause;
  }
}

/**
 * Ensures the schema_migrations tracking ledger exists.
 */
export async function ensureMigrationsTable(client: PoolClient | Pool): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(50) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

/**
 * Retrieves all previously applied migration versions.
 */
export async function getAppliedMigrations(client: PoolClient | Pool): Promise<MigrationRecord[]> {
  await ensureMigrationsTable(client);
  const result = await client.query<{ version: string; name: string; applied_at: Date }>(
    `SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC`
  );

  return result.rows.map((row) => ({
    version: row.version,
    name: row.name,
    appliedAt: row.applied_at,
  }));
}

/**
 * Discovers and sorts SQL migration files in the designated directory.
 */
export function discoverMigrationFiles(migrationsDir: string): DiscoveredMigration[] {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  const files = fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  return files.map((filename) => {
    const parts = filename.replace(/\.sql$/, "").split("_");
    const version = parts[0];
    const name = parts.slice(1).join("_") || version;
    return {
      version,
      name,
      filename,
      filepath: path.join(migrationsDir, filename),
    };
  });
}

/**
 * Executes all pending database schema migrations in strict versioned sequence.
 */
export async function runPendingMigrations(options: {
  migrationsDir?: string;
  dryRun?: boolean;
  pool?: Pool;
} = {}): Promise<MigrationRunResult> {
  const migrationsDir =
    options.migrationsDir ||
    path.join(process.cwd(), "scripts", "migrations");
  const dryRun = Boolean(options.dryRun);

  const discovered = discoverMigrationFiles(migrationsDir);
  const applied: DiscoveredMigration[] = [];

  if (!isPostgresConfigured() && !options.pool) {
    return {
      applied: [],
      alreadyApplied: [],
      dryRun,
    };
  }

  const pool = options.pool || getPgPool();
  const client = await pool.connect();

  try {
    await ensureMigrationsTable(client);
    const existing = await getAppliedMigrations(client);
    const existingVersions = new Set(existing.map((m) => m.version));

    for (const migration of discovered) {
      if (existingVersions.has(migration.version)) {
        continue;
      }

      if (dryRun) {
        applied.push(migration);
        continue;
      }

      const sql = fs.readFileSync(migration.filepath, "utf8");

      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          `INSERT INTO schema_migrations (version, name) VALUES ($1, $2)
           ON CONFLICT (version) DO NOTHING`,
          [migration.version, migration.name]
        );
        await client.query("COMMIT");
        applied.push(migration);
      } catch (err) {
        await client.query("ROLLBACK");
        throw new MigrationError(
          `Failed executing migration ${migration.filename}: ${err instanceof Error ? err.message : String(err)}`,
          migration.version,
          err
        );
      }
    }

    return {
      applied,
      alreadyApplied: Array.from(existingVersions),
      dryRun,
    };
  } finally {
    client.release();
  }
}
