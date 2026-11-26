const PREFIX = 'contrest_feed_cache_';
const MAX_CACHED_POSTS = 12;

/**
 * social apps often paint the last feed you saw immediately when you
 * reopen the app, then quietly refresh in the background — you're never
 * staring at an empty skeleton if you already have something to show. This
 * is the same idea, done with localStorage since there's no service worker
 * in this app: cache a small snapshot of the feed, paint it instantly on
 * next visit, then let the real network fetch replace it once it lands.
 *
 * Only post metadata is cached (captions, counts, media URLs as text) —
 * actual images/video bytes are the browser's own HTTP cache to worry
 * about, not ours to duplicate into localStorage.
 */
export function getCachedFeed<T>(userId: string, tab: string): T[] | null {
  try {
    const raw = localStorage.getItem(PREFIX + userId + '_' + tab);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

export function setCachedFeed<T>(userId: string, tab: string, posts: T[]): void {
  try {
    localStorage.setItem(PREFIX + userId + '_' + tab, JSON.stringify(posts.slice(0, MAX_CACHED_POSTS)));
  } catch {
    /* storage full/disabled — just means no instant-paint next visit, not fatal */
  }
}
