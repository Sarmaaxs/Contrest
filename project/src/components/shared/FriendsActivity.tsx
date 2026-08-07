
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import Avatar from '@/components/shared/Avatar';

type Row = { id: string; username: string; full_name: string; avatar_url: string | null; status_text: string | null };

/** Mutual friends' "now playing" — Spotify-style */
export default function FriendsActivity({ onOpenProfile }: { onOpenProfile?: (id: string) => void }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: following } = await supabase.from('follows').select('following_id').eq('follower_id', user.id);
      const ids = (following ?? []).map((f) => f.following_id);
      if (!ids.length) return;
      // mutuals only
      const { data: back } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', user.id)
        .in('follower_id', ids);
      const mutual = (back ?? []).map((b) => b.follower_id);
      if (!mutual.length) return;
      const { data } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, status_text')
        .in('id', mutual)
        .like('status_text', 'listening:%')
        .limit(12);
      setRows((data as Row[]) ?? []);
    })();
  }, [user]);

  if (rows.length === 0) return null;

  return (
    <div className="mb-4">
      <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">Friends listening</h3>
      <div className="flex gap-3 overflow-x-auto pb-1 hide-scrollbar">
        {rows.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onOpenProfile?.(r.id)}
            className="flex items-center gap-2 shrink-0 glass rounded-full pl-1 pr-3 py-1 hover:bg-white/10"
          >
            <Avatar url={r.avatar_url} name={r.full_name} size="sm" />
            <div className="text-left min-w-0">
              <p className="text-[11px] text-white truncate max-w-[100px]">@{r.username}</p>
              <p className="text-[10px] text-accent truncate max-w-[100px]">
                {r.status_text?.replace('listening:', '')}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
