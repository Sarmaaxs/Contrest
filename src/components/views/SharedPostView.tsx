import { useEffect, useState } from 'react';
import { ArrowLeft, Heart, MessageCircle, Music, Share2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Post, Comment } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import Avatar from '@/components/shared/Avatar';
import VerifiedBadge from '@/components/shared/VerifiedBadge';
import { isVerified } from '@/lib/verified';
import ShareSheet from '@/components/shared/ShareSheet';
import { notify } from '@/lib/notify';

/**
 * Single-post viewer for shared / invite links (?post=ID).
 * Recipients only see this specific post, not the full feed.
 */
export default function SharedPostView({
  postId,
  onBack,
  onOpenProfile,
}: {
  postId: string;
  onBack: () => void;
  onOpenProfile?: (userId: string) => void;
}) {
  const { user } = useAuth();
  const [post, setPost] = useState<(Post & { likeCount: number; liked: boolean; comments: Comment[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [comment, setComment] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('posts')
        .select('*, profiles!posts_user_id_fkey(*)')
        .eq('id', postId)
        .maybeSingle();
      if (cancelled) return;
      if (err || !data) {
        setError('This post is unavailable or private.');
        setLoading(false);
        return;
      }
      const [{ count }, { data: myLike }, { data: comments }] = await Promise.all([
        supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', postId),
        user
          ? supabase.from('likes').select('post_id').eq('post_id', postId).eq('user_id', user.id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from('comments')
          .select('*, profiles!comments_user_id_fkey(*)')
          .eq('post_id', postId)
          .order('created_at', { ascending: true })
          .limit(40),
      ]);
      if (cancelled) return;
      setPost({
        ...(data as Post),
        likeCount: count ?? 0,
        liked: !!myLike,
        comments: (comments as Comment[]) ?? [],
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [postId, user]);

  const toggleLike = async () => {
    if (!user || !post) return;
    const liked = post.liked;
    setPost({ ...post, liked: !liked, likeCount: post.likeCount + (liked ? -1 : 1) });
    if (liked) {
      await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', user.id);
    } else {
      await supabase.from('likes').insert({ post_id: post.id, user_id: user.id });
      if (post.user_id !== user.id) {
        notify({
          user_id: post.user_id,
          actor_id: user.id,
          type: 'like',
          message: 'liked your post',
          post_id: post.id,
        });
      }
    }
  };

  const submitComment = async () => {
    if (!user || !post || !comment.trim()) return;
    const text = comment.trim();
    setComment('');
    const { data } = await supabase
      .from('comments')
      .insert({ post_id: post.id, user_id: user.id, content: text })
      .select('*, profiles!comments_user_id_fkey(*)')
      .single();
    if (data) {
      setPost({ ...post, comments: [...post.comments, data as Comment] });
      if (post.user_id !== user.id) {
        notify({
          user_id: post.user_id,
          actor_id: user.id,
          type: 'comment',
          message: text.slice(0, 80),
          post_id: post.id,
        });
      }
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] max-w-lg mx-auto">
      <div className="sticky top-0 z-10 glass border-b border-white/10 flex items-center gap-3 px-4 h-14">
        <button type="button" onClick={onBack} className="p-1.5 hover:bg-white/10 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Shared post</p>
          <p className="text-[11px] text-neutral-500 truncate">Only this post · not the full feed</p>
        </div>
        {post && (
          <button type="button" onClick={() => setShareOpen(true)} className="p-1.5 hover:bg-white/10 rounded-lg">
            <Share2 className="w-5 h-5 text-neutral-200" />
          </button>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-white/15 border-t-accent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="px-6 py-16 text-center">
          <p className="text-neutral-300 text-sm mb-4">{error}</p>
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-accent-grad"
          >
            Back to Contrest
          </button>
        </div>
      )}

      {post && !loading && (
        <article className="border-b border-white/10">
          <div className="flex items-center gap-3 px-4 py-3">
            <button type="button" onClick={() => onOpenProfile?.(post.user_id)}>
              <Avatar url={post.profiles?.avatar_url} name={post.profiles?.full_name} size="md" verified={isVerified(post.profiles)} />
            </button>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate flex items-center gap-1">
                {post.profiles?.full_name}
                {isVerified(post.profiles) && <VerifiedBadge size="sm" />}
              </p>
              <p className="text-xs text-neutral-400">@{post.profiles?.username}</p>
            </div>
          </div>

          <div className="bg-black relative w-full" style={{ minHeight: 'min(72vh, 640px)', maxHeight: '78vh' }}>
            {post.media_type === 'video' ? (
              <video
                src={post.media_url}
                controls
                playsInline
                preload="metadata"
                className="absolute inset-0 w-full h-full object-contain bg-black"
              />
            ) : (
              <img
                src={post.media_url}
                alt=""
                loading="lazy"
                className="absolute inset-0 w-full h-full object-contain bg-black"
              />
            )}
          </div>

          <div className="px-4 py-3 space-y-3">
            <div className="flex items-center gap-4">
              <button type="button" onClick={toggleLike} className="flex items-center gap-1.5">
                <Heart className={`w-6 h-6 ${post.liked ? 'fill-red-500 text-red-500' : 'text-neutral-300'}`} />
                <span className="text-sm text-neutral-300">{post.likeCount}</span>
              </button>
              <div className="flex items-center gap-1.5">
                <MessageCircle className="w-6 h-6 text-neutral-300" />
                <span className="text-sm text-neutral-300">{post.comments.length}</span>
              </div>
            </div>

            {post.caption && (
              <p className="text-sm text-neutral-100">
                <span className="font-medium">@{post.profiles?.username}</span> {post.caption}
              </p>
            )}

            {post.music_title && (
              <div className="flex items-center gap-2 text-xs text-neutral-300">
                <Music className="w-3.5 h-3.5 text-accent" />
                <span className="truncate">
                  {post.music_title}
                  {post.music_artist ? ` · ${post.music_artist}` : ''}
                </span>
                {post.music_stream_url && (
                  <audio src={post.music_stream_url} controls className="h-7 max-w-[140px] ml-auto" preload="none" />
                )}
              </div>
            )}

            {post.comments.length > 0 && (
              <div className="space-y-1.5">
                {post.comments.map((c) => (
                  <div key={c.id} className="text-sm text-neutral-100">
                    <span className="font-medium">@{c.profiles?.username}</span> {c.content}
                  </div>
                ))}
              </div>
            )}

            {user && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitComment()}
                  placeholder="Add a comment…"
                  className="flex-1 text-sm px-3 py-2 rounded-full border border-white/10 bg-black/40 text-white"
                />
                <button type="button" onClick={submitComment} className="text-sm font-medium text-accent">
                  Post
                </button>
              </div>
            )}
          </div>
        </article>
      )}

      {shareOpen && post && (
        <ShareSheet postId={post.id} caption={post.caption} onClose={() => setShareOpen(false)} />
      )}
    </div>
  );
}
