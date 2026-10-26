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

/**
 * Sanitize external application links (job application URLs, recruiter contacts).
 * Strictly permits https://, http://, and mailto: protocols.
 * Rejects javascript:, data:, vbscript:, file:, control characters, and unparseable URLs.
 */
export function sanitizeExternalUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl || typeof rawUrl !== "string") {
    return null;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return null;
  }

  // Reject control characters (0x00 - 0x1F, 0x7F)
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return null;
  }

  // Mailto link check
  if (trimmed.toLowerCase().startsWith("mailto:")) {
    const target = trimmed.slice(7).trim();
    if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(target)) {
      return `mailto:${target}`;
    }
    return null;
  }

  // Explicitly reject dangerous schemes before URL parsing
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("file:")
  ) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    // Only accept https: and http:
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }

    // Must have a valid hostname
    if (!parsed.hostname || parsed.hostname.length < 1) {
      return null;
    }

    // Reject usernames or passwords in URLs (e.g. http://attacker@legit.com)
    if (parsed.username || parsed.password) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}
