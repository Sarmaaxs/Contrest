import type { View } from '@/components/layout/AppShell';

/** Small dependency-free router: shareable profile, post and conversation URLs. */
export type RouteState = {
  view: View;
  profileUserId: string | null;
  postId: string | null;
  conversationId: string | null;
  projectId: string | null;
};

export function stateToPath(
  view: View,
  profileUserId: string | null,
  postId: string | null = null,
  conversationId: string | null = null,
  projectId: string | null = null,
): string {
  if (view === 'profile') return profileUserId ? `/u/${encodeURIComponent(profileUserId)}` : '/profile';
  if (view === 'shared' && postId) return `/post/${encodeURIComponent(postId)}`;
  if (view === 'messages' && conversationId) return `/messages/${encodeURIComponent(conversationId)}`;
  if (view === 'studio' && projectId) return `/studio/${encodeURIComponent(projectId)}`;
  if (view === 'home') return '/';
  return `/${view}`;
}

const KNOWN_VIEWS: View[] = [
  'home', 'explore', 'reels', 'messages', 'profile', 'settings', 'live', 'notifications', 'studio',
];

export function pathToState(pathname: string): RouteState {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/') return { view: 'home', profileUserId: null, postId: null, conversationId: null, projectId: null };

  const profileMatch = clean.match(/^\/u\/([^/]+)$/);
  if (profileMatch) return { view: 'profile', profileUserId: decodeURIComponent(profileMatch[1]), postId: null, conversationId: null, projectId: null };

  const postMatch = clean.match(/^\/post\/([^/]+)$/);
  if (postMatch) return { view: 'shared', profileUserId: null, postId: decodeURIComponent(postMatch[1]), conversationId: null, projectId: null };

  const messageMatch = clean.match(/^\/messages\/([^/]+)$/);
  if (messageMatch) return { view: 'messages', profileUserId: null, postId: null, conversationId: decodeURIComponent(messageMatch[1]), projectId: null };

  const studioMatch = clean.match(/^\/studio\/([^/]+)$/);
  if (studioMatch) return { view: 'studio', profileUserId: null, postId: null, conversationId: null, projectId: decodeURIComponent(studioMatch[1]) };

  const seg = clean.replace(/^\//, '') as View;
  if (KNOWN_VIEWS.includes(seg)) return { view: seg, profileUserId: null, postId: null, conversationId: null, projectId: null };

  return { view: 'home', profileUserId: null, postId: null, conversationId: null, projectId: null };
}
