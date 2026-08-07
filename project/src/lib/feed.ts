import type { Post, Profile } from '@/lib/supabase';

/** Extract #hashtags from caption */
export function extractHashtags(caption: string | null | undefined): string[] {
  if (!caption) return [];
  const tags = caption.match(/#[\w\u00C0-\u024F]+/g) ?? [];
  return [...new Set(tags.map((t) => t.slice(1).toLowerCase()))];
}

export type VisibilityCtx = {
  userId: string;
  followingIds: Set<string>;
  closeFriendOf: Set<string>; // author ids who listed me as close friend
  blockedIds: Set<string>;
  notInterestedPosts: Set<string>;
  notInterestedAuthors: Set<string>;
  mutedKeywords: string[];
};

/**
 * Enforce privacy: public / followers / close_friends + private accounts.
 * Private account posts only visible if you follow them (or it's you).
 */
export function canSeePost(
  post: Post & { profiles?: Profile | null },
  ctx: VisibilityCtx
): boolean {
  if (post.user_id === ctx.userId) return true;
  if (ctx.blockedIds.has(post.user_id)) return false;
  if (ctx.notInterestedPosts.has(post.id)) return false;
  if (ctx.notInterestedAuthors.has(post.user_id)) return false;
  if (post.is_flagged) return false;

  const author = post.profiles;
  if (author?.is_private && !ctx.followingIds.has(post.user_id)) {
    return false;
  }

  const vis = post.visibility ?? 'public';
  if (vis === 'public') {
    // ok if not private-blocked above
  } else if (vis === 'followers') {
    if (!ctx.followingIds.has(post.user_id)) return false;
  } else if (vis === 'close_friends') {
    if (!ctx.closeFriendOf.has(post.user_id)) return false;
  }

  if (ctx.mutedKeywords.length && post.caption) {
    const lower = post.caption.toLowerCase();
    if (ctx.mutedKeywords.some((k) => k && lower.includes(k.toLowerCase()))) return false;
  }

  return true;
}

export type RankSignals = {
  followingIds: Set<string>;
  likedAuthorIds: Set<string>; // authors you've liked before
  myInterests: string[];
  notInterestedAuthors: Set<string>;
};

/**
 * For You ranking — NOT a public leaderboard.
 * Soft score: recency + relationship + light engagement + interest overlap.
 * Penalize authors you marked not interested. No "rank #1" UI.
 */
export function scoreForYou(
  post: Post & { likeCount?: number; commentCount?: number; hashtags?: string[] },
  signals: RankSignals,
  now = Date.now()
): number {
  const ageHrs = Math.max(0.1, (now - new Date(post.created_at).getTime()) / 3_600_000);
  // Recency decay (half-life ~18h)
  const recency = 1 / (1 + ageHrs / 18);

  let relation = 0.15;
  if (signals.followingIds.has(post.user_id)) relation = 0.55;
  if (signals.likedAuthorIds.has(post.user_id)) relation += 0.2;

  const likes = post.likeCount ?? 0;
  const comments = post.commentCount ?? 0;
  // Log engagement so one viral post doesn't dominate forever
  const engagement = Math.log10(2 + likes + comments * 2) / 4;

  const tags = post.hashtags ?? extractHashtags(post.caption);
  let interest = 0;
  if (signals.myInterests.length && tags.length) {
    const hits = tags.filter((t) => signals.myInterests.includes(t)).length;
    interest = Math.min(0.35, hits * 0.12);
  }

  let score = recency * 0.45 + relation * 0.3 + engagement * 0.15 + interest * 0.1;

  if (signals.notInterestedAuthors.has(post.user_id)) score *= 0.05;

  // Small noise so feed isn't identical every refresh
  score += (Math.random() - 0.5) * 0.03;

  return score;
}

export function whyAmISeeingThis(
  post: Post & { hashtags?: string[] },
  signals: RankSignals
): string {
  if (signals.followingIds.has(post.user_id)) return 'You follow this account';
  if (signals.likedAuthorIds.has(post.user_id)) return 'You liked their posts before';
  const tags = post.hashtags ?? extractHashtags(post.caption);
  const hit = tags.find((t) => signals.myInterests.includes(t));
  if (hit) return `Matches interest #${hit}`;
  return 'Popular near your network · recent';
}
