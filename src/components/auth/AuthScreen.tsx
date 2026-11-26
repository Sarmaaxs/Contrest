import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Mail, Eye, EyeOff, KeyRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Logo from '@/components/shared/Logo';
import TermsView from '@/components/views/TermsView';
import PrivacyPolicyView from '@/components/views/PrivacyPolicyView';
import { checkPasswordStrength } from '@/lib/security';

type Mode = 'signin' | 'signup' | 'forgot' | 'otp';

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [otpInfo, setOtpInfo] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOtpInfo(null);

    try {
      // Step 1 — request recovery OTP (uses your Supabase Auth custom SMTP automatically)
      if (mode === 'forgot') {
        if (!email.trim()) {
          setError('Enter the email on your account.');
          return;
        }
        setSubmitting(true);
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          // OTP flow does not need a deep link; still safe to pass origin
          redirectTo: window.location.origin,
        });
        if (resetErr) {
          setError(resetErr.message);
          return;
        }
        setMode('otp');
        setOtp('');
        setNewPassword('');
        setOtpInfo('We emailed a one-time code. Enter it below with your new password.');
        return;
      }

      // Step 2 — verify OTP + set new password
      if (mode === 'otp') {
        const code = otp.replace(/\s/g, '');
        if (!code || code.length < 6) {
          setError('Enter the 6-digit code from your email.');
          return;
        }
        if (newPassword.length < 6) {
          setError('New password must be at least 6 characters.');
          return;
        }
        setSubmitting(true);
        const { data, error: verifyErr } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: code,
          type: 'recovery',
        });
        if (verifyErr) {
          setError(verifyErr.message || 'Invalid or expired code. Request a new one.');
          return;
        }
        if (!data.session) {
          setError('Code accepted but session missing. Try again.');
          return;
        }
        const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
        if (updateErr) {
          setError(updateErr.message);
          return;
        }
        // Signed in with new password — Root will pick up session
        setMode('signin');
        setPassword('');
        setNewPassword('');
        setOtp('');
        setOtpInfo(null);
        return;
      }

      if (mode === 'signup') {
        if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
          setError('Enter a valid email address.');
          return;
        }
        if (password !== confirmPassword) {
          setError("Passwords don't match.");
          return;
        }
      }

      setSubmitting(true);
      const result =
        mode === 'signin'
          ? await signIn(email, password)
          : await signUp(email, password, username, fullName);
      if (result.error) {
        setError(result.error);
      } else if ('needsEmailConfirmation' in result && result.needsEmailConfirmation) {
        setCheckEmail(true);
      }
    } catch {
      // A thrown error here means the request never reached Supabase at all
      // (offline, DNS failure, CORS) — without this catch, `submitting`
      // would stay true forever and the button would look permanently stuck.
      setError('Network error — check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    setError(null);
    setOauthLoading(provider);
    try {
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      });
      if (oauthErr) setError(oauthErr.message);
    } catch {
      setError('Network error — check your connection and try again.');
    } finally {
      setOauthLoading(null);
    }
  };

  const resendOtp = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      if (resetErr) setError(resetErr.message);
      else setOtpInfo('A new code was sent to your email.');
    } catch {
      setError('Network error — check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (showTerms) {
    return <TermsView onBack={() => setShowTerms(false)} />;
  }
  if (showPrivacy) {
    return <PrivacyPolicyView onBack={() => setShowPrivacy(false)} />;
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
              ? 'Good to see you again.'
              : mode === 'signup'
                ? 'Join and start sharing in under a minute.'
                : mode === 'otp'
                  ? 'Enter the code from your email.'
                  : 'Reset your password with a one-time code.'}
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
                We sent a confirmation to <span className="text-neutral-200">{email}</span>. Confirm it, then sign in.
              </p>
              <button
                onClick={() => {
                  setCheckEmail(false);
                  setMode('signin');
                }}
                className="mt-5 text-sm font-medium text-drop-400 hover:text-drop-300"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              {mode !== 'forgot' && mode !== 'otp' && (
                <div className="space-y-2 mb-5">
                  <button
                    type="button"
                    onClick={() => handleOAuth('google')}
                    disabled={oauthLoading !== null}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg glass text-sm text-neutral-200 hover:bg-white/10 disabled:opacity-50"
                  >
                    {oauthLoading === 'google' ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <GoogleIcon />
                    )}
                    {oauthLoading === 'google' ? 'Redirecting…' : 'Continue with Google'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOAuth('github')}
                    disabled={oauthLoading !== null}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg glass text-sm text-neutral-200 hover:bg-white/10 disabled:opacity-50"
                  >
                    {oauthLoading === 'github' ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <GithubIcon />
                    )}
                    {oauthLoading === 'github' ? 'Redirecting…' : 'Continue with GitHub'}
                  </button>
                  <div className="relative my-3">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-2 bg-transparent text-neutral-500">or</span>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                {mode === 'signup' && (
                  <>
                    <Field label="Full name">
                      <input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 rounded-lg glass-input text-sm"
                      />
                    </Field>
                    <Field label="Username">
                      <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 rounded-lg glass-input text-sm"
                      />
                    </Field>
                  </>
                )}

                {(mode === 'signin' || mode === 'signup' || mode === 'forgot') && (
                  <Field label="Email">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                      className="w-full px-3.5 py-2.5 rounded-lg glass-input text-sm"
                      autoComplete="email"
                    />
                  </Field>
                )}

                {mode === 'otp' && (
                  <>
                    <p className="text-xs text-neutral-400 mb-1">
                      Code sent to <span className="text-neutral-200">{email}</span>
                    </p>
                    <Field label="One-time code (OTP)">
                      <div className="relative">
                        <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                        <input
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, '').slice(0, 8))}
                          required
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="6-digit code"
                          className="w-full pl-9 pr-3.5 py-2.5 rounded-lg glass-input text-sm tracking-widest"
                        />
                      </div>
                    </Field>
                    <Field label="New password">
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                          minLength={6}
                          placeholder="New password"
                          className="w-full px-3.5 py-2.5 pr-10 rounded-lg glass-input text-sm"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          tabIndex={-1}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-200"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </Field>
                    {otpInfo && <p className="text-xs text-drop-400">{otpInfo}</p>}
                    <button
                      type="button"
                      onClick={resendOtp}
                      disabled={submitting}
                      className="text-xs font-medium text-neutral-400 hover:text-drop-400"
                    >
                      Resend code
                    </button>
                  </>
                )}

                {(mode === 'signin' || mode === 'signup') && (
                  <Field label="Password">
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={mode === 'signup' ? 8 : 6}
                        placeholder="••••••••"
                        className="w-full px-3.5 py-2.5 pr-10 rounded-lg glass-input text-sm"
                        autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        tabIndex={-1}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-200"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {mode === 'signup' && password.length > 0 && <PasswordStrengthMeter password={password} />}
                  </Field>
                )}

                {mode === 'signup' && (
                  <Field label="Confirm password">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className={`w-full px-3.5 py-2.5 rounded-lg glass-input text-sm ${
                        confirmPassword.length > 0 && confirmPassword !== password
                          ? 'ring-1 ring-red-500/50'
                          : ''
                      }`}
                      autoComplete="new-password"
                    />
                    {confirmPassword.length > 0 && confirmPassword !== password && (
                      <p className="text-[11px] text-red-400 mt-1">Passwords don't match</p>
                    )}
                  </Field>
                )}

                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError(null);
                      setOtpInfo(null);
                    }}
                    className="text-xs font-medium text-drop-400 hover:text-drop-300 -mt-2"
                  >
                    Forgot password?
                  </button>
                )}

                {error && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
                  >
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
                        : mode === 'otp'
                          ? 'Verify code & set password'
                          : 'Send reset code'}
                </button>
              </form>

              <div className="mt-5 pt-5 border-t border-white/10 text-center text-sm text-neutral-400">
                {mode === 'signin' ? (
                  <>
                    Don&apos;t have an account?{' '}
                    <button
                      onClick={() => {
                        setMode('signup');
                        setError(null);
                      }}
                      className="font-medium text-drop-400 hover:text-drop-300"
                    >
                      Sign up
                    </button>
                  </>
                ) : (
                  <>
                    {mode === 'forgot' || mode === 'otp' ? 'Remembered it?' : 'Already have an account?'}{' '}
                    <button
                      onClick={() => {
                        setMode('signin');
                        setError(null);
                        setOtpInfo(null);
                      }}
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
          <button
            onClick={() => setShowTerms(true)}
            className="text-neutral-400 hover:text-drop-400 underline underline-offset-2"
          >
            Terms of Service
          </button>{' '}
          and{' '}
          <button
            onClick={() => setShowPrivacy(true)}
            className="text-neutral-400 hover:text-drop-400 underline underline-offset-2"
          >
            Privacy Policy
          </button>
        </p>
      </div>
    </div>
  );
}

/** GitHub/Dropbox-style live strength meter — nudges toward better passwords
 * without blocking anything the server-side rules would still accept. */
function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = checkPasswordStrength(password);
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-emerald-500'];
  return (
    <div className="mt-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= strength.score - 1 ? colors[strength.score] : 'bg-white/10'
            }`}
          />
        ))}
      </div>
      <p className="text-[11px] text-neutral-500 mt-1">
        {strength.label}
        {strength.reasons.length > 0 ? ` — ${strength.reasons[0]}` : ''}
      </p>
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
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.9 32.6 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.4 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.4 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.3 0 10.1-2 13.7-5.3l-6.3-5.3C29.4 35.4 26.9 36 24 36c-5.3 0-9.9-3.4-11.5-8.1l-6.5 5C9.6 39.6 16.3 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.3 5.3C40.9 36 44 30.9 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
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
