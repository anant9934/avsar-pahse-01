import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { verifyCanaryHealth } from "../scripts/canary-health-check.mjs";

describe("Canary Deployment Health Gate & Verification", () => {
  it("approves healthy canary deployment when all probes return 200 within latency limit", async () => {
    const mockFetch = async (url) => {
      if (url.includes("/api/health/live")) {
        return {
          status: 200,
          json: async () => ({ status: "live" }),
        };
      }
      if (url.includes("/api/health/ready")) {
        return {
          status: 200,
          json: async () => ({ status: "ready", checks: { database: { ready: true } } }),
        };
      }
      if (url.includes("/api/jobs")) {
        return {
          status: 200,
          json: async () => ({ jobs: [] }),
        };
      }
      return { status: 404, json: async () => ({}) };
    };

    const result = await verifyCanaryHealth({
      baseUrl: "https://canary.avsar.local",
      maxP95Ms: 1000,
      fetchFn: mockFetch,
    });

    assert.equal(result.isHealthy, true);
    assert.equal(result.liveStatus, "live");
    assert.equal(result.readyStatus, "ready");
    assert.equal(result.errors.length, 0);
  });

  it("detects liveness probe failure and flags error", async () => {
    const mockFetch = async (url) => {
      if (url.includes("/api/health/live")) {
        return {
          status: 500,
          json: async () => ({ status: "error" }),
        };
      }
      return {
        status: 200,
        json: async () => ({ status: "ready", jobs: [] }),
      };
    };

    const result = await verifyCanaryHealth({
      fetchFn: mockFetch,
    });

    assert.equal(result.isHealthy, false);
    assert.ok(result.errors.some((e) => e.includes("Liveness probe failed with status 500")));
  });

  it("detects readiness failure when database is unready", async () => {
    const mockFetch = async (url) => {
      if (url.includes("/api/health/ready")) {
        return {
          status: 503,
          json: async () => ({ status: "unready" }),
        };
      }
      return {
        status: 200,
        json: async () => ({ status: "live", jobs: [] }),
      };
    };

    const result = await verifyCanaryHealth({
      fetchFn: mockFetch,
    });

    assert.equal(result.isHealthy, false);
    assert.ok(result.errors.some((e) => e.includes("Readiness probe failed with status 503")));
  });

  it("detects latency breach exceeding P95 threshold", async () => {
    const mockFetch = async (url) => {
      if (url.includes("/api/jobs")) {
        // Artificially delay response
        await new Promise((r) => setTimeout(r, 60));
        return {
          status: 200,
          json: async () => ({ jobs: [] }),
        };
      }
      return {
        status: 200,
        json: async () => ({ status: "live" }),
      };
    };

    // Set max latency to 20ms so 60ms exceeds threshold
    const result = await verifyCanaryHealth({
      maxP95Ms: 20,
      fetchFn: mockFetch,
    });

    assert.equal(result.isHealthy, false);
    assert.ok(result.errors.some((e) => e.includes("exceeded threshold")));
  });

  it("handles network connection rejection gracefully", async () => {
    const mockFetch = async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:3000");
    };

    const result = await verifyCanaryHealth({
      fetchFn: mockFetch,
    });

    assert.equal(result.isHealthy, false);
    assert.ok(result.errors.length >= 3);
    assert.ok(result.errors[0].includes("ECONNREFUSED"));
  });
});
