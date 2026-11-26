import { useEffect, useState, useRef, useCallback } from 'react';
import { Heart, MessageCircle, Send, Bookmark, Volume2, VolumeX, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Post, Comment } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import Avatar from '@/components/shared/Avatar';
import VerifiedBadge from '@/components/shared/VerifiedBadge';
import ShareSheet from '@/components/shared/ShareSheet';
import { isVerified } from '@/lib/verified';
import { canSeePost, type VisibilityCtx } from '@/lib/feed';
import { moderateText } from '@/lib/moderation';
import { notify } from '@/lib/notify';

type ReelPost = Post & {
  likeCount: number;
  liked: boolean;
  commentCount: number;
  bookmarked: boolean;
};

export default function ReelsView() {
  const { user } = useAuth();
  const [reels, setReels] = useState<ReelPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [commentFor, setCommentFor] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [shareReelId, setShareReelId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());

  const loadReels = useCallback(async () => {
    if (!user) return;
    const [{ data: blocks }, { data: following }, { data: ni }, { data: closeAsFriend }] =
      await Promise.all([
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

    const { data: rawPosts } = await supabase
      .from('posts')
      .select('*, profiles!posts_user_id_fkey(*)')
      .eq('media_type', 'video')
      .order('created_at', { ascending: false })
      .limit(40);

    const visible = ((rawPosts as Post[]) ?? []).filter((p) => canSeePost(p, ctx));
    const postIds = visible.map((p) => p.id);

    const [{ data: likes }, { data: commentRows }, { data: bookmarks }] = await Promise.all([
      postIds.length
        ? supabase.from('likes').select('post_id, user_id').in('post_id', postIds)
        : Promise.resolve({ data: [] as any[] }),
      postIds.length
        ? supabase.from('comments').select('post_id').in('post_id', postIds)
        : Promise.resolve({ data: [] as any[] }),
      postIds.length
        ? supabase.from('bookmarks').select('post_id').eq('user_id', user.id).in('post_id', postIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const likeMap = new Map<string, Set<string>>();
    (likes ?? []).forEach((l) => {
      if (!likeMap.has(l.post_id)) likeMap.set(l.post_id, new Set());
      likeMap.get(l.post_id)!.add(l.user_id);
    });
    const cCount = new Map<string, number>();
    (commentRows ?? []).forEach((c) => cCount.set(c.post_id, (cCount.get(c.post_id) ?? 0) + 1));
    const bm = new Set((bookmarks ?? []).map((b) => b.post_id));

    setReels(
      visible.map((p) => {
        const likers = likeMap.get(p.id) ?? new Set();
        return {
          ...p,
          likeCount: likers.size,
          liked: likers.has(user.id),
          commentCount: cCount.get(p.id) ?? 0,
          bookmarked: bm.has(p.id),
        };
      })
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadReels();
  }, [loadReels]);

  // The `autoPlay` attribute only affects a <video> at the moment it's
  // mounted — toggling it via props does nothing once the element already
  // exists in the DOM. Without this, scrolling to a new reel never paused
  // the previous one (it kept playing and buffering off-screen) and never
  // started the new one automatically.
  useEffect(() => {
    videoRefs.current.forEach((video, idx) => {
      if (idx === activeIndex) {
        video.play().catch(() => {
          /* autoplay can be blocked before first user gesture; the mute
             button and manual tap on the video still work */
        });
      } else if (!video.paused) {
        video.pause();
      }
    });
  }, [activeIndex, reels.length]);

  const toggleLike = async (postId: string, currentlyLiked: boolean) => {
    if (!user) return;
    setReels((prev) =>
      prev.map((r) =>
        r.id === postId
          ? { ...r, liked: !currentlyLiked, likeCount: r.likeCount + (currentlyLiked ? -1 : 1) }
          : r
      )
    );
    if (currentlyLiked) {
      await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.id);
    } else {
      await supabase.from('likes').insert({ post_id: postId, user_id: user.id });
      const owner = reels.find((r) => r.id === postId)?.user_id;
      if (owner && owner !== user.id) {
        notify({
          user_id: owner,
          actor_id: user.id,
          type: 'like',
          message: 'liked your reel',
          post_id: postId,
        });
      }
    }
  };

  const toggleBookmark = async (postId: string, currently: boolean) => {
    if (!user) return;
    setReels((prev) => prev.map((r) => (r.id === postId ? { ...r, bookmarked: !currently } : r)));
    if (currently) {
      await supabase.from('bookmarks').delete().eq('post_id', postId).eq('user_id', user.id);
    } else {
      await supabase.from('bookmarks').insert({ post_id: postId, user_id: user.id });
    }
  };

  const openComments = async (postId: string) => {
    setCommentFor(postId);
    const { data } = await supabase
      .from('comments')
      .select('*, profiles!comments_user_id_fkey(*)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    setComments((data as Comment[]) ?? []);
  };

  const sendComment = async () => {
    if (!user || !commentFor || !draft.trim()) return;
    const mod = moderateText(draft);
    if (!mod.allowed) return;
    const text = draft.trim();
    const { data } = await supabase
      .from('comments')
      .insert({ post_id: commentFor, user_id: user.id, content: text })
      .select('*, profiles!comments_user_id_fkey(*)')
      .single();
    if (data) {
      setComments((prev) => [...prev, data as Comment]);
      setReels((prev) =>
        prev.map((r) => (r.id === commentFor ? { ...r, commentCount: r.commentCount + 1 } : r))
      );
      setDraft('');
      const owner = reels.find((r) => r.id === commentFor)?.user_id;
      if (owner && owner !== user.id) {
        notify({
          user_id: owner,
          actor_id: user.id,
          type: 'comment',
          message: text.slice(0, 80),
          post_id: commentFor,
        });
      }
    }
  };

  const shareReel = (reel: ReelPost) => {
    setShareReelId(reel.id);
  };

  const handleScroll = () => {
    if (!containerRef.current) return;
    const idx = Math.round(containerRef.current.scrollTop / window.innerHeight);
    setActiveIndex(idx);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-2 border-white/15 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen px-4 text-center">
        <p className="text-neutral-500 text-lg">No reels yet</p>
        <p className="text-neutral-400 text-sm mt-1">Upload a video to see it here.</p>
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-screen overflow-y-scroll snap-y snap-mandatory bg-black hide-scrollbar"
      >
        {reels.map((reel, idx) => (
          <div
            key={reel.id}
            className="h-screen w-full snap-start snap-always relative flex items-center justify-center"
          >
            <video
              ref={(el) => {
                if (el) videoRefs.current.set(idx, el);
                else videoRefs.current.delete(idx);
              }}
              src={reel.media_url}
              loop
              muted={muted}
              playsInline
              preload={
                document.documentElement.dataset.dataSaver === '1'
                  ? (idx === activeIndex ? 'auto' : 'none')
                  : (Math.abs(idx - activeIndex) <= 1 ? 'auto' : 'none')
              }
              className="h-full w-full object-contain"
            />
            <button
              onClick={() => setMuted((m) => !m)}
              className="absolute top-16 right-4 p-2.5 bg-black/40 backdrop-blur rounded-full"
            >
              {muted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
            </button>
            <div className="absolute bottom-24 md:bottom-8 left-4 right-16 text-white">
              <div className="flex items-center gap-3 mb-3">
                <Avatar
                  url={reel.profiles?.avatar_url}
                  name={reel.profiles?.full_name}
                  size="sm"
                  ring
                  verified={isVerified(reel.profiles)}
                />
                <span className="font-medium text-sm flex items-center gap-1">
                  @{reel.profiles?.username}
                  {isVerified(reel.profiles) && <VerifiedBadge size="sm" />}
                </span>
              </div>
              {reel.caption && <p className="text-sm leading-relaxed max-w-md">{reel.caption}</p>}
              {reel.hashtags && reel.hashtags.length > 0 && (
                <p className="text-xs text-accent mt-1">{reel.hashtags.map((h) => `#${h}`).join(' ')}</p>
              )}
            </div>
            <div className="absolute bottom-24 md:bottom-8 right-2 flex flex-col items-center gap-5 text-white">
              <button onClick={() => toggleLike(reel.id, reel.liked)} className="flex flex-col items-center gap-1">
                <Heart
                  className={`w-7 h-7 transition-transform active:scale-90 ${
                    reel.liked ? 'fill-red-500 text-red-500' : ''
                  }`}
                />
                <span className="text-xs">{reel.likeCount}</span>
              </button>
              <button onClick={() => openComments(reel.id)} className="flex flex-col items-center gap-1">
                <MessageCircle className="w-7 h-7" />
                <span className="text-xs">{reel.commentCount}</span>
              </button>
              <button onClick={() => shareReel(reel)}>
                <Send className="w-7 h-7" />
              </button>
              <button onClick={() => toggleBookmark(reel.id, reel.bookmarked)}>
                <Bookmark className={`w-7 h-7 ${reel.bookmarked ? 'fill-white' : ''}`} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {commentFor && (
        <div className="fixed inset-0 z-50 bg-black/70 flex flex-col justify-end" onClick={() => setCommentFor(null)}>
          <div
            className="bg-ink-900 rounded-t-2xl max-h-[60vh] flex flex-col border-t border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="text-sm font-medium text-white">Comments</span>
              <button type="button" onClick={() => setCommentFor(null)}>
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[120px]">
              {comments.length === 0 && (
                <p className="text-sm text-neutral-500 text-center py-6">No comments yet — say something</p>
              )}
              {comments.map((c) => (
                <div key={c.id} className="text-sm text-neutral-100">
                  <span className="font-medium">@{c.profiles?.username}</span> {c.content}
                </div>
              ))}
            </div>
            <div className="flex gap-2 p-3 border-t border-white/10 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendComment()}
                placeholder="Add a comment…"
                className="flex-1 px-3 py-2.5 rounded-full glass-input text-sm"
                autoFocus
              />
              <button type="button" onClick={sendComment} className="text-sm font-semibold text-accent px-3">
                Post
              </button>
            </div>
          </div>
        </div>
      )}

      {shareReelId && (
        <ShareSheet
          postId={shareReelId}
          caption={reels.find((r) => r.id === shareReelId)?.caption}
          onClose={() => setShareReelId(null)}
        />
      )}
    </>
  );
}
