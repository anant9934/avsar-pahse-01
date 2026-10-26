/**
 * Validate all return destinations against a strict same-origin relative-path policy.
 * Rejects absolute external URLs, protocol-relative URLs, backslash escapes, and malformed encodings.
 */
export function sanitizeReturnTo(rawReturnTo: string | null | undefined, defaultPath = "/home"): string {
  if (!rawReturnTo || typeof rawReturnTo !== "string") {
    return defaultPath;
  }

  const trimmed = rawReturnTo.trim();

  // 1. Must start with exactly one forward slash
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return defaultPath;
  }

  // 2. Reject backslashes (Windows path bypass: /\evil.com, /\\evil.com)
  if (trimmed.includes("\\")) {
    return defaultPath;
  }

  // 3. Reject encoded backslashes (%5C, %5c) and encoded forward slashes (%2F, %2f)
  if (/%2f|%5c/i.test(trimmed)) {
    return defaultPath;
  }

  // Decode check to catch nested/double encoding (%252f -> %2f -> /)
  try {
    const decoded = decodeURIComponent(trimmed);
    if (
      decoded.includes("\\") ||
      decoded.startsWith("//") ||
      /%2f|%5c/i.test(decoded)
    ) {
      return defaultPath;
    }
  } catch {
    return defaultPath;
  }

  // 4. Reject control characters, newlines, tabs (CRLF injection)
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return defaultPath;
  }

  // 5. Must parse as valid pathname without scheme, host, or port
  try {
    const parsed = new URL(trimmed, "http://localhost");
    if (parsed.host !== "localhost" || !parsed.pathname.startsWith("/")) {
      return defaultPath;
    }
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return defaultPath;
  }
}
