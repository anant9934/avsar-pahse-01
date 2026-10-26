import test from "node:test";
import assert from "node:assert/strict";
import {
  getReadDatabaseUrl,
  hasDedicatedReadReplica,
  getReadPool,
  getWritePool,
  queryRead,
  resetPoolsForTesting,
} from "../src/lib/db/read-replica.ts";
import { DatabaseUnavailableError, closePgPool, setGlobalPool } from "../src/lib/db/postgres.ts";

test("ReadReplica: detects dedicated replica URL when configured", () => {
  const origRead = process.env.POSTGRES_READ_URL;
  try {
    delete process.env.POSTGRES_READ_URL;
    delete process.env.DATABASE_READ_URL;
    assert.equal(hasDedicatedReadReplica(), false);
    assert.equal(getReadDatabaseUrl(), null);

    process.env.POSTGRES_READ_URL = "postgres://user:pass@ep-replica-pooler.neon.tech/avsar";
    assert.equal(hasDedicatedReadReplica(), true);
    assert.equal(
      getReadDatabaseUrl(),
      "postgres://user:pass@ep-replica-pooler.neon.tech/avsar"
    );
  } finally {
    if (origRead) process.env.POSTGRES_READ_URL = origRead;
    else delete process.env.POSTGRES_READ_URL;
  }
});

test("ReadReplica: getReadPool returns primary pool when no replica configured", async () => {
  const origDb = process.env.DATABASE_URL;
  const origRead = process.env.POSTGRES_READ_URL;
  try {
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/avsar";
    delete process.env.POSTGRES_READ_URL;
    delete process.env.DATABASE_READ_URL;

    setGlobalPool(null);
    await resetPoolsForTesting();

    const readPool = getReadPool();
    const writePool = getWritePool();

    assert.equal(readPool, writePool, "Read pool should fall back to primary write pool");
  } finally {
    if (origDb) process.env.DATABASE_URL = origDb;
    else delete process.env.DATABASE_URL;
    if (origRead) process.env.POSTGRES_READ_URL = origRead;
    else delete process.env.POSTGRES_READ_URL;
    await resetPoolsForTesting();
    setGlobalPool(null);
  }
});

test("ReadReplica: queryRead rejects when PostgreSQL is not configured", async () => {
  const origDb = process.env.DATABASE_URL;
  try {
    delete process.env.DATABASE_URL;
    await assert.rejects(
      async () => {
        await queryRead("SELECT 1");
      },
      (err) => err instanceof DatabaseUnavailableError
    );
  } finally {
    if (origDb) process.env.DATABASE_URL = origDb;
  }
});
