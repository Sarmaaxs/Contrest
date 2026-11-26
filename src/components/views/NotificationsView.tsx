import { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Bell, Heart, MessageCircle, UserPlus, ShieldAlert, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import Avatar from '@/components/shared/Avatar';

type Notif = {
  id: string;
  type: string;
  message: string | null;
  read: boolean;
  created_at: string;
  actor_id: string | null;
  post_id: string | null;
  profiles?: { username: string; full_name: string; avatar_url: string | null } | null;
};

export default function NotificationsView({
  onBack,
  onOpenProfile,
}: {
  onBack?: () => void;
  onOpenProfile?: (id: string, postId?: string) => void;
}) {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*, profiles!notifications_actor_id_fkey(username, full_name, avatar_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setItems((data as any[]) ?? []);
    setLoading(false);
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const icon = (type: string) => {
    if (type === 'like') return <Heart className="w-4 h-4 text-red-400" />;
    if (type === 'comment') return <MessageCircle className="w-4 h-4 text-accent" />;
    if (type === 'follow') return <UserPlus className="w-4 h-4 text-emerald-400" />;
    if (type === 'login_alert') return <ShieldAlert className="w-4 h-4 text-amber-400" />;
    if (type === 'suggestion') return <Users className="w-4 h-4 text-accent" />;
    return <Bell className="w-4 h-4 text-neutral-400" />;
  };

  return (
    <div className="min-h-screen app-glow-bg">
      <header className="sticky top-0 z-10 glass border-b border-white/10 px-4 py-3 flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="p-1.5 hover:bg-white/10 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-neutral-300" />
          </button>
        )}
        <Bell className="w-5 h-5 text-accent" />
        <h1 className="font-semibold text-white">Notifications</h1>
      </header>

      <div className="max-w-lg mx-auto">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-white/15 border-t-white rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-neutral-500 text-center py-16">No notifications yet</p>
        ) : (
          <div className="divide-y divide-white/5">
            {items.map((n) => {
              const isSystem = n.type === 'login_alert' || n.type === 'suggestion';
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => !isSystem && n.actor_id && onOpenProfile?.(n.actor_id, n.post_id ?? undefined)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left ${
                    isSystem ? '' : 'hover:bg-white/[0.04]'
                  } ${n.read ? '' : 'bg-accent/5'}`}
                >
                  {isSystem ? (
                    <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                      {icon(n.type)}
                    </div>
                  ) : (
                    <Avatar url={n.profiles?.avatar_url} name={n.profiles?.full_name} size="md" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-100">
                      {isSystem ? (
                        <span className="text-neutral-200">{n.message}</span>
                      ) : (
                        <>
                          <span className="font-medium">@{n.profiles?.username ?? 'someone'}</span>{' '}
                          <span className="text-neutral-400">{n.message ?? n.type}</span>
                        </>
                      )}
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5">{timeAgo(n.created_at)}</p>
                  </div>
                  {!isSystem && icon(n.type)}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}
