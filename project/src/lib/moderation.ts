/**
 * Soft client-side filter. Normalizes leetspeak / spacing so basic evasion is harder.
 * Still not a replacement for server-side review — just a better v1.
 */

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const HARD = [
  'kill yourself',
  'kys',
  'nigger',
  'faggot',
  'child porn',
  'buy followers',
  'cheap followers',
  'crypto giveaway',
];

const SOFT = ['hate speech', 'phishing scam', 'telegram scam'];

export type ModerationResult = {
  allowed: boolean;
  flagged: boolean;
  reason?: string;
};

export function moderateText(text: string): ModerationResult {
  const raw = (text ?? '').trim();
  if (!raw) return { allowed: true, flagged: false };

  const n = normalize(raw);
  const linkCount = (raw.match(/https?:\/\//gi) ?? []).length;
  if (linkCount >= 4) {
    return { allowed: false, flagged: true, reason: 'Too many links — looks like spam.' };
  }

  for (const phrase of HARD) {
    if (n.includes(phrase) || n.replace(/ /g, '').includes(phrase.replace(/ /g, ''))) {
      return { allowed: false, flagged: true, reason: 'This content violates Contrest community guidelines.' };
    }
  }
  for (const phrase of SOFT) {
    if (n.includes(phrase)) {
      return { allowed: true, flagged: true, reason: 'Flagged for review' };
    }
  }
  return { allowed: true, flagged: false };
}

export function isSafeMediaUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    if (url.length > 2048) return false;
    return true;
  } catch {
    return false;
  }
}

export const REPORT_REASONS = [
  'Spam or scam',
  'Hate or harassment',
  'Nudity or sexual content',
  'Violence or dangerous acts',
  'Misinformation',
  'Impersonation',
  'Other',
] as const;
