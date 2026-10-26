import test from "node:test";
import assert from "node:assert/strict";
import { resolveDeploymentBaseUrl, resolveRedirectUri, AUTH_CONFIG } from "../src/lib/auth/aitathastu.ts";
import { getStorageProvider, setStorageProvider, isEphemeralStorageAllowed } from "../src/lib/storage/index.ts";
import robots from "../src/app/robots.ts";
import sitemap from "../src/app/sitemap.ts";

test("Vercel Deployment 1: Dynamic OAuth Redirect URI Resolution", () => {
  const origEnv = { ...process.env };

  try {
    // 1. Explicit override takes precedence
    process.env.AVSAR_AUTH_REDIRECT_URI = "https://custom-auth.avsar.com/callback";
    assert.equal(resolveRedirectUri(), "https://custom-auth.avsar.com/callback");
    assert.equal(AUTH_CONFIG.redirectUri, "https://custom-auth.avsar.com/callback");

    // 2. Vercel deployment URL detection
    delete process.env.AVSAR_AUTH_REDIRECT_URI;
    process.env.VERCEL_URL = "avsar-preview-abc.vercel.app";
    assert.equal(resolveDeploymentBaseUrl(), "https://avsar-preview-abc.vercel.app");
    assert.equal(resolveRedirectUri(), "https://avsar-preview-abc.vercel.app/api/auth/aitathastu/callback");

    // 3. Vercel project production URL
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "avsar.careers";
    assert.equal(resolveDeploymentBaseUrl(), "https://avsar.careers");
    assert.equal(resolveRedirectUri(), "https://avsar.careers/api/auth/aitathastu/callback");

    // 4. NEXT_PUBLIC_APP_URL canonical configuration
    process.env.NEXT_PUBLIC_APP_URL = "https://www.avsar.ai";
    assert.equal(resolveDeploymentBaseUrl(), "https://www.avsar.ai");
    assert.equal(resolveRedirectUri(), "https://www.avsar.ai/api/auth/aitathastu/callback");

    // 5. Default localhost fallback
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;
    delete process.env.AVSAR_APP_URL;
    assert.equal(resolveDeploymentBaseUrl(), "http://localhost:3000");
    assert.equal(resolveRedirectUri(), "http://localhost:3000/api/auth/aitathastu/callback");
  } finally {
    process.env = origEnv;
  }
});

test("Vercel Deployment 2: Ephemeral Local Storage Rejection in Production", () => {
  const origEnv = { ...process.env };

  try {
    setStorageProvider(null);
    process.env.NODE_ENV = "production";
    delete process.env.STORAGE_BUCKET;
    delete process.env.S3_BUCKET;
    delete process.env.STORAGE_PROVIDER;
    delete process.env.ALLOW_EPHEMERAL_LOCAL_STORAGE;

    // Must throw error preventing silent data loss on serverless ephemeral disks
    assert.throws(() => {
      getStorageProvider();
    }, /Production deployment requires durable cloud object storage/);

    assert.equal(isEphemeralStorageAllowed(), false);

    // Explicit override for non-production preview/test containers
    setStorageProvider(null);
    process.env.ALLOW_EPHEMERAL_LOCAL_STORAGE = "true";
    assert.equal(isEphemeralStorageAllowed(), true);
    const provider = getStorageProvider();
    assert.equal(provider.name, "local");
  } finally {
    setStorageProvider(null);
    process.env = origEnv;
  }
});

test("Vercel Deployment 3: Dynamic Robots Metadata Rules", () => {
  const origEnv = { ...process.env };
  try {
    process.env.NEXT_PUBLIC_APP_URL = "https://avsar.ai";
    const rules = robots();

    assert.equal(rules.sitemap, "https://avsar.ai/sitemap.xml");
    const ruleSet = Array.isArray(rules.rules) ? rules.rules[0] : rules.rules;

    assert.ok(ruleSet.allow?.includes("/"));
    assert.ok(ruleSet.allow?.includes("/explore"));
    assert.ok(ruleSet.disallow?.includes("/api/"));
    assert.ok(ruleSet.disallow?.includes("/admin"));
    assert.ok(ruleSet.disallow?.includes("/profile"));
    assert.ok(ruleSet.disallow?.includes("/applications"));
  } finally {
    process.env = origEnv;
  }
});

test("Vercel Deployment 4: Dynamic Sitemap URL Indexation", async () => {
  const origEnv = { ...process.env };
  try {
    process.env.NEXT_PUBLIC_APP_URL = "https://avsar.ai";
    const mapEntries = await sitemap();

    assert.ok(Array.isArray(mapEntries));
    assert.ok(mapEntries.length >= 4);

    const urls = mapEntries.map((e) => e.url);
    assert.ok(urls.includes("https://avsar.ai"));
    assert.ok(urls.includes("https://avsar.ai/explore"));
    assert.ok(urls.includes("https://avsar.ai/home"));
    assert.ok(urls.includes("https://avsar.ai/welcome"));
  } finally {
    process.env = origEnv;
  }
});

test("Vercel Deployment 5: Next.js Configuration Security Headers & Compression", async () => {
  const { default: nextConfig } = await import("../next.config.ts");

  assert.equal(nextConfig.poweredByHeader, false);
  assert.equal(nextConfig.compress, true);
  assert.ok(typeof nextConfig.headers === "function");

  const headerRoutes = await nextConfig.headers();
  assert.ok(Array.isArray(headerRoutes));
  assert.equal(headerRoutes[0].source, "/(.*)");

  const headers = headerRoutes[0].headers;
  const headerMap = Object.fromEntries(headers.map((h) => [h.key, h.value]));

  assert.equal(headerMap["X-Content-Type-Options"], "nosniff");
  assert.equal(headerMap["X-Frame-Options"], "DENY");
  assert.equal(headerMap["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.ok(headerMap["Strict-Transport-Security"].includes("max-age="));
  assert.ok(headerMap["Permissions-Policy"].includes("camera=()"));
});

test("Vercel Deployment 6: Health Endpoint Route Configuration & Cache Directives", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const content = fs.readFileSync(path.resolve("src/app/api/health/route.ts"), "utf8");

  assert.ok(content.includes('export const dynamic = "force-dynamic";'));
  assert.ok(content.includes("export const revalidate = 0;"));
  assert.ok(content.includes("process.env.VERCEL"));
  assert.ok(content.includes("no-store, no-cache, must-revalidate"));
});

