import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  discoverMigrationFiles,
  ensureMigrationsTable,
  getAppliedMigrations,
  runPendingMigrations,
  MigrationError,
} from "../src/lib/db/migrator.ts";

describe("Database Migrator", () => {
  describe("discoverMigrationFiles", () => {
    it("discovers existing repository migrations in sorted order", () => {
      const migrationsDir = path.join(process.cwd(), "scripts", "migrations");
      const files = discoverMigrationFiles(migrationsDir);

      assert.ok(files.length >= 2, "Expected at least 2 migrations in scripts/migrations");
      assert.equal(files[0].version, "002");
      assert.equal(files[0].name, "concurrency_indexes");
      assert.equal(files[1].version, "003");
      assert.equal(files[1].name, "application_concurrency_lock");
    });

    it("returns empty array for non-existent directory", () => {
      const files = discoverMigrationFiles("/tmp/nonexistent-migration-dir-12345");
      assert.deepEqual(files, []);
    });

    it("verifies ensureMigrationsTable and getAppliedMigrations queries", async () => {
      const executed = [];
      const mockClient = {
        query: async (sql) => {
          executed.push(sql.trim());
          if (sql.includes("SELECT version, name")) {
            return {
              rows: [{ version: "001", name: "init", applied_at: new Date() }],
            };
          }
          return { rows: [] };
        },
      };

      await ensureMigrationsTable(mockClient);
      const applied = await getAppliedMigrations(mockClient);

      assert.ok(executed.some((q) => q.includes("CREATE TABLE IF NOT EXISTS schema_migrations")));
      assert.equal(applied.length, 1);
      assert.equal(applied[0].version, "001");
    });
  });

  describe("runPendingMigrations transactional logic", () => {
    it("skips execution when dryRun is true", async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "migration-test-"));
      fs.writeFileSync(path.join(tempDir, "001_initial.sql"), "CREATE TABLE test_tab (id INT);");
      fs.writeFileSync(path.join(tempDir, "002_add_col.sql"), "ALTER TABLE test_tab ADD col TEXT;");

      const queries = [];
      const mockClient = {
        query: async (sql, params) => {
          queries.push({ sql, params });
          if (sql.includes("SELECT version, name")) {
            return { rows: [] };
          }
          return { rows: [] };
        },
        release: () => {},
      };

      const mockPool = {
        connect: async () => mockClient,
      };

      const result = await runPendingMigrations({
        migrationsDir: tempDir,
        dryRun: true,
        pool: mockPool,
      });

      assert.equal(result.dryRun, true);
      assert.equal(result.applied.length, 2);
      assert.equal(result.applied[0].version, "001");
      assert.equal(result.applied[1].version, "002");

      // Verify no BEGIN or COMMIT queries were executed in dry-run
      const hasBegin = queries.some((q) => q.sql === "BEGIN");
      assert.equal(hasBegin, false);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("executes pending migrations transactionally and records them in ledger", async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "migration-exec-"));
      fs.writeFileSync(path.join(tempDir, "001_create.sql"), "CREATE TABLE demo (id INT);");

      const queries = [];
      const appliedLedger = [];

      const mockClient = {
        query: async (sql, params) => {
          queries.push({ sql: sql.trim(), params });
          if (sql.includes("SELECT version, name")) {
            return { rows: [...appliedLedger] };
          }
          if (sql.includes("INSERT INTO schema_migrations")) {
            appliedLedger.push({ version: params[0], name: params[1], applied_at: new Date() });
          }
          return { rows: [] };
        },
        release: () => {},
      };

      const mockPool = {
        connect: async () => mockClient,
      };

      const result = await runPendingMigrations({
        migrationsDir: tempDir,
        pool: mockPool,
      });

      assert.equal(result.applied.length, 1);
      assert.equal(result.applied[0].version, "001");

      const sqlSequence = queries.map((q) => q.sql);
      assert.ok(sqlSequence.includes("BEGIN"));
      assert.ok(sqlSequence.includes("CREATE TABLE demo (id INT);"));
      assert.ok(sqlSequence.includes("COMMIT"));

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("rolls back transaction on SQL failure and throws MigrationError", async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "migration-fail-"));
      fs.writeFileSync(path.join(tempDir, "001_bad.sql"), "SYNTAX ERROR STATEMENT;");

      const queries = [];
      const mockClient = {
        query: async (sql) => {
          queries.push(sql.trim());
          if (sql.includes("SELECT version, name")) {
            return { rows: [] };
          }
          if (sql.includes("SYNTAX ERROR")) {
            throw new Error("syntax error at or near 'SYNTAX'");
          }
          return { rows: [] };
        },
        release: () => {},
      };

      const mockPool = {
        connect: async () => mockClient,
      };

      await assert.rejects(
        async () => {
          await runPendingMigrations({
            migrationsDir: tempDir,
            pool: mockPool,
          });
        },
        (err) => {
          assert.ok(err instanceof MigrationError);
          assert.equal(err.version, "001");
          return true;
        }
      );

      assert.ok(queries.includes("ROLLBACK"));

      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });
});
