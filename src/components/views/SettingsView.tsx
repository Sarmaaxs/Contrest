import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  UserPlus,
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
  Clock,
  Heart,
  MessageCircle,
  Type,
  Smartphone,
  Globe,
  Trash2,
  HelpCircle,
  Info,
  ShieldCheck,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import type { LogoVariant, ThemeAccent } from '@/lib/supabase';
import Logo from '@/components/shared/Logo';
import TermsView from '@/components/views/TermsView';
import PrivacyPolicyView from '@/components/views/PrivacyPolicyView';
import CommunityGuidelinesView from '@/components/views/CommunityGuidelinesView';
import HelpCenterView from '@/components/views/HelpCenterView';
import TwoFactorSetup from '@/components/security/TwoFactorSetup';
import { checkPasswordStrength } from '@/lib/security';
import {
  isScreenTimeReminderOn,
  setScreenTimeReminderOn,
  getScreenTimeMinutes,
  setScreenTimeMinutes,
} from '@/lib/screenTime';
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
  | 'security'
  | 'password'
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
  const toast = useToast();
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [isPrivate, setIsPrivate] = useState(!!profile?.is_private);
  const [logoVariant, setLogoVariant] = useState<LogoVariant>(
    getStoredLogoVariant(profile?.logo_variant ?? 'official')
  );
  const [accent, setAccent] = useState<ThemeAccent>(getStoredAccent(profile?.theme_accent ?? 'purple'));
  const [blocked, setBlocked] = useState<{ id: string; username: string; full_name: string }[]>([]);
  const [section, setSection] = useState<Section>('main');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Local prefs
  const [typingOn, setTypingOn] = useState(() => getBool(LS.typing, true));
  const [hideLikes, setHideLikes] = useState(() => getBool(LS.hideLikes, false));
  const [quiet, setQuiet] = useState(() => getBool(LS.quiet, false));
  const [dataSaver, setDataSaver] = useState(() => getBool(LS.dataSaver, false));
  const [screenTimeOn, setScreenTimeOn] = useState(() => isScreenTimeReminderOn());
  const [screenTimeMinutes, setScreenTimeMinutesState] = useState(() => getScreenTimeMinutes());
  const [nLikes, setNLikes] = useState(() => getBool(LS.notifLikes, true));
  const [nComments, setNComments] = useState(() => getBool(LS.notifComments, true));
  const [nFollows, setNFollows] = useState(() => getBool(LS.notifFollows, true));
  const [nMsgs, setNMsgs] = useState(() => getBool(LS.notifMsgs, true));
  const [msgAnyone, setMsgAnyone] = useState(() => getBool('contrest_msg_anyone', true));
  const [nowPlaying, setNowPlaying] = useState(() => {
    try { return localStorage.getItem('contrest_now_playing') || ''; } catch { return ''; }
  });

  useEffect(() => {
    setIsPrivate(!!profile?.is_private);
  }, [profile]);

  useEffect(() => {
    applyAccent(accent);
    document.documentElement.dataset.quiet = quiet ? '1' : '0';
    document.documentElement.dataset.dataSaver = dataSaver ? '1' : '0';
  }, [accent, quiet, dataSaver]);

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
    if (!user) return false;
    setSaving(true);
    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
    if (!error) {
      await refreshProfile();
    } else {
      toast(error.message);
    }
    setSaving(false);
    return !error;
  };

  const exportData = async () => {
    if (!user || exporting) return;
    setExporting(true);
    try {
      const [profileRes, postsRes, commentsRes, likesRes, followsRes, bookmarksRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('posts').select('*').eq('user_id', user.id),
        supabase.from('comments').select('*').eq('user_id', user.id),
        supabase.from('likes').select('*').eq('user_id', user.id),
        supabase.from('follows').select('*').or(`follower_id.eq.${user.id},following_id.eq.${user.id}`),
        supabase.from('bookmarks').select('*').eq('user_id', user.id),
      ]);
      const firstError = [profileRes, postsRes, commentsRes, likesRes, followsRes, bookmarksRes].find((r) => r.error)?.error;
      if (firstError) throw new Error(firstError.message);

      const payload = {
        exported_at: new Date().toISOString(),
        profile: profileRes.data,
        posts: postsRes.data ?? [],
        comments: commentsRes.data ?? [],
        likes: likesRes.data ?? [],
        follows: followsRes.data ?? [],
        bookmarks: bookmarksRes.data ?? [],
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contrest-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('Your data export is ready');
    } catch (e: any) {
      toast(e?.message ?? 'Could not export your data');
    } finally {
      setExporting(false);
    }
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

  const changePassword = async () => {
    setPwError(null);
    const strength = checkPasswordStrength(newPassword);
    if (strength.score < 2) {
      setPwError(strength.reasons[0] ?? 'Choose a stronger password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match.');
      return;
    }
    setPwSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwSubmitting(false);
    if (error) {
      setPwError(error.message);
      return;
    }
    setNewPassword('');
    setConfirmPassword('');
    toast('Password updated');
    setSection('account');
  };

  if (showTerms) return <TermsView onBack={() => setShowTerms(false)} />;
  if (showPrivacy) return <PrivacyPolicyView onBack={() => setShowPrivacy(false)} />;
  if (showGuidelines) return <CommunityGuidelinesView onBack={() => setShowGuidelines(false)} />;

  if (section === 'appearance') {
    return (
      <Shell title="Appearance" onBack={() => setSection('main')}>
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
          <p className="text-xs text-neutral-500 mb-2">Now-playing status — type what you&apos;re listening to</p>
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
        <Toggle
          icon={<Clock className="w-4 h-4" />}
          label="Screen time reminders"
          hint={`Check in after ${screenTimeMinutes} min of scrolling`}
          value={screenTimeOn}
          onChange={(v) => {
            setScreenTimeOn(v);
            setScreenTimeReminderOn(v);
          }}
        />
        {screenTimeOn && (
          <div className="flex items-center gap-2 px-4 py-3 -mt-1">
            {[20, 40, 60].map((m) => (
              <button
                key={m}
                onClick={() => {
                  setScreenTimeMinutes(m);
                  setScreenTimeMinutesState(m);
                }}
                className={`text-xs font-medium px-3 py-1.5 rounded-full ${
                  screenTimeMinutes === m ? 'bg-accent text-white' : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                }`}
              >
                {m} min
              </button>
            ))}
          </div>
        )}
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

  if (section === 'security') {
    return <TwoFactorSetup onBack={() => setSection('account')} />;
  }

  if (section === 'password') {
    return (
      <Shell
        title="Change password"
        onBack={() => setSection('account')}
        onEnter={() => {
          setNewPassword('');
          setConfirmPassword('');
          setPwError(null);
        }}
      >
        <div className="glass rounded-2xl p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              autoComplete="new-password"
              className="w-full px-3.5 py-2.5 rounded-lg glass-input text-sm"
            />
            {newPassword.length > 0 && (
              <p className="text-[11px] text-neutral-500 mt-1.5">{checkPasswordStrength(newPassword).label}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full px-3.5 py-2.5 rounded-lg glass-input text-sm"
            />
          </div>
          {pwError && (
            <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {pwError}
            </div>
          )}
          <button
            onClick={changePassword}
            disabled={pwSubmitting || !newPassword || !confirmPassword}
            className="w-full bg-gradient-to-r from-drop-500 to-drop-600 text-white py-2.5 rounded-lg text-sm font-medium hover:brightness-110 disabled:opacity-50"
          >
            {pwSubmitting ? 'Updating…' : 'Update password'}
          </button>
        </div>
      </Shell>
    );
  }

  if (section === 'account') {
    return (
      <Shell title="Account" onBack={() => setSection('main')}>
        <Row icon={<KeyRound className="w-4 h-4" />} label="Change password" onClick={() => setSection('password')} />
        <Row
          icon={<ShieldCheck className="w-4 h-4" />}
          label="Two-factor authentication"
          onClick={() => setSection('security')}
        />
        <Row icon={<Download className="w-4 h-4" />} label="Download your data" hint={exporting ? 'Preparing…' : 'JSON export'} onClick={exportData} />
        <Row
          icon={<Trash2 className="w-4 h-4" />}
          label="Deactivate account"
          hint="Contact support"
          danger
          onClick={() => {
            window.location.href = 'mailto:hezkiastadese@gmail.com?subject=Deactivate%20my%20Contrest%20account';
          }}
        />
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
        <Row icon={<FileText className="w-4 h-4" />} label="Privacy Policy" onClick={() => setShowPrivacy(true)} />
        <Row icon={<ShieldCheck className="w-4 h-4" />} label="Community Guidelines" onClick={() => setShowGuidelines(true)} />
        <Row icon={<Info className="w-4 h-4" />} label="Built by" hint="Hyder · Sarem" />
        <a
          href="mailto:hezkiastadese@gmail.com,supportsarmaxstream@gmail.com"
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl glass hover:bg-white/[0.08] text-left text-neutral-200"
        >
          <span className="text-neutral-400 text-sm">✉</span>
          <span className="text-sm font-medium flex-1">Contact support</span>
          <span className="text-xs text-neutral-500 truncate max-w-[140px]">2 addresses</span>
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
        <Row
          icon={<UserPlus className="w-4 h-4" />}
          label="Invite friends"
          onClick={async () => {
            const link = `${window.location.origin}/?ref=${user?.id ?? ''}`;
            await navigator.clipboard.writeText(link);
            toast('Invite link copied');
          }}
        />
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
