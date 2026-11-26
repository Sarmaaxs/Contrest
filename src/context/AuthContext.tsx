import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/supabase';
import { checkRateLimit, resetRateLimit, formatRetryAfter, checkPasswordStrength } from '@/lib/security';
import { checkAndAlertNewDevice } from '@/lib/loginAlerts';

try {
  const _ref = new URLSearchParams(window.location.search).get('ref');
  if (_ref) localStorage.setItem('contrest_ref', _ref);
} catch {
  // ignore
}

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, username: string, fullName: string, extra?: { gender?: string; avatar_preset?: string }) => Promise<{ error: string | null; needsEmailConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const applyPendingProfileFields = async (uid: string) => {
    try {
      const key = `contrest_pending_profile_${uid}`;
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const pending = JSON.parse(raw);
      await supabase.from('profiles').update(pending as any).eq('id', uid);
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  };

  const loadProfile = async (uid: string, retries = 3): Promise<Profile | null> => {
    await applyPendingProfileFields(uid);
    for (let i = 0; i < retries; i++) {
      const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
      if (data) {
        setProfile(data as Profile);
        return data as Profile;
      }
      // Profile row may not exist yet the instant a session appears (trigger
      // race / replication lag right after signup or email confirmation).
      if (i < retries - 1) await new Promise((r) => setTimeout(r, 700));
    }
    setProfile(null);
    return null;
  };

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        setSession(data.session);
        setUser(data.session?.user ?? null);
        if (data.session?.user) {
          await loadProfile(data.session.user.id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      (async () => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        try {
          if (newSession?.user) {
            await loadProfile(newSession.user.id);
            if (event === 'SIGNED_IN') {
              // Fire-and-forget — a slow/failed geolocation lookup should
              // never delay getting the person into the app.
              checkAndAlertNewDevice(newSession.user.id);
            }
          } else {
            setProfile(null);
          }
        } finally {
          setLoading(false);
        }
      })();
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  const signIn = async (email: string, password: string) => {
    // Throttle repeated attempts per email so a script can't hammer the
    // login form. Real abuse prevention lives in Supabase Auth itself, but
    // this stops obvious brute-forcing dead in the browser and gives the
    // person a clear "try again in Ns" message instead of a wall of errors.
    const key = `login:${email.trim().toLowerCase()}`;
    const limit = checkRateLimit(key, { maxAttempts: 5, windowMs: 5 * 60_000 });
    if (!limit.allowed) {
      return { error: `Too many attempts. Try again in ${formatRetryAfter(limit.retryAfterMs)}.` };
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) resetRateLimit(key);
    return { error: error ? error.message : null };
  };

  const signUp = async (
    email: string,
    password: string,
    username: string,
    fullName: string,
    extra?: { gender?: string; avatar_preset?: string }
  ) => {
    const strength = checkPasswordStrength(password);
    if (strength.score < 2) {
      return { error: strength.reasons[0] ?? 'Choose a stronger password.' };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          full_name: fullName,
          gender: extra?.gender ?? null,
          avatar_preset: extra?.avatar_preset ?? null,
          invited_by: localStorage.getItem('contrest_ref') ?? null,
        },
      },
    });
    if (error) return { error: error.message };

    if (!data.session) {
      // Email confirmation pending, no authenticated session yet.
      if (data.user && (extra?.gender || extra?.avatar_preset)) {
        try {
          localStorage.setItem(
            `contrest_pending_profile_${data.user.id}`,
            JSON.stringify({ gender: extra?.gender ?? null, avatar_preset: extra?.avatar_preset ?? null })
          );
        } catch {
          // ignore storage errors
        }
      }
      return { error: null, needsEmailConfirmation: true };
    }

    if (data.user) {
      // Ensure gender/preset land on profile (trigger may only copy username/full_name)
      await supabase
        .from('profiles')
        .update({
          gender: extra?.gender ?? null,
          avatar_preset: extra?.avatar_preset ?? null,
        } as any)
        .eq('id', data.user.id);
      await loadProfile(data.user.id);
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
