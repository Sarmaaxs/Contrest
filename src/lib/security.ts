/**
 * Client-side security helpers.
 *
 * NONE of this replaces server-side enforcement — Supabase RLS policies and
 * Postgres constraints are the real trust boundary. This module exists to:
 *   1. Give honest users fast, friendly feedback (don't wait for a 429).
 *   2. Cut down on obvious spam/abuse and accidental foot-guns before a
 *      request ever leaves the browser.
 *   3. Make the failure modes (lockouts, oversized files, bad extensions)
 *      impossible to silently bypass through the normal UI.
 *
 * Patterns borrowed from products that do this well:
 *   - Login backoff: GitHub / Google progressively slow down repeated failed
 *     sign-in attempts from the same client instead of an outright ban.
 *   - Action cooldowns: major social platforms throttle rapid-fire posting,
 *     commenting and DMs client-side ("You are doing that too much").
 *   - Password strength meter: the same zxcvbn-style heuristics (length +
 *     character variety + common-password check) that Dropbox/GitHub use.
 */

// ---------------------------------------------------------------------------
// Generic rate limiter (sliding attempt counter with exponential backoff)
// ---------------------------------------------------------------------------

type AttemptRecord = { count: number; firstAttempt: number; lockedUntil: number };

const attemptStore = new Map<string, AttemptRecord>();

export type RateLimitResult = {
  allowed: boolean;
  /** ms remaining before the caller may try again, 0 if allowed now */
  retryAfterMs: number;
};

/**
 * Sliding-window limiter with exponential backoff, keyed by an arbitrary
 * string (e.g. `login:${email}` or `post-create:${userId}`).
 *
 * maxAttempts within windowMs are allowed before a lockout kicks in; each
 * lockout doubles (capped at maxLockoutMs) the same way GitHub/Google slow
 * down repeated failed logins rather than hard-banning the account.
 */
export function checkRateLimit(
  key: string,
  opts: { maxAttempts?: number; windowMs?: number; baseLockoutMs?: number; maxLockoutMs?: number } = {}
): RateLimitResult {
  const {
    maxAttempts = 5,
    windowMs = 60_000,
    baseLockoutMs = 5_000,
    maxLockoutMs = 5 * 60_000,
  } = opts;

  const now = Date.now();
  const rec = attemptStore.get(key);

  if (rec && now < rec.lockedUntil) {
    return { allowed: false, retryAfterMs: rec.lockedUntil - now };
  }

  if (!rec || now - rec.firstAttempt > windowMs) {
    attemptStore.set(key, { count: 1, firstAttempt: now, lockedUntil: 0 });
    return { allowed: true, retryAfterMs: 0 };
  }

  const count = rec.count + 1;
  if (count > maxAttempts) {
    // exponential backoff based on how many times we've locked before
    const overBy = count - maxAttempts;
    const lockoutMs = Math.min(baseLockoutMs * 2 ** (overBy - 1), maxLockoutMs);
    attemptStore.set(key, { ...rec, count, lockedUntil: now + lockoutMs });
    return { allowed: false, retryAfterMs: lockoutMs };
  }

  attemptStore.set(key, { ...rec, count });
  return { allowed: true, retryAfterMs: 0 };
}

/** Clears a rate-limit key — call on successful auth so real users never get stuck. */
export function resetRateLimit(key: string): void {
  attemptStore.delete(key);
}

export function formatRetryAfter(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.ceil(seconds / 60)}m`;
}

/** Simple fixed cooldown for spammy actions (post/comment/message creation). */
const cooldownStore = new Map<string, number>();

export function checkCooldown(key: string, cooldownMs: number): RateLimitResult {
  const now = Date.now();
  const last = cooldownStore.get(key) ?? 0;
  const elapsed = now - last;
  if (elapsed < cooldownMs) {
    return { allowed: false, retryAfterMs: cooldownMs - elapsed };
  }
  cooldownStore.set(key, now);
  return { allowed: true, retryAfterMs: 0 };
}

// ---------------------------------------------------------------------------
// Password strength
// ---------------------------------------------------------------------------

const COMMON_PASSWORDS = new Set([
  'password', 'password1', '12345678', '123456789', 'qwerty123', 'letmein',
  'iloveyou', 'admin123', 'welcome1', 'contrest', 'football', 'monkey123',
]);

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4; // weak -> strong
  label: 'Very weak' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  reasons: string[];
};

export function checkPasswordStrength(password: string): PasswordStrength {
  const reasons: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  else reasons.push('Use at least 8 characters');

  if (password.length >= 12) score++;

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  const varietyCount = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;

  if (varietyCount >= 3) score++;
  else reasons.push('Mix uppercase, lowercase, numbers and symbols');

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    score = 0;
    reasons.unshift('This password is too common');
  } else if (score < 4 && varietyCount >= 2 && password.length >= 10) {
    score++;
  }

  const clamped = Math.max(0, Math.min(4, score)) as PasswordStrength['score'];
  const labels: PasswordStrength['label'][] = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
  return { score: clamped, label: labels[clamped], reasons };
}

// ---------------------------------------------------------------------------
// Input hygiene
// ---------------------------------------------------------------------------

/** Character caps mirroring what real platforms enforce (platform-style). */
export const INPUT_LIMITS = {
  caption: 2200,
  comment: 500,
  message: 2000,
  bio: 150,
  username: 30,
  displayName: 50,
} as const;

/** Strip control characters and clamp length. Defense-in-depth; React already
 * escapes rendered output, this just prevents junk / overlong payloads. */
export function sanitizeText(input: string, maxLength: number): string {
  return input
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .slice(0, maxLength);
}
