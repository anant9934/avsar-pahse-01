import test from "node:test";
import assert from "node:assert/strict";
import {
  isNeonDatabase,
  isNeonPooledConnection,
  maskConnectionString,
  getDatabaseProviderInfo,
  DatabaseConfigurationError,
  getPgPool,
  setGlobalPool,
  withTransaction,
} from "../src/lib/db/postgres.ts";
import { newDb } from "pg-mem";
import { randomUUID } from "node:crypto";

test("Unit: isNeonDatabase accurately identifies Neon hostnames", () => {
  const neonDirect = "postgresql://avsar_user:pass123@ep-cool-mountain-123456.us-east-2.aws.neon.tech/avsar?sslmode=require";
  const neonPooled = "postgresql://avsar_user:pass123@ep-cool-mountain-123456-pooler.us-east-2.aws.neon.tech/avsar?sslmode=require";
  const rdsUrl = "postgresql://admin:pass@production-db.c012345.us-east-1.rds.amazonaws.com:5432/avsar";
  const localUrl = "postgresql://postgres:postgres@localhost:5432/avsar";

  assert.equal(isNeonDatabase(neonDirect), true);
  assert.equal(isNeonDatabase(neonPooled), true);
  assert.equal(isNeonDatabase(rdsUrl), false);
  assert.equal(isNeonDatabase(localUrl), false);
  assert.equal(isNeonDatabase(""), false);
  assert.equal(isNeonDatabase(undefined), false);
});

test("Unit: isNeonPooledConnection distinguishes Neon pooler from direct compute", () => {
  const neonPooled = "postgresql://avsar_user:pass123@ep-cool-mountain-123456-pooler.us-east-2.aws.neon.tech/avsar?sslmode=require";
  const neonDirect = "postgresql://avsar_user:pass123@ep-cool-mountain-123456.us-east-2.aws.neon.tech/avsar?sslmode=require";
  const otherPooler = "postgresql://admin:pass@pgbouncer.internal:6432/avsar";

  assert.equal(isNeonPooledConnection(neonPooled), true);
  assert.equal(isNeonPooledConnection(neonDirect), false);
  assert.equal(isNeonPooledConnection(otherPooler), false);
});

test("Unit: maskConnectionString prevents database credentials from leaking in logs", () => {
  const original = "postgresql://avsar_admin:SuperSecretPassword99@ep-xyz-pooler.us-east-2.aws.neon.tech/avsar?sslmode=require";
  const masked = maskConnectionString(original);

  assert.ok(!masked.includes("SuperSecretPassword99"), "Password must not be present in masked string");
  assert.ok(masked.includes("******"), "Password must be replaced by asterisks");
  assert.ok(masked.includes("avsar_admin"), "Username should remain visible for debugging");
  assert.ok(masked.includes("ep-xyz-pooler.us-east-2.aws.neon.tech"), "Host should remain visible");
});

test("Unit: getDatabaseProviderInfo returns telemetry metadata safely", () => {
  const prevUrl = process.env.DATABASE_URL;
  try {
    process.env.DATABASE_URL = "postgresql://app_user:p@ss@ep-sample-pooler.ap-southeast-1.aws.neon.tech/avsar?sslmode=require";
    const info = getDatabaseProviderInfo();

    assert.equal(info.provider, "neon");
    assert.equal(info.isPooled, true);
    assert.equal(info.host, "ep-sample-pooler.ap-southeast-1.aws.neon.tech");
    assert.equal(info.isProductionReady, true);
  } finally {
    process.env.DATABASE_URL = prevUrl;
  }
});

test("Unit: Production environment rejects unconfigured DATABASE_URL without silent fallback", () => {
  const prevEnv = process.env.NODE_ENV;
  const prevUrl = process.env.DATABASE_URL;
  setGlobalPool(null);

  try {
    process.env.NODE_ENV = "production";
    delete process.env.DATABASE_URL;

    assert.throws(
      () => getPgPool(),
      DatabaseConfigurationError,
      "Production must throw DatabaseConfigurationError when DATABASE_URL is missing"
    );
  } finally {
    process.env.NODE_ENV = prevEnv;
    process.env.DATABASE_URL = prevUrl;
    setGlobalPool(null);
  }
});

test("Integration: withTransaction performs atomic rollback on failure", async () => {
  const memDb = newDb();
  memDb.public.registerFunction({
    name: "gen_random_uuid",
    returns: memDb.public.getType("text"),
    implementation: () => randomUUID(),
  });

  let snapshot = null;
  memDb.public.interceptQueries((sql) => {
    const s = sql.trim().toUpperCase();
    if (s === "BEGIN") {
      snapshot = memDb.backup();
      return [];
    }
    if (s === "ROLLBACK") {
      if (snapshot) snapshot.restore();
      snapshot = null;
      return [];
    }
    if (s === "COMMIT") {
      snapshot = null;
      return [];
    }
    return null;
  });

  const { Pool } = memDb.adapters.createPg();
  const pool = new Pool();
  setGlobalPool(pool);

  try {
    await pool.query("CREATE TABLE test_tx_accounts (id TEXT PRIMARY KEY, balance INT);");
    await pool.query("INSERT INTO test_tx_accounts VALUES ('acc_1', 100);");

    await assert.rejects(async () => {
      await withTransaction(async (client) => {
        await client.query("UPDATE test_tx_accounts SET balance = balance - 50 WHERE id = 'acc_1'");
        throw new Error("Simulated failure inside transaction");
      });
    }, /Simulated failure inside transaction/);

    const check = await pool.query("SELECT balance FROM test_tx_accounts WHERE id = 'acc_1'");
    assert.equal(check.rows[0].balance, 100, "Balance must remain unchanged after rollback");
  } finally {
    setGlobalPool(null);
  }
});
