import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { safeCompare } from "../src/lib/auth/timing-safe.ts";

describe("Constant-Time String Comparison (Timing Attack Protection)", () => {
  it("returns true for identical strings", () => {
    assert.equal(safeCompare("admin-secret-key-12345", "admin-secret-key-12345"), true);
    assert.equal(safeCompare("simple", "simple"), true);
  });

  it("returns false for different strings of identical length", () => {
    assert.equal(safeCompare("admin-secret-key-12345", "admin-secret-key-12349"), false);
    assert.equal(safeCompare("AAAA", "BBBB"), false);
  });

  it("returns false for strings of differing length without length timing leaks", () => {
    assert.equal(safeCompare("short", "much-longer-string-with-many-characters"), false);
    assert.equal(safeCompare("secret", "sec"), false);
    assert.equal(safeCompare("sec", "secret"), false);
  });

  it("returns false safely when arguments are null, undefined, or non-string", () => {
    assert.equal(safeCompare(null, "secret"), false);
    assert.equal(safeCompare("secret", null), false);
    assert.equal(safeCompare(undefined, "secret"), false);
    assert.equal(safeCompare("secret", undefined), false);
    assert.equal(safeCompare(null, null), false);
  });

  it("handles high-entropy secrets and UTF-8 multi-byte characters", () => {
    const unicodeA = "avsar-secure-पंजीकरण-token";
    const unicodeB = "avsar-secure-पंजीकरण-token";
    const unicodeC = "avsar-secure-पंजीकरण-other";

    assert.equal(safeCompare(unicodeA, unicodeB), true);
    assert.equal(safeCompare(unicodeA, unicodeC), false);
  });
});
