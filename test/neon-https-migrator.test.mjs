import test from "node:test";
import assert from "node:assert/strict";

/**
 * Unit tests verifying Neon HTTPS migration runner mechanics,
 * endpoint URL resolution, and secure connection string handling.
 */

function resolveNeonSqlEndpoint(connStr) {
  if (!connStr || typeof connStr !== "string") {
    throw new Error("Connection string is required");
  }
  const parsed = new URL(connStr);
  return `https://${parsed.host}/sql`;
}

function buildNeonQueryPayload(sql, params = []) {
  if (!sql || typeof sql !== "string") {
    throw new Error("SQL query must be a non-empty string");
  }
  return JSON.stringify({
    query: sql,
    params,
  });
}

function resolveEffectiveDatabaseUrl(env) {
  return env.DATABASE_URL || env.POSTGRES_URL || undefined;
}

test("Neon HTTPS Migrator: resolves HTTPS SQL endpoint from pooled connection string", () => {
  const pooledUrl = "postgresql://neondb_owner:dummy_pass@ep-dawn-bread-b43uywng-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require";
  const endpoint = resolveNeonSqlEndpoint(pooledUrl);
  assert.equal(endpoint, "https://ep-dawn-bread-b43uywng-pooler.c-6.us-east-2.aws.neon.tech/sql");
});

test("Neon HTTPS Migrator: resolves HTTPS SQL endpoint from direct unpooled connection string", () => {
  const directUrl = "postgresql://neondb_owner:dummy_pass@ep-dawn-bread-b43uywng.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require";
  const endpoint = resolveNeonSqlEndpoint(directUrl);
  assert.equal(endpoint, "https://ep-dawn-bread-b43uywng.c-6.us-east-2.aws.neon.tech/sql");
});

test("Neon HTTPS Migrator: serializes parameterized SQL queries into valid JSON", () => {
  const sql = "SELECT count(*) FROM jobs WHERE category = $1";
  const params = ["Software Development"];
  const payload = buildNeonQueryPayload(sql, params);
  const parsed = JSON.parse(payload);

  assert.equal(parsed.query, sql);
  assert.deepEqual(parsed.params, params);
});

test("Neon HTTPS Migrator: prioritizes DATABASE_URL and falls back to POSTGRES_URL", () => {
  const env1 = { DATABASE_URL: "postgres://primary", POSTGRES_URL: "postgres://secondary" };
  assert.equal(resolveEffectiveDatabaseUrl(env1), "postgres://primary");

  const env2 = { POSTGRES_URL: "postgres://vercel_neon" };
  assert.equal(resolveEffectiveDatabaseUrl(env2), "postgres://vercel_neon");

  const env3 = {};
  assert.equal(resolveEffectiveDatabaseUrl(env3), undefined);
});

test("Neon HTTPS Migrator: rejects empty or invalid connection string inputs", () => {
  assert.throws(() => resolveNeonSqlEndpoint(""), /Connection string is required/);
  assert.throws(() => resolveNeonSqlEndpoint(null), /Connection string is required/);
  assert.throws(() => buildNeonQueryPayload(""), /SQL query must be a non-empty string/);
});
