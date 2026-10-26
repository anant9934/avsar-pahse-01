import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateCacheKey,
  CACHE_SCHEMA_VERSION,
  UnsafePrivateCacheKeyError,
} from "../src/lib/cache/key-generator.ts";

describe("Cache Key Generator with Schema Versioning & Private Scoping", () => {
  it("prefixes cache keys with schema version", () => {
    const key = generateCacheKey("jobs");
    assert.equal(key, `avsar:${CACHE_SCHEMA_VERSION}:jobs:all`);

    const customKey = generateCacheKey("jobs", undefined, { version: "v2" });
    assert.equal(customKey, "avsar:v2:jobs:all");
  });

  it("normalizes parameter ordering into identical keys", () => {
    const keyA = generateCacheKey("jobs:search", { q: "engineer", location: "remote" });
    const keyB = generateCacheKey("jobs:search", { location: "remote", q: "engineer" });
    assert.equal(keyA, keyB);
  });

  it("hashes parameters exceeding 64 characters", () => {
    const key = generateCacheKey("jobs:filter", {
      longDescriptionFilter: "very_long_string_with_many_nested_attributes_that_exceeds_sixty_four_characters",
    });
    assert.ok(key.includes(":h_"));
    assert.ok(key.startsWith(`avsar:${CACHE_SCHEMA_VERSION}:jobs:filter:h_`));
  });

  it("throws UnsafePrivateCacheKeyError when private namespace lacks candidateId", () => {
    assert.throws(
      () => {
        generateCacheKey("profile", { status: "active" });
      },
      (err) => err instanceof UnsafePrivateCacheKeyError
    );

    assert.throws(
      () => {
        generateCacheKey("applications");
      },
      (err) => err instanceof UnsafePrivateCacheKeyError
    );
  });

  it("allows private namespace when candidateId is explicitly scoped", () => {
    const key = generateCacheKey("profile", { candidateId: "cand-12345" });
    assert.ok(key.includes("cand-12345"));
    assert.ok(key.startsWith(`avsar:${CACHE_SCHEMA_VERSION}:profile:`));
  });
});
