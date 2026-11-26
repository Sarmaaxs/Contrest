const KEY = 'contrest_cookie_consent';

export type ConsentChoice = 'all' | 'necessary';

export function getConsent(): ConsentChoice | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'all' || v === 'necessary' ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(choice: ConsentChoice): void {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    /* private browsing / storage disabled — banner will just reappear next visit */
  }
}

/** Analytics (Vercel Analytics) only loads once the person has actually
 * chosen "Accept all" — "necessary only" means no usage tracking, not just
 * a label on a banner nobody enforces. */
export function hasAnalyticsConsent(): boolean {
  return getConsent() === 'all';
}
