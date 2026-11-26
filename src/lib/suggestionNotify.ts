import { supabase } from '@/lib/supabase';
import { notify } from '@/lib/notify';

const KEY_PREFIX = 'contrest_last_suggestion_notif_';
const MIN_GAP_MS = 3.5 * 24 * 60 * 60 * 1000; // ~twice a week

/**
 * Honest limitation up front: there's no server-side scheduler (cron) in
 * this stack, so "twice a week" is approximated by checking on app open —
 * if it's been ~3.5+ days since the last one *and the person opens the
 * app*, they get a suggestion notification. A person who never opens the
 * app obviously won't get one; a true server-scheduled version would need
 * Supabase's pg_cron extension enabled and a scheduled Edge Function,
 * which is a real follow-up if guaranteed delivery matters more than
 * "close enough, triggered by actual usage."
 */
export async function maybeNotifySuggestions(userId: string): Promise<void> {
  try {
    const key = KEY_PREFIX + userId;
    const last = Number(localStorage.getItem(key) ?? 0);
    if (Date.now() - last < MIN_GAP_MS) return;

    const { data: follows } = await supabase.from('follows').select('following_id').eq('follower_id', userId);
    const followingIds = new Set((follows ?? []).map((f) => f.following_id));

    const { data: candidates } = await supabase
      .from('profiles')
      .select('id, username')
      .neq('id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    const pool = (candidates ?? []).filter((p) => !followingIds.has(p.id));
    if (pool.length === 0) return;

    const picks = pool.sort(() => Math.random() - 0.5).slice(0, 3);
    const names = picks.map((p) => `@${p.username}`).join(', ');

    await notify({
      user_id: userId,
      actor_id: userId,
      type: 'suggestion',
      message: `People you might like: ${names}`,
    });

    localStorage.setItem(key, String(Date.now()));
  } catch {
    // Not worth surfacing — worst case, the person just doesn't get a
    // suggestion notification this cycle.
  }
}
