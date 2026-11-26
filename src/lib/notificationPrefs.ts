const KEYS = {
  like: 'contrest_notif_likes',
  comment: 'contrest_notif_comments',
  follow: 'contrest_notif_follows',
  message: 'contrest_notif_msgs',
} as const;

type NotificationPreference = keyof typeof KEYS;

export function notificationsEnabled(type: string): boolean {
  const key = KEYS[type as NotificationPreference];
  if (!key) return true;
  try {
    const value = localStorage.getItem(key);
    return value === null || value === '1';
  } catch {
    return true;
  }
}
