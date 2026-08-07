import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Mail, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Logo from '@/components/shared/Logo';
import TermsView from '@/components/views/TermsView';

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'forgot') {
      setSubmitting(true);
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setSubmitting(false);
      if (resetErr) setError(resetErr.message);
      else setResetSent(true);
      return;
    }

    setSubmitting(true);
    const result =
      mode === 'signin'
        ? await signIn(email, password)
        : await signUp(email, password, username, fullName);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
    } else if ('needsEmailConfirmation' in result && result.needsEmailConfirmation) {
      setCheckEmail(true);
    }
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    setError(null);
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (oauthErr) setError(oauthErr.message);
  };

  if (showTerms) {
    return <TermsView onBack={() => setShowTerms(false)} />;
  }

  return (
    <div className="min-h-screen app-glow-bg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-drop-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 w-96 h-96 rounded-full bg-drop-400/10 blur-3xl" />

      <div className="w-full max-w-md relative">
        <div className="flex flex-col items-center mb-8">
          <Logo size={56} variant="official" className="mb-4 drop-shadow-glow-sm" />
          <h1 className="text-3xl font-semibold tracking-tight text-white">Contrest</h1>
          <p className="text-neutral-400 mt-2 text-center text-sm">
            {mode === 'signin'
              ? 'Welcome back. Sign in to continue.'
              : mode === 'signup'
              ? 'Create your account to get started.'
              : 'Reset your password.'}
          </p>
        </div>

        <div className="glass-strong rounded-2xl p-6 shadow-2xl shadow-black/40">
          {checkEmail ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-drop-500/15 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6 text-drop-400" />
              </div>
              <h2 className="text-white font-medium mb-1">Check your inbox</h2>
              <p className="text-sm text-neutral-400">
                We sent a confirmation link to <span className="text-neutral-200">{email}</span>. Confirm it, then sign in below.
              </p>
              <button
                onClick={() => { setCheckEmail(false); setMode('signin'); }}
                className="mt-5 text-sm font-medium text-drop-400 hover:text-drop-300"
              >
                Back to sign in
              </button>
            </div>
          ) : resetSent ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-drop-500/15 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6 text-drop-400" />
              </div>
              <h2 className="text-white font-medium mb-1">Check your inbox</h2>
              <p className="text-sm text-neutral-400">
                We sent a password reset link to <span className="text-neutral-200">{email}</span>.
              </p>
              <button
                onClick={() => { setResetSent(false); setMode('signin'); }}
                className="mt-5 text-sm font-medium text-drop-400 hover:text-drop-300"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              {mode !== 'forgot' && (
                <>
                  <div className="space-y-2 mb-5">
                    <button
                      type="button"
                      onClick={() => handleOAuth('google')}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium bg-white text-neutral-900 hover:brightness-95"
                    >
                      <GoogleIcon />
                      Continue with Google
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOAuth('github')}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium bg-[#181717] text-white hover:brightness-125"
                    >
                      <GithubIcon />
                      Continue with GitHub
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-xs text-neutral-500">or</span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                </>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <>
                    <Field label="Full name">
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        placeholder="Jordan Avery"
                        className="w-full px-3.5 py-2.5 rounded-lg glass-input text-sm"
                      />
                    </Field>
                    <Field label="Username">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">@</span>
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                          required
                          placeholder="jordan"
                          className="w-full pl-7 pr-3.5 py-2.5 rounded-lg glass-input text-sm"
                        />
                      </div>
                    </Field>
                  </>
                )}
                <Field label="Email">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 rounded-lg glass-input text-sm"
                  />
                </Field>

                {mode !== 'forgot' && (
                  <Field label="Password">
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        placeholder="••••••••"
                        className="w-full px-3.5 py-2.5 pr-10 rounded-lg glass-input text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        tabIndex={-1}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-200"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </Field>
                )}

                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setError(null); }}
                    className="text-xs font-medium text-drop-400 hover:text-drop-300 -mt-2"
                  >
                    Forgot password?
                  </button>
                )}

                {error && (
                  <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-gradient-to-r from-drop-500 to-drop-600 text-white py-2.5 rounded-lg text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50 shadow-glow-sm"
                >
                  {submitting
                    ? 'Please wait…'
                    : mode === 'signin'
                    ? 'Sign in'
                    : mode === 'signup'
                    ? 'Create account'
                    : 'Send reset link'}
                </button>
              </form>

              <div className="mt-5 pt-5 border-t border-white/10 text-center text-sm text-neutral-400">
                {mode === 'signin' ? (
                  <>
                    Don't have an account?{' '}
                    <button
                      onClick={() => { setMode('signup'); setError(null); }}
                      className="font-medium text-drop-400 hover:text-drop-300"
                    >
                      Sign up
                    </button>
                  </>
                ) : (
                  <>
                    {mode === 'forgot' ? 'Remembered it?' : 'Already have an account?'}{' '}
                    <button
                      onClick={() => { setMode('signin'); setError(null); }}
                      className="font-medium text-drop-400 hover:text-drop-300"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-neutral-600 mt-6">
          By continuing you agree to our{' '}
          <button onClick={() => setShowTerms(true)} className="text-neutral-400 hover:text-drop-400 underline underline-offset-2">
            Terms of Service
          </button>
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-neutral-400 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.6 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.4 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.4 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.7-5.3l-6.3-5.3C29.4 35.4 26.9 36 24 36c-5.3 0-9.9-3.4-11.5-8.1l-6.5 5C9.6 39.6 16.3 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.3 5.3C40.9 36 44 30.9 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.36-3.37-1.36-.46-1.19-1.11-1.51-1.11-1.51-.91-.64.07-.63.07-.63 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.73 0 0 .84-.28 2.75 1.05a9.28 9.28 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.42.2 2.47.1 2.73.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.57 5.05.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.6.69.49A10.26 10.26 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}
