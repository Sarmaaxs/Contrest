import { supabase } from '@/lib/supabase';

/**
 * Every notification insert in the app was fire-and-forget with no error
 * capture — if it failed (RLS not applied, migration not run, etc.) it
 * failed completely silently and nobody could tell why "follow" notifications
 * weren't showing up. This logs the real reason to the console so it's
 * actually debuggable instead of a black hole.
 */
export async function notify(row: {
  user_id: string;
  actor_id: string;
  type: 'follow' | 'like' | 'comment';
  message: string;
  post_id?: string;
}) {
  const { error } = await supabase.from('notifications').insert(row);
  if (error) {
    // eslint-disable-next-line no-console
    console.error(`[notify:${row.type}] insert failed — run ADD_NOTIFICATIONS.sql in Supabase if this persists:`, error.message);
  }
  return { error };
}
