import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time string comparison to prevent side-channel timing attacks.
 * Pre-hashes inputs using SHA-256 to guarantee fixed 32-byte buffers,
 * completely eliminating early-return secret length leakage.
 */
export function safeCompare(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }

  try {
    const hashA = createHash("sha256").update(a, "utf-8").digest();
    const hashB = createHash("sha256").update(b, "utf-8").digest();
    return timingSafeEqual(hashA, hashB);
  } catch {
    return false;
  }
}
