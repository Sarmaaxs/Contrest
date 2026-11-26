import { supabase } from '@/lib/supabase';
import { notificationsEnabled } from '@/lib/notificationPrefs';

type NotificationRow = {
  user_id: string;
  actor_id: string;
  type: 'follow' | 'like' | 'comment' | 'login_alert' | 'suggestion';
  message: string;
  post_id?: string;
};

// Protect the client from accidental notification storms when an interaction
// fires more than once during a render/realtime update. The database remains
// the source of truth; this is only a short client-side guard.
const recent = new Map<string, number>();
const DEDUPE_MS = 15_000;

export async function notify(row: NotificationRow) {
  if (row.user_id === row.actor_id && row.type !== 'login_alert') return { error: null };
  if (!notificationsEnabled(row.type)) return { error: null };

  const key = `${row.user_id}:${row.actor_id}:${row.type}:${row.post_id ?? ''}`;
  const now = Date.now();
  const previous = recent.get(key);
  if (previous && now - previous < DEDUPE_MS) return { error: null };
  recent.set(key, now);

  // Keep the in-memory map bounded in long-lived browser sessions.
  if (recent.size > 500) {
    for (const [k, timestamp] of recent) {
      if (now - timestamp > DEDUPE_MS) recent.delete(k);
    }
  }

  const { error } = await supabase.from('notifications').insert(row);
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[notify] insert failed:', error.message);
  }
  return { error };
}
