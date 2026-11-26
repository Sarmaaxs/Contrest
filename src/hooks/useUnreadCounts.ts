import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

/**
 * Unread counts for the notification bell and message icon — the badge
 * modern messaging apps use so people know there's
 * something new without having to open the tab and check. Polls on an
 * interval as a reliable fallback, and refreshes instantly on realtime
 * inserts so a new DM/notification shows up without waiting for the poll.
 */
export function useUnreadCounts() {
  const { user } = useAuth();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadNotifications(0);
      setUnreadMessages(0);
      return;
    }

    let cancelled = false;

    const refresh = async () => {
      const [{ count: notifCount }, { count: msgCount }] = await Promise.all([
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('read', false),
        supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .neq('sender_id', user.id)
          .is('read_at', null),
      ]);
      if (cancelled) return;
      setUnreadNotifications(notifCount ?? 0);
      setUnreadMessages(msgCount ?? 0);
    };

    refresh();
    const interval = window.setInterval(refresh, 30_000);

    const channel = supabase
      .channel(`unread-counts-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        refresh
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, refresh)
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { unreadNotifications, unreadMessages };
}
