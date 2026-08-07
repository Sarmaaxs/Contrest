import { useEffect, useState, useCallback } from 'react';
import { Search, UserPlus, UserCheck, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Post, Profile } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import Avatar from '@/components/shared/Avatar';
import { canSeePost, type VisibilityCtx } from '@/lib/feed';
import FriendsActivity from '@/components/shared/FriendsActivity';

export default function ExploreView({
  onOpenProfile,
}: {
  onOpenProfile?: (userId: string) => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([])
  const [postResults, setPostResults] = useState<Post[]>([]);
  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const [followMap, setFollowMap] = useState<Record<string, 'none' | 'following' | 'requested'>>({});
  const [loading, setLoading] = useState(true);

  const loadFollowState = useCallback(
    async (ids: string[]) => {
      if (!user || ids.length === 0) return;
      const [{ data: following }, { data: requests }] = await Promise.all([
        supabase.from('follows').select('following_id').eq('follower_id', user.id).in('following_id', ids),
        supabase
          .from('follow_requests')
          .select('target_id')
          .eq('requester_id', user.id)
          .eq('status', 'pending')
          .in('target_id', ids),
      ]);
      const map: Record<string, 'none' | 'following' | 'requested'> = {};
      ids.forEach((id) => {
        map[id] = 'none';
      });
      (following ?? []).forEach((f) => {
        map[f.following_id] = 'following';
      });
      (requests ?? []).forEach((r) => {
        if (map[r.target_id] !== 'following') map[r.target_id] = 'requested';
      });
      setFollowMap((prev) => ({ ...prev, ...map }));
    },
    [user]
  );

  useEffect(() => {
    (async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      const [{ data: blocks }, { data: following }, { data: ni }, { data: closeAsFriend }] = await Promise.all([
        supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id),
        supabase.from('follows').select('following_id').eq('follower_id', user.id),
        supabase.from('not_interested').select('post_id, author_id').eq('user_id', user.id),
        supabase.from('close_friends').select('owner_id').eq('friend_id', user.id),
      ]);
      const ctx: VisibilityCtx = {
        userId: user.id,
        followingIds: new Set((following ?? []).map((f) => f.following_id)),
        closeFriendOf: new Set((closeAsFriend ?? []).map((c) => c.owner_id)),
        blockedIds: new Set((blocks ?? []).map((b) => b.blocked_id)),
        notInterestedPosts: new Set((ni ?? []).map((x) => x.post_id).filter(Boolean) as string[]),
        notInterestedAuthors: new Set((ni ?? []).map((x) => x.author_id).filter(Boolean) as string[]),
        mutedKeywords: [],
      };
      const { data } = await supabase
        .from('posts')
        .select('*, profiles!posts_user_id_fkey(*)')
        .order('created_at', { ascending: false })
        .limit(80);
      const visible = ((data as Post[]) ?? []).filter((p) => canSeePost(p, ctx));
      // Explore: only public-ish discovery — drop pure close_friends unless you're on list
      setPosts(visible.filter((p) => (p.visibility ?? 'public') !== 'followers' || ctx.followingIds.has(p.user_id)));
      setLoading(false);
    })();
  }, [user]);

  // Suggestions algorithm: people you don't follow, ranked by
  // mutual connections + recent activity (posts) + account age mix.
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: all }, { data: myFollows }, { data: recentPosts }] = await Promise.all([
        supabase.from('profiles').select('*').neq('id', user.id).order('created_at', { ascending: false }).limit(40),
        supabase.from('follows').select('following_id').eq('follower_id', user.id),
        supabase.from('posts').select('user_id').order('created_at', { ascending: false }).limit(80),
      ]);
      const list = (all as Profile[]) ?? [];
      const followingSet = new Set((myFollows ?? []).map((f) => f.following_id));
      const activity = new Map<string, number>();
      (recentPosts ?? []).forEach((p) => {
        activity.set(p.user_id, (activity.get(p.user_id) ?? 0) + 1);
      });

      // Mutual: people followed by people I follow
      let mutual = new Map<string, number>();
      const myFollowingIds = [...followingSet];
      if (myFollowingIds.length > 0) {
        const { data: second } = await supabase
          .from('follows')
          .select('following_id')
          .in('follower_id', myFollowingIds.slice(0, 20));
        (second ?? []).forEach((f) => {
          if (f.following_id === user.id || followingSet.has(f.following_id)) return;
          mutual.set(f.following_id, (mutual.get(f.following_id) ?? 0) + 1);
        });
      }

      const candidates = list.filter((p) => !followingSet.has(p.id));
      candidates.sort((a, b) => {
        const score = (p: Profile) =>
          (mutual.get(p.id) ?? 0) * 10 + (activity.get(p.id) ?? 0) * 3 + (p.is_private ? 0 : 1);
        return score(b) - score(a);
      });
      const suggested = candidates.slice(0, 10);
      setSuggestions(suggested);
      await loadFollowState(suggested.map((p) => p.id));
    })();
  }, [user, loadFollowState]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
        .neq('id', user?.id ?? '')
        .limit(12);
      const list = (data as Profile[]) ?? [];
      setResults(list);
      await loadFollowState(list.map((p) => p.id));
    }, 250);
    return () => clearTimeout(t);
  }, [query, user, loadFollowState]);

  const toggleFollow = async (p: Profile) => {
    if (!user) return;
    const state = followMap[p.id] ?? 'none';
    if (state === 'following') {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', p.id);
      setFollowMap((m) => ({ ...m, [p.id]: 'none' }));
      return;
    }
    if (state === 'requested') {
      await supabase
        .from('follow_requests')
        .delete()
        .eq('requester_id', user.id)
        .eq('target_id', p.id);
      setFollowMap((m) => ({ ...m, [p.id]: 'none' }));
      return;
    }
    if (p.is_private) {
      const { error } = await supabase.from('follow_requests').upsert({
        requester_id: user.id,
        target_id: p.id,
        status: 'pending',
      });
      if (!error) setFollowMap((m) => ({ ...m, [p.id]: 'requested' }));
    } else {
      const { error } = await supabase.from('follows').insert({
        follower_id: user.id,
        following_id: p.id,
      });
      if (!error) {
        setFollowMap((m) => ({ ...m, [p.id]: 'following' }));
        setSuggestions((prev) => prev.filter((s) => s.id !== p.id));
      } else {
        console.error('follow error', error);
        toast(error.message);
      }
    }
  };

  const PersonRow = ({ p }: { p: Profile }) => {
    const state = followMap[p.id] ?? 'none';
    return (
      <div className="flex items-center gap-3 bg-white/[0.04] backdrop-blur-xl rounded-xl border border-white/10 px-4 py-3">
        <button
          type="button"
          onClick={() => onOpenProfile?.(p.id)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          <Avatar url={p.avatar_url} name={p.full_name} size="md" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">@{p.username}</p>
            <p className="text-xs text-neutral-400 truncate">{p.full_name}</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => toggleFollow(p)}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 ${
            state === 'following'
              ? 'bg-white/10 text-neutral-300'
              : state === 'requested'
                ? 'bg-white/5 text-neutral-400'
                : 'bg-accent-grad text-white'
          }`}
        >
          {state === 'following' ? (
            <>
              <UserCheck className="w-3.5 h-3.5" /> Following
            </>
          ) : state === 'requested' ? (
            <>
              <Clock className="w-3.5 h-3.5" /> Requested
            </>
          ) : (
            <>
              <UserPlus className="w-3.5 h-3.5" /> {p.is_private ? 'Request' : 'Follow'}
            </>
          )}
        </button>
      </div>
    );
  };


  // Search: people first, then posts by caption / hashtag (not posts-only dump)
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setPostResults([]);
      return;
    }
    const tmr = setTimeout(async () => {
      const tag = q.replace(/^#/, '').toLowerCase();
      const [{ data: people }, { data: byCaption }, { data: byTag }] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
          .limit(12),
        supabase
          .from('posts')
          .select('*, profiles!posts_user_id_fkey(*)')
          .ilike('caption', `%${q}%`)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('posts')
          .select('*, profiles!posts_user_id_fkey(*)')
          .contains('hashtags', [tag])
          .order('created_at', { ascending: false })
          .limit(20),
      ]);
      setResults((people as Profile[]) ?? []);
      const map = new Map<string, Post>();
      [...((byCaption as Post[]) ?? []), ...((byTag as Post[]) ?? [])].forEach((p) => map.set(p.id, p));
      setPostResults([...map.values()].slice(0, 24));
      if (people?.length) await loadFollowState(people.map((p: Profile) => p.id));
    }, 280);
    return () => clearTimeout(tmr);
  }, [query, loadFollowState]);

  return (
    <div className="max-w-3xl mx-auto py-4 md:py-8 px-4">
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people…"
          className="w-full pl-10 pr-4 py-2.5 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-xl text-sm focus:outline-none focus:border-white/20 text-white"
        />
      </div>

      {query.trim() && results.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-3">People</h3>
          <div className="space-y-2">
            {results.map((p) => (
              <PersonRow key={p.id} p={p} />
            ))}
          </div>
        </div>
      )}

      {query.trim() && results.length === 0 && (
        <p className="text-sm text-neutral-500 text-center py-8">No people found for &quot;{query}&quot;</p>
      )}

      {!query.trim() && (
        <>
          {suggestions.length > 0 && (
            <div className="mb-8">
              <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-3">
                Suggested for you
              </h3>
              <div className="space-y-2">
                {suggestions.map((p) => (
                  <PersonRow key={p.id} p={p} />
                ))}
              </div>
            </div>
          )}

          <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-3">Discover</h3>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="aspect-square bg-white/10 animate-pulse" />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-8">Nothing to explore yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
              {posts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => p.user_id && onOpenProfile?.(p.user_id)}
                  className="aspect-square bg-white/[0.06] overflow-hidden relative group"
                >
                  {p.media_type === 'video' ? (
                    <video src={p.media_url} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={p.media_url} alt={p.caption ?? ''} className="w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
