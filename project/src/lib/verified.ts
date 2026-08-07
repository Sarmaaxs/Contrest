const VERIFIED_USERNAMES = new Set(
  ['sarmaxs', 'contrest', 'sarem', 'hyder'].map((s) => s.toLowerCase())
);

const VERIFIED_EMAILS = new Set(
  ['supportsarmaxstream@gmail.com'].map((s) => s.toLowerCase())
);

export function isVerifiedUsername(username?: string | null): boolean {
  if (!username) return false;
  return VERIFIED_USERNAMES.has(username.toLowerCase().replace(/^@/, ''));
}

export function isVerifiedEmail(email?: string | null): boolean {
  if (!email) return false;
  return VERIFIED_EMAILS.has(email.toLowerCase());
}

export function isVerified(opts: { username?: string | null; email?: string | null }): boolean {
  return isVerifiedUsername(opts.username) || isVerifiedEmail(opts.email);
}
