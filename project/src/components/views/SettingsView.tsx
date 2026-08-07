import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  LogOut,
  FileText,
  Lock,
  Unlock,
  Palette,
  Bell,
  Shield,
  Eye,
  EyeOff,
  UserX,
  ChevronRight,
  Download,
  Moon,
  Volume2,
  VolumeX,
  Wifi,
  Heart,
  MessageCircle,
  Type,
  Smartphone,
  Globe,
  Trash2,
  HelpCircle,
  Info,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { LogoVariant, ThemeAccent } from '@/lib/supabase';
import Logo from '@/components/shared/Logo';
import TermsView from '@/components/views/TermsView';
import HelpCenterView from '@/components/views/HelpCenterView';
import {
  getStoredLogoVariant,
  setStoredLogoVariant,
  getStoredAccent,
  setStoredAccent,
  applyAccent,
} from '@/lib/prefs';

type Section =
  | 'main'
  | 'appearance'
  | 'privacy'
  | 'blocked'
  | 'notifications'
  | 'content'
  | 'messages'
  | 'account'
  | 'about'
  | 'help';

const LS = {
  typing: 'contrest_typing_preview',
  hideLikes: 'contrest_hide_likes',
  quiet: 'contrest_quiet_mode',
  dataSaver: 'contrest_data_saver',
  notifLikes: 'contrest_notif_likes',
  notifComments: 'contrest_notif_comments',
  notifFollows: 'contrest_notif_follows',
  notifMsgs: 'contrest_notif_msgs',
};

function getBool(key: string, fallback = true) {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v === '1';
  } catch {
    return fallback;
  }
}
function setBool(key: string, v: boolean) {
  try {
    localStorage.setItem(key, v ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export default function SettingsView({ onBack }: { onBack: () => void }) {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [showTerms, setShowTerms] = useState(false);
  const [isPrivate, setIsPrivate] = useState(!!profile?.is_private);
  const [logoVariant, setLogoVariant] = useState<LogoVariant>(
    getStoredLogoVariant(profile?.logo_variant ?? 'official')
  );
  const [accent, setAccent] = useState<ThemeAccent>(getStoredAccent(profile?.theme_accent ?? 'purple'));
  const [blocked, setBlocked] = useState<{ id: string; username: string; full_name: string }[]>([]);
  const [section, setSection] = useState<Section>('main');
  const [saving, setSaving] = useState(false);

  // Local prefs
  const [typingOn, setTypingOn] = useState(() => getBool(LS.typing, true));
  const [hideLikes, setHideLikes] = useState(() => getBool(LS.hideLikes, false));
  const [quiet, setQuiet] = useState(() => getBool(LS.quiet, false));
  const [dataSaver, setDataSaver] = useState(() => getBool(LS.dataSaver, false));
  const [nLikes, setNLikes] = useState(() => getBool(LS.notifLikes, true));
  const [nComments, setNComments] = useState(() => getBool(LS.notifComments, true));
  const [nFollows, setNFollows] = useState(() => getBool(LS.notifFollows, true));
  const [nMsgs, setNMsgs] = useState(() => getBool(LS.notifMsgs, true));
  const [msgAnyone, setMsgAnyone] = useState(() => getBool('contrest_msg_anyone', true));
  const [shareLoc, setShareLoc] = useState(() => getBool('contrest_share_loc', false));
  const [nowPlaying, setNowPlaying] = useState(() => {
    try { return localStorage.getItem('contrest_now_playing') || ''; } catch { return ''; }
  });

  useEffect(() => {
    setIsPrivate(!!profile?.is_private);
  }, [profile]);

  useEffect(() => {
    applyAccent(accent);
  }, [accent]);

  const loadBlocked = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('blocks')
      .select('blocked_id, profiles!blocks_blocked_id_fkey(id, username, full_name)')
      .eq('blocker_id', user.id);
    const rows = (data ?? []).map((r: any) => ({
      id: r.profiles?.id ?? r.blocked_id,
      username: r.profiles?.username ?? 'user',
      full_name: r.profiles?.full_name ?? '',
    }));
    setBlocked(rows);
  };

  const persistProfile = async (patch: Record<string, unknown>) => {
    if (!user) return;
    setSaving(true);
    await supabase.from('profiles').update(patch).eq('id', user.id);
    await refreshProfile();
    setSaving(false);
  };

  const togglePrivate = async () => {
    const next = !isPrivate;
    setIsPrivate(next);
    await persistProfile({ is_private: next });
  };

  const chooseLogo = async (v: LogoVariant) => {
    setLogoVariant(v);
    setStoredLogoVariant(v);
    await persistProfile({ logo_variant: v });
  };

  const chooseAccent = async (v: ThemeAccent) => {
    setAccent(v);
    setStoredAccent(v);
    applyAccent(v);
    await persistProfile({ theme_accent: v });
  };

  const unblock = async (id: string) => {
    if (!user) return;
    await supabase.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', id);
    setBlocked((prev) => prev.filter((b) => b.id !== id));
  };

  if (showTerms) return <TermsView onBack={() => setShowTerms(false)} />;

  if (section === 'appearance') {
    return (
      <Shell title="Appearance" onBack={() => setSection('main')}>
        <p className="text-xs text-neutral-500 px-1 mb-3">Logo</p>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {(['official', 'classic'] as LogoVariant[]).map((v) => (
            <button
              key={v}
              onClick={() => chooseLogo(v)}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-colors ${
                logoVariant === v ? 'border-accent bg-accent/10' : 'border-white/10 glass'
              }`}
            >
              <Logo size={44} variant={v} animated={false} />
              <span className="text-[11px] text-neutral-300 capitalize">{v}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-neutral-500 px-1 mb-3">Accent</p>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {(
            [
              { id: 'purple' as ThemeAccent, label: 'Purple', swatch: '#a855f7' },
              { id: 'cyan' as ThemeAccent, label: 'Cyan', swatch: '#2fb6e8' },
              { id: 'white' as ThemeAccent, label: 'White', swatch: '#e5e5e5' },
            ]
          ).map((a) => (
            <button
              key={a.id}
              onClick={() => chooseAccent(a.id)}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border ${
                accent === a.id ? 'border-accent bg-accent/10' : 'border-white/10 glass'
              }`}
            >
              <span className="w-8 h-8 rounded-full" style={{ background: a.swatch }} />
              <span className="text-[11px] text-neutral-300">{a.label}</span>
            </button>
          ))}
        </div>
        <Toggle
          icon={<Moon className="w-4 h-4" />}
          label="Quiet mode"
          hint="Dim glow & reduce motion"
          value={quiet}
          onChange={(v) => {
            setQuiet(v);
            setBool(LS.quiet, v);
            document.documentElement.dataset.quiet = v ? '1' : '0';
          }}
        />
        {saving && <p className="text-xs text-neutral-500 mt-4 text-center">Saving…</p>}
      </Shell>
    );
  }

  if (section === 'privacy') {
    return (
      <Shell title="Privacy" onBack={() => setSection('main')}>
        <button
          onClick={togglePrivate}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl glass hover:bg-white/[0.06] text-left mb-2"
        >
          {isPrivate ? <Lock className="w-5 h-5 text-accent" /> : <Unlock className="w-5 h-5 text-neutral-400" />}
          <div className="flex-1">
            <p className="text-sm font-medium text-white">Private account</p>
            <p className="text-xs text-neutral-500">
              {isPrivate ? 'Only approved followers see your posts' : 'Anyone can follow and see your posts'}
            </p>
          </div>
          <Switch on={isPrivate} />
        </button>
        <Toggle
          icon={<Heart className="w-4 h-4" />}
          label="Hide like counts"
          hint="Only you see totals on your posts"
          value={hideLikes}
          onChange={(v) => {
            setHideLikes(v);
            setBool(LS.hideLikes, v);
          }}
        />
        <Row
          icon={<UserX className="w-4 h-4" />}
          label="Blocked accounts"
          onClick={() => {
            setSection('blocked');
            loadBlocked();
          }}
        />
      </Shell>
    );
  }

  if (section === 'blocked') {
    return (
      <Shell title="Blocked accounts" onBack={() => setSection('privacy')} onEnter={loadBlocked}>
        {blocked.length === 0 ? (
          <p className="text-sm text-neutral-500 text-center py-10">No blocked accounts</p>
        ) : (
          <div className="space-y-2">
            {blocked.map((b) => (
              <div key={b.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl glass">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">@{b.username}</p>
                  <p className="text-xs text-neutral-500 truncate">{b.full_name}</p>
                </div>
                <button
                  onClick={() => unblock(b.id)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-white/10 text-neutral-200"
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </Shell>
    );
  }

  if (section === 'notifications') {
    return (
      <Shell title="Notifications" onBack={() => setSection('main')}>
        <Toggle icon={<Heart className="w-4 h-4" />} label="Likes" value={nLikes} onChange={(v) => { setNLikes(v); setBool(LS.notifLikes, v); }} />
        <Toggle icon={<MessageCircle className="w-4 h-4" />} label="Comments" value={nComments} onChange={(v) => { setNComments(v); setBool(LS.notifComments, v); }} />
        <Toggle icon={<Bell className="w-4 h-4" />} label="New followers" value={nFollows} onChange={(v) => { setNFollows(v); setBool(LS.notifFollows, v); }} />
        <Toggle icon={<Type className="w-4 h-4" />} label="Messages" value={nMsgs} onChange={(v) => { setNMsgs(v); setBool(LS.notifMsgs, v); }} />
        <p className="text-xs text-neutral-500 mt-4 px-1">
          In-app notifications are live (bell icon). These toggles control what gets written when someone interacts with you.
        </p>
      </Shell>
    );
  }

  if (section === 'content') {
    return (
      <Shell title="Content & feed" onBack={() => setSection('main')}>
        <div className="glass rounded-xl p-4 mb-2">
          <p className="text-sm font-medium text-white mb-1">Now playing (friends can see)</p>
          <p className="text-xs text-neutral-500 mb-2">Spotify-style status — type what you&apos;re listening to</p>
          <input
            value={nowPlaying}
            onChange={(e) => setNowPlaying(e.target.value)}
            onBlur={async () => {
              try { localStorage.setItem('contrest_now_playing', nowPlaying); } catch {}
              if (user) {
                await supabase.from('profiles').update({
                  status_emoji: '🎵',
                  status_text: nowPlaying ? `listening:${nowPlaying}` : null,
                } as any).eq('id', user.id);
              }
            }}
            placeholder="Song · Artist"
            className="w-full px-3 py-2 rounded-lg glass-input text-sm"
          />
        </div>
        <Toggle
          icon={<Wifi className="w-4 h-4" />}
          label="Data saver"
          hint="Prefer lower-res media when possible"
          value={dataSaver}
          onChange={(v) => {
            setDataSaver(v);
            setBool(LS.dataSaver, v);
          }}
        />
        <Row icon={<Eye className="w-4 h-4" />} label="Content filters" hint="On · soft AI check" />
        <p className="text-xs text-neutral-500 mt-3 px-1">
          Captions and comments are checked for spam/hate before they go live. Borderline content can be flagged for review.
        </p>
      </Shell>
    );
  }

  if (section === 'messages') {
    return (
      <Shell title="Messages" onBack={() => setSection('main')}>
        <Toggle
          icon={<MessageCircle className="w-4 h-4" />}
          label="Allow messages from anyone"
          hint="Off = only people you follow can message you"
          value={msgAnyone}
          onChange={(v) => {
            setMsgAnyone(v);
            setBool('contrest_msg_anyone', v);
          }}
        />
        <Toggle
          icon={typingOn ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          label="Live typing preview"
          hint="Show what someone is typing before they send (and share yours)"
          value={typingOn}
          onChange={(v) => {
            setTypingOn(v);
            setBool(LS.typing, v);
          }}
        />
        <p className="text-xs text-neutral-500 mt-3 px-1">
          You can also toggle this from the eye icon inside any chat.
        </p>
      </Shell>
    );
  }

  if (section === 'account') {
    return (
      <Shell title="Account" onBack={() => setSection('main')}>
        <Row icon={<Download className="w-4 h-4" />} label="Download your data" hint="Coming soon" />
        <Row icon={<Trash2 className="w-4 h-4" />} label="Deactivate account" hint="Contact support" danger />
      </Shell>
    );
  }

  if (section === 'about') {
    return (
      <Shell title="About" onBack={() => setSection('main')}>
        <div className="glass rounded-2xl p-6 flex flex-col items-center text-center mb-4">
          <Logo size={48} variant={logoVariant} animated={false} className="mb-3" />
          <p className="text-white font-semibold text-lg">Contrest</p>
          <p className="text-xs text-neutral-500 mt-1">v0.2 · social, reimagined</p>
        </div>
        <Row icon={<FileText className="w-4 h-4" />} label="Terms of Service" onClick={() => setShowTerms(true)} />
        <Row icon={<Info className="w-4 h-4" />} label="Built by" hint="Hyder · Sarem" />
        <a
          href="mailto:supportsarmaxstream@gmail.com"
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl glass hover:bg-white/[0.08] text-left text-neutral-200"
        >
          <span className="text-neutral-400 text-sm">✉</span>
          <span className="text-sm font-medium flex-1">Contact support</span>
          <span className="text-xs text-neutral-500 truncate max-w-[140px]">supportsarmaxstream@gmail.com</span>
        </a>
      </Shell>
    );
  }

  if (section === 'help') {
    return <HelpCenterView onBack={() => setSection('about')} />;
  }

  return (
    <div className="min-h-screen app-glow-bg">
      <header className="sticky top-0 z-10 glass border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 hover:bg-white/10 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-neutral-300" />
        </button>
        <h1 className="font-semibold text-white">Settings</h1>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-1">
        <SectionLabel>Preferences</SectionLabel>
        <Row icon={<Palette className="w-4 h-4" />} label="Appearance" onClick={() => setSection('appearance')} />
        <Row icon={<Shield className="w-4 h-4" />} label="Privacy & safety" onClick={() => setSection('privacy')} />
        <Row icon={<Bell className="w-4 h-4" />} label="Notifications" onClick={() => setSection('notifications')} />
        <Row icon={<MessageCircle className="w-4 h-4" />} label="Messages" onClick={() => setSection('messages')} />

        <SectionLabel>Content</SectionLabel>
        <Row icon={<Globe className="w-4 h-4" />} label="Content & feed" onClick={() => setSection('content')} />

        <SectionLabel>Account</SectionLabel>
        <Row icon={<Smartphone className="w-4 h-4" />} label="Account & data" onClick={() => setSection('account')} />

        <SectionLabel>Support</SectionLabel>
        <Row icon={<HelpCircle className="w-4 h-4" />} label="Help center" hint="FAQ + Nuvessia" onClick={() => setSection('help')} />
        <Row icon={<Info className="w-4 h-4" />} label="About Contrest" onClick={() => setSection('about')} />

        <div className="pt-3">
          <Row icon={<LogOut className="w-4 h-4" />} label="Sign out" onClick={signOut} danger />
        </div>
      </div>
    </div>
  );
}

function Shell({
  title,
  onBack,
  children,
  onEnter,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
  onEnter?: () => void;
}) {
  useEffect(() => {
    onEnter?.();
  }, []);
  return (
    <div className="min-h-screen app-glow-bg">
      <header className="sticky top-0 z-10 glass border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 hover:bg-white/10 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-neutral-300" />
        </button>
        <h1 className="font-semibold text-white">{title}</h1>
      </header>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-2">{children}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] uppercase tracking-wider text-neutral-500 px-1 pt-4 pb-1">{children}</p>;
}

function Switch({ on }: { on: boolean }) {
  return (
    <span className={`w-11 h-6 rounded-full relative transition-colors ${on ? 'bg-accent' : 'bg-white/15'}`}>
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
          on ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </span>
  );
}

function Toggle({
  icon,
  label,
  hint,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl glass hover:bg-white/[0.06] text-left"
    >
      <span className="text-neutral-400">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        {hint && <p className="text-xs text-neutral-500">{hint}</p>}
      </div>
      <Switch on={value} />
    </button>
  );
}

function Row({
  icon,
  label,
  onClick,
  danger,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  danger?: boolean;
  hint?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl glass hover:bg-white/[0.08] transition-colors text-left disabled:opacity-70 ${
        danger ? 'text-red-300' : 'text-neutral-200'
      }`}
    >
      <span className={danger ? 'text-red-400' : 'text-neutral-400'}>{icon}</span>
      <span className="text-sm font-medium flex-1">{label}</span>
      {hint && <span className="text-xs text-neutral-500">{hint}</span>}
      {onClick && !danger && <ChevronRight className="w-4 h-4 text-neutral-600" />}
    </button>
  );
}
