interface RateLimitTracker {
  attempts: number;
  firstAttemptAt: number;
}

const loginAttempts = new Map<string, RateLimitTracker>();

export function checkAdminRateLimit(ipOrKey: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000; // 5 minutes
  const maxAttempts = 10;

  const tracker = loginAttempts.get(ipOrKey);
  if (!tracker) {
    loginAttempts.set(ipOrKey, { attempts: 1, firstAttemptAt: now });
    return { allowed: true };
  }

  if (now - tracker.firstAttemptAt > windowMs) {
    // Reset window
    loginAttempts.set(ipOrKey, { attempts: 1, firstAttemptAt: now });
    return { allowed: true };
  }

  tracker.attempts += 1;
  if (tracker.attempts > maxAttempts) {
    const retryAfter = Math.ceil((tracker.firstAttemptAt + windowMs - now) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfter) };
  }

  return { allowed: true };
}

export function resetAdminRateLimits(): void {
  loginAttempts.clear();
}
