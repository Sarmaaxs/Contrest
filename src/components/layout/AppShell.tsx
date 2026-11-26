import { useEffect, useState, useRef } from 'react';
import { Home, MessageCircle, User, Plus, Search, Radio, Bell, Clapperboard, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import FeedView from '@/components/views/FeedView';
import MessagesView from '@/components/views/MessagesView';
import ProfileView from '@/components/views/ProfileView';
import SettingsView from '@/components/views/SettingsView';
import CreatePostModal from '@/components/post/CreatePostModal';
import ExploreView from '@/components/views/ExploreView';
import NotificationsView from '@/components/views/NotificationsView';
import ReelsView from '@/components/views/ReelsView';
import SharedPostView from '@/components/views/SharedPostView';
import StudioView from '@/components/views/StudioView';
import StudioEditorView from '@/components/views/StudioEditorView';
import Logo from '@/components/shared/Logo';
import type { LogoVariant } from '@/lib/supabase';
import { getStoredLogoVariant, getStoredAccent, applyAccent } from '@/lib/prefs';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import ScreenTimeNudge from '@/components/shared/ScreenTimeNudge';
import { maybeNotifySuggestions } from '@/lib/suggestionNotify';
import { stateToPath, pathToState } from '@/lib/router';

export type View = 'home' | 'explore' | 'reels' | 'create' | 'messages' | 'profile' | 'settings' | 'live' | 'notifications' | 'shared' | 'studio';

export default function AppShell() {
  const initialRoute = pathToState(window.location.pathname);
  const [view, setView] = useState<View>(initialRoute.view);
  const [showCreate, setShowCreate] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(initialRoute.profileUserId);
  const [deepLinkPostId, setDeepLinkPostId] = useState<string | null>(initialRoute.view === 'profile' ? null : initialRoute.postId);
  const [sharedPostId, setSharedPostId] = useState<string | null>(initialRoute.postId);
  const [conversationId, setConversationId] = useState<string | null>(initialRoute.conversationId);
  const [studioProjectId, setStudioProjectId] = useState<string | null>(initialRoute.projectId);
  const { user, profile } = useAuth();
  const { unreadNotifications, unreadMessages } = useUnreadCounts();
  const fromPopstateRef = useRef(false);

  // Keep navigation bookmarkable and make browser back/forward a true two-way sync.
  useEffect(() => {
    if (fromPopstateRef.current) {
      fromPopstateRef.current = false;
      return;
    }
    const path = stateToPath(view, profileUserId, view === 'shared' ? sharedPostId : deepLinkPostId, view === 'messages' ? conversationId : null, view === 'studio' ? studioProjectId : null);
    if (path !== window.location.pathname) {
      window.history.pushState({}, '', path);
    }
  }, [view, profileUserId, sharedPostId, deepLinkPostId, conversationId]);

  useEffect(() => {
    const onPopState = () => {
      const next = pathToState(window.location.pathname);
      fromPopstateRef.current = true;
      setView(next.view);
      setProfileUserId(next.profileUserId);
      setSharedPostId(next.postId);
      setDeepLinkPostId(next.view === 'profile' ? null : next.postId);
      setConversationId(next.conversationId);
      setStudioProjectId(next.projectId);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (user) maybeNotifySuggestions(user.id);
  }, [user]);
  const logoVariant: LogoVariant = getStoredLogoVariant(profile?.logo_variant ?? 'official');

  useEffect(() => {
    applyAccent(getStoredAccent(profile?.theme_accent ?? 'purple'));
    try {
      document.documentElement.dataset.quiet = localStorage.getItem('contrest_quiet_mode') === '1' ? '1' : '0';
      document.documentElement.dataset.dataSaver = localStorage.getItem('contrest_data_saver') === '1' ? '1' : '0';
    } catch {
      document.documentElement.dataset.quiet = '0';
      document.documentElement.dataset.dataSaver = '0';
    }
  }, [profile?.theme_accent]);

  // Open a single shared/invited post from ?post=… (invite=1 is optional flag)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const pid = params.get('post');
      if (pid) {
        setSharedPostId(pid);
        setView('shared');
        // Clean query so refresh doesn't trap user, but keep history entry
        const url = new URL(window.location.href);
        url.searchParams.delete('post');
        url.searchParams.delete('invite');
        window.history.replaceState({}, '', url.pathname + url.search);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const openProfile = (userId?: string, postId?: string) => {
    setProfileUserId(userId ?? null);
    setDeepLinkPostId(postId ?? null);
    setConversationId(null);
    setSharedPostId(null);
    setView('profile');
  };

  return (
    <div className="min-h-screen app-glow-bg flex text-white justify-center">
      {/* Phone-width shell on large screens (Figma-style centered column) */}
      <div className="w-full max-w-[430px] md:max-w-none md:flex md:flex-1 min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex flex-col w-64 border-r border-white/10 glass sticky top-0 h-screen py-6 px-4">
        <div className="flex items-center gap-2 px-2 mb-8">
          <Logo size={32} animated={false} variant={logoVariant} />
          <span className="font-semibold text-lg tracking-tight text-white">Contrest</span>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          <NavItem icon={<Home className="w-5 h-5" />} label="Home" active={view === 'home'} onClick={() => setView('home')} />
          <NavItem icon={<Search className="w-5 h-5" />} label="Explore" active={view === 'explore'} onClick={() => setView('explore')} />
          <NavItem icon={<Clapperboard className="w-5 h-5" />} label="Reels" active={view === 'reels'} onClick={() => setView('reels')} />
          <NavItem icon={<Sparkles className="w-5 h-5" />} label="Studio" active={view === 'studio'} onClick={() => setView('studio')} />
          <NavItem icon={<Bell className="w-5 h-5" />} label="Notifications" active={view === 'notifications'} onClick={() => setView('notifications')} count={unreadNotifications} />
          <NavItem icon={<Radio className="w-5 h-5" />} label="Live" active={view === 'live'} onClick={() => setView('live')} badge="Soon" />
          <NavItem icon={<Plus className="w-5 h-5" />} label="Create" active={false} onClick={() => setShowCreate(true)} />
          <NavItem icon={<MessageCircle className="w-5 h-5" />} label="Direct" active={view === 'messages'} onClick={() => setView('messages')} count={unreadMessages} />
          <NavItem icon={<User className="w-5 h-5" />} label="Profile" active={view === 'profile'} onClick={() => openProfile()} />
        </nav>

        <button
          onClick={() => setView('settings')}
          className="flex items-center gap-3 px-2 pt-4 border-t border-white/10 hover:opacity-80"
        >
          <Avatar url={profile?.avatar_url} name={profile?.full_name} />
          <div className="min-w-0 text-left">
            <p className="text-sm font-medium text-white truncate">{profile?.full_name}</p>
            <p className="text-xs text-neutral-400 truncate">@{profile?.username}</p>
          </div>
        </button>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 glass border-b border-white/10 flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <Logo size={26} animated={false} variant={logoVariant} />
          <span className="font-semibold tracking-tight text-white">Contrest</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setView('notifications')} className="p-1.5 hover:bg-white/10 rounded-lg relative">
            <Bell className="w-5 h-5 text-neutral-200" />
            {unreadNotifications > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[15px] h-[15px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-semibold flex items-center justify-center leading-none">
                {unreadNotifications > 99 ? '99+' : unreadNotifications}
              </span>
            )}
          </button>
          <button onClick={() => setView('messages')} className="p-1.5 hover:bg-white/10 rounded-lg relative">
            <MessageCircle className="w-5 h-5 text-neutral-200" />
            {unreadMessages > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[15px] h-[15px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-semibold flex items-center justify-center leading-none">
                {unreadMessages > 99 ? '99+' : unreadMessages}
              </span>
            )}
          </button>
          <button onClick={() => setView('live')} className="p-1.5 hover:bg-white/10 rounded-lg">
            <Radio className="w-5 h-5 text-red-400" />
          </button>
          {view === 'home' && (
            <button onClick={() => setView('explore')} className="p-1.5 hover:bg-white/10 rounded-lg">
              <Search className="w-5 h-5 text-neutral-200" />
            </button>
          )}
          <button onClick={() => setShowCreate(true)} className="p-1.5 hover:bg-white/10 rounded-lg">
            <Plus className="w-5 h-5 text-neutral-200" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 min-w-0 pt-14 md:pt-0 pb-16 md:pb-0">
        {view === 'home' && (
          <FeedView onOpenProfile={(id) => openProfile(id)} onOpenSearch={() => setView('explore')} />
        )}
        {view === 'explore' && <ExploreView onOpenProfile={(id) => openProfile(id)} />}
        {view === 'reels' && <ReelsView />}
        {view === 'studio' && !studioProjectId && <StudioView onBack={() => setView('home')} onOpenProject={(id) => { setStudioProjectId(id); setView('studio'); }} />}
        {view === 'studio' && studioProjectId && <StudioEditorView projectId={studioProjectId} onBack={() => { setStudioProjectId(null); setView('studio'); }} />}
        {view === 'messages' && (
          <MessagesView
            initialConversationId={conversationId ?? undefined}
            onConversationChange={setConversationId}
            onOpenProfile={(id) => openProfile(id)}
          />
        )}
        {view === 'profile' && (
          <ProfileView
            userId={profileUserId ?? undefined}
            initialPostId={deepLinkPostId ?? undefined}
            onOpenSettings={() => setView('settings')}
            onMessage={(id) => {
              try { sessionStorage.setItem('contrest_dm', id); } catch {}
              setView('messages');
            }}
          />
        )}
        {view === 'settings' && <SettingsView onBack={() => setView('profile')} />}
        {view === 'live' && <ComingSoonLive onBack={() => setView('home')} />}
        {view === 'notifications' && (
          <NotificationsView
            onBack={() => setView('home')}
            onOpenProfile={(id, postId) => openProfile(id, postId)}
          />
        )}
        {view === 'shared' && sharedPostId && (
          <SharedPostView
            postId={sharedPostId}
            onBack={() => {
              setSharedPostId(null);
              setView('home');
            }}
            onOpenProfile={(id) => openProfile(id)}
          />
        )}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 glass border-t border-white/10 flex items-center justify-around h-16 pb-1">
        <MobileNav icon={<Home className="w-6 h-6" />} active={view === 'home'} onClick={() => setView('home')} />
        <MobileNav icon={<Search className="w-6 h-6" />} active={view === 'explore'} onClick={() => setView('explore')} />
        <MobileNav icon={<Clapperboard className="w-6 h-6" />} active={view === 'reels'} onClick={() => setView('reels')} />
        <MobileNav
          icon={
            <span className="w-9 h-9 rounded-xl bg-accent-grad flex items-center justify-center shadow-accent-sm">
              <Plus className="w-5 h-5 text-white" />
            </span>
          }
          active={false}
          onClick={() => setShowCreate(true)}
        />
        <MobileNav icon={<User className="w-6 h-6" />} active={view === 'profile'} onClick={() => openProfile()} />
      </nav>

      {showCreate && <CreatePostModal onClose={() => setShowCreate(false)} />}
      <ScreenTimeNudge />
      </div>
    </div>
  );
}

function NavItem({
  icon,
  label,
  active,
  onClick,
  badge,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-4 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-white/10 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200'
      }`}
    >
      <span className="relative">
        {icon}
        {!!count && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center leading-none">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </span>
      <span className="flex-1 text-left">{label}</span>
      {badge && (
        <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-white/10 text-neutral-300">
          {badge}
        </span>
      )}
    </button>
  );
}

function ComingSoonLive({ onBack }: { onBack: () => void }) {
  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center bg-red-500/15 border border-red-500/25">
        <Radio className="w-8 h-8 text-red-400" />
      </div>
      <h2 className="text-xl font-semibold text-white mb-2">Live is coming soon</h2>
      <p className="text-sm text-neutral-400 leading-relaxed mb-6">
        Go live with friends is on the way. We&apos;re polishing the experience — check back in a later update.
      </p>
      <button
        type="button"
        onClick={onBack}
        className="px-5 py-2.5 rounded-full text-sm font-semibold text-white bg-accent-grad"
      >
        Back to home
      </button>
    </div>
  );
}

function MobileNav({ icon, active, onClick }: { icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="p-2">
      <span className={active ? 'text-accent' : 'text-neutral-500'}>{icon}</span>
    </button>
  );
}

function Avatar({ url, name }: { url: string | null | undefined; name: string | undefined }) {
  if (url) {
    return <img src={url} alt={name ?? 'avatar'} className="w-9 h-9 rounded-full object-cover" />;
  }
  const initials = (name ?? '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium text-neutral-200">
      {initials}
    </div>
  );
}
