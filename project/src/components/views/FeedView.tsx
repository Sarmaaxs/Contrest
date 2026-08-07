import { useEffect, useState, useCallback } from 'react';
import {
  Heart,
  MessageCircle,
  Bookmark,
  MoreHorizontal,
  Search,
  Repeat2,
  Share2,
  Trash2,
  EyeOff,
  UserX,
  Info,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { notify } from '@/lib/notify';
import type { Post, Comment, Profile } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import Avatar from '@/components/shared/Avatar';
import StoriesBar from '@/components/stories/StoriesBar';
import ReportBlockMenu from '@/components/moderation/ReportBlockMenu';
import { moderateText } from '@/lib/moderation';
import {
  canSeePost,
  scoreForYou,
  whyAmISeeingThis,
  extractHashtags,
  type VisibilityCtx,
  type RankSignals,
} from '@/lib/feed';

type FeedPost = Post & {
  likeCount: number;
  liked: boolean;
  commentCount: number;
  comments: Comment[];
  bookmarked: boolean;
  reposted: boolean;
  repostCount: number;
  hashtags?: string[];
  why?: string;
};

export default function FeedView({
  onOpenProfile,
  onOpenSearch,
}: {
  onOpenProfile: (userId: string) => void;
  onOpenSearch?: () => void;
}) {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<'foryou' | 'following'>('foryou');
  const [originFilter, setOriginFilter] = useState<'all' | 'ai' | 'human'>('all');
  const [burstPostId, setBurstPostId] = useState<string | null>(null);
  const [menuPost, setMenuPost] = useState<FeedPost | null>(null);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [whyPost, setWhyPost] = useState<FeedPost | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const loadPosts = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [
      { data: blocks },
      { data: following },
      { data: ni },
      { data: mutes },
      { data: closeAsFriend },
      { data: myLikes },
    ] = await Promise.all([
      supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id),
      supabase.from('follows').select('following_id').eq('follower_id', user.id),
      supabase.from('not_interested').select('post_id, author_id').eq('user_id', user.id),
      supabase.from('muted_keywords').select('keyword').eq('user_id', user.id),
      // authors who listed ME as close friend
      supabase.from('close_friends').select('owner_id').eq('friend_id', user.id),
      supabase.from('likes').select('post_id, posts(user_id)').eq('user_id', user.id).limit(100),
    ]);

    const blockedIds = new Set((blocks ?? []).map((b) => b.blocked_id));
    const followingIds = new Set((following ?? []).map((f) => f.following_id));
    const notInterestedPosts = new Set(
      (ni ?? []).map((x) => x.post_id).filter(Boolean) as string[]
    );
    const notInterestedAuthors = new Set(
      (ni ?? []).map((x) => x.author_id).filter(Boolean) as string[]
    );
    const mutedKeywords = (mutes ?? []).map((m) => m.keyword);
    const closeFriendOf = new Set((closeAsFriend ?? []).map((c) => c.owner_id));
    const likedAuthorIds = new Set<string>();
    (myLikes ?? []).forEach((l: any) => {
      if (l.posts?.user_id) likedAuthorIds.add(l.posts.user_id);
    });

    const visCtx: VisibilityCtx = {
      userId: user.id,
      followingIds,
      closeFriendOf,
      blockedIds,
      notInterestedPosts,
      notInterestedAuthors,
      mutedKeywords,
    };

    let q = supabase
      .from('posts')
      .select('*, profiles!posts_user_id_fkey(*)')
      .order('created_at', { ascending: false })
      .limit(80);

    if (tab === 'following') {
      if (followingIds.size === 0) {
        setPosts([]);
        setLoading(false);
        return;
      }
      q = q.in('user_id', [...followingIds]);
    }

    const { data: rawPosts } = await q;
    if (!rawPosts) {
      setLoading(false);
      return;
    }

    let visible = (rawPosts as Post[]).filter((p) => canSeePost(p, visCtx));

    const rankSignals: RankSignals = {
      followingIds,
      likedAuthorIds,
      myInterests: (profile as any)?.interests ?? [],
      notInterestedAuthors,
    };

    if (tab === 'foryou') {
      visible = [...visible].sort(
        (a, b) => scoreForYou(b as any, rankSignals) - scoreForYou(a as any, rankSignals)
      );
    }

    const postIds = visible.map((p) => p.id);
    if (postIds.length === 0) {
      setPosts([]);
      setLoading(false);
      return;
    }

    const [{ data: likes }, { data: comments }, { data: bookmarks }, { data: reposts }] =
      await Promise.all([
        supabase.from('likes').select('post_id, user_id').in('post_id', postIds),
        supabase
          .from('comments')
          .select('*, profiles!comments_user_id_fkey(*)')
          .in('post_id', postIds)
          .order('created_at', { ascending: true }),
        supabase.from('bookmarks').select('post_id').eq('user_id', user.id).in('post_id', postIds),
        supabase.from('reposts').select('post_id, user_id').in('post_id', postIds),
      ]);

    const likeMap = new Map<string, Set<string>>();
    (likes ?? []).forEach((l) => {
      if (!likeMap.has(l.post_id)) likeMap.set(l.post_id, new Set());
      likeMap.get(l.post_id)!.add(l.user_id);
    });
    const commentMap = new Map<string, Comment[]>();
    (comments ?? []).forEach((c) => {
      const arr = commentMap.get(c.post_id) ?? [];
      arr.push(c as Comment);
      commentMap.set(c.post_id, arr);
    });
    const bmSet = new Set((bookmarks ?? []).map((b) => b.post_id));
    const repostMap = new Map<string, Set<string>>();
    (reposts ?? []).forEach((r) => {
      if (!repostMap.has(r.post_id)) repostMap.set(r.post_id, new Set());
      repostMap.get(r.post_id)!.add(r.user_id);
    });

    const enriched: FeedPost[] = visible.map((p) => {
      const likers = likeMap.get(p.id) ?? new Set<string>();
      const reps = repostMap.get(p.id) ?? new Set<string>();
      return {
        ...p,
        likeCount: likers.size,
        liked: likers.has(user.id),
        commentCount: (commentMap.get(p.id) ?? []).length,
        comments: (commentMap.get(p.id) ?? []).slice(-2),
        bookmarked: bmSet.has(p.id),
        reposted: reps.has(user.id),
        repostCount: reps.size,
        hashtags: (p as any).hashtags?.length ? (p as any).hashtags : extractHashtags(p.caption),
        why: tab === 'foryou' ? whyAmISeeingThis(p as any, rankSignals) : undefined,
      };
    });

    setPosts(enriched);
    setLoading(false);
  }, [user, tab, profile]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const toast = (msg: string) => {
    setShareToast(msg);
    setTimeout(() => setShareToast(null), 2200);
  };

  const toggleLike = async (postId: string, currentlyLiked: boolean) => {
    if (!user) return;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, liked: !currentlyLiked, likeCount: p.likeCount + (currentlyLiked ? -1 : 1) }
          : p
      )
    );
    if (currentlyLiked) {
      await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.id);
    } else {
      await supabase.from('likes').insert({ post_id: postId, user_id: user.id });
      const post = posts.find((p) => p.id === postId);
      if (post && post.user_id !== user.id) {
        await notify({
          user_id: post.user_id,
          actor_id: user.id,
          type: 'like',
          post_id: postId,
          message: 'liked your post',
        });
      }
    }
  };

  const toggleBookmark = async (postId: string, currently: boolean) => {
    if (!user) return;
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, bookmarked: !currently } : p)));
    if (currently) {
      await supabase.from('bookmarks').delete().eq('post_id', postId).eq('user_id', user.id);
    } else {
      await supabase.from('bookmarks').insert({ post_id: postId, user_id: user.id });
    }
  };

  const toggleRepost = async (postId: string, currently: boolean) => {
    if (!user) return;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, reposted: !currently, repostCount: p.repostCount + (currently ? -1 : 1) }
          : p
      )
    );
    if (currently) {
      await supabase.from('reposts').delete().eq('post_id', postId).eq('user_id', user.id);
    } else {
      await supabase.from('reposts').insert({ post_id: postId, user_id: user.id });
    }
  };

  const markNotInterested = async (post: FeedPost, hideAuthor = false) => {
    if (!user) return;
    await supabase.from('not_interested').insert({
      user_id: user.id,
      post_id: post.id,
      author_id: hideAuthor ? post.user_id : null,
      reason: hideAuthor ? 'author' : 'post',
    });
    setPosts((prev) =>
      prev.filter((p) => (hideAuthor ? p.user_id !== post.user_id : p.id !== post.id))
    );
    setMenuPost(null);
    toast(hideAuthor ? 'You will see less from them' : 'Got it — fewer like this');
  };

  const deletePost = async (postId: string) => {
    if (!user) return;
    if (!confirm('Delete this post?')) return;
    const { error } = await supabase.from('posts').delete().eq('id', postId).eq('user_id', user.id);
    if (error) {
      toast(error.message);
      return;
    }
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setMenuPost(null);
  };

  const sharePost = async (post: FeedPost) => {
    const url = `${window.location.origin}/?post=${post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Contrest', text: post.caption ?? '', url });
      } else {
        await navigator.clipboard.writeText(url);
        toast('Link copied');
      }
    } catch {
      await navigator.clipboard.writeText(url);
      toast('Link copied');
    }
  };

  const submitComment = async (postId: string) => {
    if (!user || !profile) return;
    const text = (commentText[postId] ?? '').trim();
    if (!text) return;
    const mod = moderateText(text);
    if (!mod.allowed) {
      toast(mod.reason ?? 'Comment blocked');
      return;
    }
    setCommentText((prev) => ({ ...prev, [postId]: '' }));
    const { data } = await supabase
      .from('comments')
      .insert({ post_id: postId, user_id: user.id, content: text })
      .select('*, profiles!comments_user_id_fkey(*)')
      .single();
    if (data) {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, comments: [...p.comments, data as Comment], commentCount: p.commentCount + 1 }
            : p
        )
      );
      const post = posts.find((p) => p.id === postId);
      if (post && post.user_id !== user.id) {
        await notify({
          user_id: post.user_id,
          actor_id: user.id,
          type: 'comment',
          post_id: postId,
          message: 'commented on your post',
        });
      }
    }
  };

  return (
    <div className="max-w-xl mx-auto py-4 md:py-6 px-4 space-y-4">
      <div className="flex items-center justify-center gap-6 mb-1">
        <button
          onClick={() => setTab('foryou')}
          className={`text-sm font-semibold pb-1 border-b-2 ${
            tab === 'foryou' ? 'text-white border-accent' : 'text-neutral-500 border-transparent'
          }`}
        >
          For You
        </button>
        <button
          onClick={() => setTab('following')}
          className={`text-sm font-semibold pb-1 border-b-2 ${
            tab === 'following' ? 'text-white border-accent' : 'text-neutral-500 border-transparent'
          }`}
        >
          Following
        </button>
        {onOpenSearch && (
          <button onClick={onOpenSearch} className="ml-auto p-1.5 text-neutral-400 hover:text-white">
            <Search className="w-5 h-5" />
          </button>
        )}
      </div>

      {tab === 'following' && <StoriesBar />}

      {loading ? (
        <div className="space-y-8 py-6">
          {[0, 1].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-white/10" />
                <div className="h-4 w-24 bg-white/10 rounded" />
              </div>
              <div className="aspect-square bg-white/10 rounded-xl" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-neutral-500 text-lg">
            {tab === 'following' ? 'Follow people to fill this feed' : 'No posts yet'}
          </p>
          <p className="text-neutral-400 text-sm mt-1">
            {tab === 'foryou' ? 'Share something or follow accounts to train the feed.' : 'Be the first.'}
          </p>
        </div>
      ) : (
        posts.map((post) => (
          <article
            key={post.id}
            className="bg-white/[0.04] backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden"
          >
            <header className="flex items-center justify-between px-4 py-3">
              <button
                onClick={() => post.user_id && onOpenProfile(post.user_id)}
                className="flex items-center gap-3"
              >
                <Avatar url={post.profiles?.avatar_url} name={post.profiles?.full_name} size="sm" />
                <div className="text-left">
                  <p className="text-sm font-medium text-white">@{post.profiles?.username}</p>
                  <p className="text-xs text-neutral-400">{timeAgo(post.created_at)}</p>
                </div>
              </button>
              <button onClick={() => setMenuPost(post)} className="p-1.5 hover:bg-white/[0.06] rounded-full">
                <MoreHorizontal className="w-5 h-5 text-neutral-400" />
              </button>
            </header>

            <div
              className="relative"
              onDoubleClick={() => {
                if (!post.liked) toggleLike(post.id, false);
                setBurstPostId(post.id);
                setTimeout(() => setBurstPostId((cur) => (cur === post.id ? null : cur)), 700);
              }}
            >
              {post.media_type === 'video' ? (
                <video src={post.media_url} controls className="w-full max-h-[600px] object-contain bg-black" />
              ) : (
                <img
                  src={post.media_url}
                  alt={post.caption ?? 'post'}
                  className="w-full max-h-[600px] object-contain bg-black"
                />
              )}
              {burstPostId === post.id && (
                <Heart className="absolute inset-0 m-auto w-24 h-24 text-white fill-white drop-shadow-lg animate-heart-burst pointer-events-none" />
              )}
            </div>

            <div className="px-4 py-3">
              <div className="flex items-center gap-4 mb-3">
                <button onClick={() => toggleLike(post.id, post.liked)} className="flex items-center gap-1.5">
                  <Heart
                    className={`w-6 h-6 transition-transform active:scale-90 ${
                      post.liked ? 'fill-red-500 text-red-500' : 'text-neutral-300'
                    }`}
                  />
                  <span className="text-sm text-neutral-300">{post.likeCount}</span>
                </button>
                <div className="flex items-center gap-1.5">
                  <MessageCircle className="w-6 h-6 text-neutral-300" />
                  <span className="text-sm text-neutral-300">{post.commentCount}</span>
                </div>
                <button onClick={() => toggleRepost(post.id, post.reposted)} className="flex items-center gap-1.5">
                  <Repeat2 className={`w-6 h-6 ${post.reposted ? 'text-emerald-400' : 'text-neutral-300'}`} />
                  <span className="text-sm text-neutral-300">{post.repostCount}</span>
                </button>
                <button onClick={() => sharePost(post)} className="ml-auto">
                  <Share2 className="w-5 h-5 text-neutral-300" />
                </button>
                <button onClick={() => toggleBookmark(post.id, post.bookmarked)}>
                  <Bookmark
                    className={`w-6 h-6 ${post.bookmarked ? 'fill-accent text-accent' : 'text-neutral-300'}`}
                  />
                </button>
              </div>

              {post.caption && (
                <p className="text-sm text-neutral-100 mb-2">
                  <span className="font-medium">@{post.profiles?.username}</span> {post.caption}
                </p>
              )}
              {post.hashtags && post.hashtags.length > 0 && (
                <p className="text-xs text-accent mb-2">{post.hashtags.map((h) => `#${h}`).join(' ')}</p>
              )}


              {post.comments.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {post.comments.map((c) => (
                    <div key={c.id} className="text-sm text-neutral-100">
                      <span className="font-medium">@{c.profiles?.username}</span> {c.content}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={commentText[post.id] ?? ''}
                  onChange={(e) => setCommentText((prev) => ({ ...prev, [post.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && submitComment(post.id)}
                  placeholder="Add a comment…"
                  className="flex-1 text-sm px-3 py-2 rounded-full border border-white/10 focus:outline-none focus:border-white/20 bg-black/40 text-white"
                />
                <button onClick={() => submitComment(post.id)} className="text-sm font-medium text-accent shrink-0">
                  Post
                </button>
              </div>
            </div>
          </article>
        ))
      )}

      {/* Own post menu */}
      {menuPost && menuPost.user_id === user?.id && (
        <Sheet onClose={() => setMenuPost(null)}>
          <SheetBtn
            danger
            icon={<Trash2 className="w-5 h-5" />}
            label="Delete post"
            onClick={() => deletePost(menuPost.id)}
          />
          <SheetBtn label="Cancel" onClick={() => setMenuPost(null)} />
        </Sheet>
      )}

      {/* Other's post menu */}
      {menuPost && menuPost.user_id !== user?.id && (
        <Sheet onClose={() => setMenuPost(null)}>
          {menuPost.why && (
            <SheetBtn
              icon={<Info className="w-5 h-5" />}
              label="Why am I seeing this?"
              onClick={() => {
                setWhyPost(menuPost);
                setMenuPost(null);
              }}
            />
          )}
          <SheetBtn
            icon={<EyeOff className="w-5 h-5" />}
            label="Not interested"
            onClick={() => markNotInterested(menuPost, false)}
          />
          <SheetBtn
            icon={<UserX className="w-5 h-5" />}
            label="See less from this account"
            onClick={() => markNotInterested(menuPost, true)}
          />
          <SheetBtn
            danger
            label="Report / Block…"
            onClick={() => {
              /* keep menuPost but switch via reportOpen */
              setReportOpen(true);
            }}
          />
          <SheetBtn label="Cancel" onClick={() => setMenuPost(null)} />
        </Sheet>
      )}

      {reportOpen && menuPost && (
        <ReportBlockMenu
          postId={menuPost.id}
          targetUserId={menuPost.user_id}
          targetUsername={menuPost.profiles?.username}
          onClose={() => {
            setReportOpen(false);
            setMenuPost(null);
          }}
          onBlocked={() => {
            setPosts((prev) => prev.filter((p) => p.user_id !== menuPost.user_id));
            setReportOpen(false);
            setMenuPost(null);
            loadPosts();
          }}
        />
      )}

      {whyPost && (
        <Sheet onClose={() => setWhyPost(null)}>
          <div className="px-4 py-3">
            <p className="text-sm text-white font-medium mb-1">Why you saw this</p>
            <p className="text-sm text-neutral-400">{whyPost.why}</p>
            <p className="text-xs text-neutral-600 mt-3">
              Contrest ranks by recency, accounts you engage with, and interests — not a public rank list.
            </p>
          </div>
          <SheetBtn label="Close" onClick={() => setWhyPost(null)} />
        </Sheet>
      )}

      {shareToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 glass-strong px-4 py-2 rounded-full text-sm text-white shadow-lg">
          {shareToast}
        </div>
      )}
    </div>
  );
}

function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md glass-strong rounded-t-2xl sm:rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-2">{children}</div>
      </div>
    </div>
  );
}

function SheetBtn({
  icon,
  label,
  onClick,
  danger,
}: {
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 text-left ${
        danger ? 'text-red-300' : 'text-neutral-200'
      }`}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export type { Profile };
