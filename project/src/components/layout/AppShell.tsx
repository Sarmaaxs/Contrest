import { useEffect, useState } from 'react';
import { Home, MessageCircle, User, Plus, Search, Radio, Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import FeedView from '@/components/views/FeedView';
import MessagesView from '@/components/views/MessagesView';
import ProfileView from '@/components/views/ProfileView';
import SettingsView from '@/components/views/SettingsView';
import CreatePostModal from '@/components/post/CreatePostModal';
import ExploreView from '@/components/views/ExploreView';
import LiveView from '@/components/views/LiveView';
import NotificationsView from '@/components/views/NotificationsView';
import Logo from '@/components/shared/Logo';
import type { LogoVariant } from '@/lib/supabase';
import { getStoredLogoVariant, getStoredAccent, applyAccent } from '@/lib/prefs';

export type View = 'home' | 'explore' | 'create' | 'messages' | 'profile' | 'settings' | 'live' | 'notifications';

export default function AppShell() {
  const [view, setView] = useState<View>('home');
  const [showCreate, setShowCreate] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [deepLinkPostId, setDeepLinkPostId] = useState<string | null>(null);
  const { profile } = useAuth();
  const logoVariant: LogoVariant = getStoredLogoVariant(profile?.logo_variant ?? 'official');

  useEffect(() => {
    applyAccent(getStoredAccent(profile?.theme_accent ?? 'purple'));
  }, [profile?.theme_accent]);

  const openProfile = (userId?: string, postId?: string) => {
    setProfileUserId(userId ?? null);
    setDeepLinkPostId(postId ?? null);
    setView('profile');
  };

  return (
    <div className="min-h-screen app-glow-bg flex text-white">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex flex-col w-64 border-r border-white/10 glass sticky top-0 h-screen py-6 px-4">
        <div className="flex items-center gap-2 px-2 mb-8">
          <Logo size={32} animated={false} variant={logoVariant} />
          <span className="font-semibold text-lg tracking-tight text-white">Contrest</span>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          <NavItem icon={<Home className="w-5 h-5" />} label="Home" active={view === 'home'} onClick={() => setView('home')} />
          <NavItem icon={<Search className="w-5 h-5" />} label="Explore" active={view === 'explore'} onClick={() => setView('explore')} />
          <NavItem icon={<Bell className="w-5 h-5" />} label="Notifications" active={view === 'notifications'} onClick={() => setView('notifications')} />
          <NavItem icon={<Radio className="w-5 h-5" />} label="Live" active={view === 'live'} onClick={() => setView('live')} />
          <NavItem icon={<Plus className="w-5 h-5" />} label="Create" active={false} onClick={() => setShowCreate(true)} />
          <NavItem icon={<MessageCircle className="w-5 h-5" />} label="Messages" active={view === 'messages'} onClick={() => setView('messages')} />
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
          <button onClick={() => setView('notifications')} className="p-1.5 hover:bg-white/10 rounded-lg">
            <Bell className="w-5 h-5 text-neutral-200" />
          </button>
          <button onClick={() => setView('messages')} className="p-1.5 hover:bg-white/10 rounded-lg relative">
            <MessageCircle className="w-5 h-5 text-neutral-200" />
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
        {view === 'messages' && <MessagesView onOpenProfile={(id) => openProfile(id)} />}
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
        {view === 'live' && <LiveView onBack={() => setView('home')} />}
        {view === 'notifications' && (
          <NotificationsView
            onBack={() => setView('home')}
            onOpenProfile={(id, postId) => openProfile(id, postId)}
          />
        )}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 glass border-t border-white/10 flex items-center justify-around h-16 pb-1">
        <MobileNav icon={<Home className="w-6 h-6" />} active={view === 'home'} onClick={() => setView('home')} />
        <MobileNav icon={<Search className="w-6 h-6" />} active={view === 'explore'} onClick={() => setView('explore')} />
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
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-4 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-white/10 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200'
      }`}
    >
      {icon}
      {label}
    </button>
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
