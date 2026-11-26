import { useEffect, useState } from 'react';
import { ArrowLeft, ShieldCheck, Smartphone, Copy, Check, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';

type Factor = { id: string; friendly_name?: string | null; status: string };
type EnrollState = { factorId: string; qrCode: string; secret: string } | null;

/**
 * TOTP-based two-factor authentication, the same mechanism Google, GitHub,
 * Modern account security systems use: the person scans a QR code
 * with an authenticator app (Google Authenticator, Authy, 1Password, etc.),
 * then confirms one 6-digit code to prove the pairing worked before it's
 * turned on. Runs entirely on Supabase Auth's built-in MFA — no custom
 * backend needed.
 */
export default function TwoFactorSetup({ onBack }: { onBack: () => void }) {
  const toast = useToast();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enroll, setEnroll] = useState<EnrollState>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (!error && data) {
      setFactors(data.totp ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const startEnroll = async () => {
    // Note: Supabase's listFactors() only ever returns already-verified
    // TOTP factors, so an abandoned/unverified factor from a previous
    // attempt can't be detected or cleaned up here. The reachable cleanup
    // path is cancelEnroll(), which unenrolls the in-flight factor if the
    // user backs out mid-setup instead of finishing it.
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (error) {
      toast(error.message);
      return;
    }
    setEnroll({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
  };

  const cancelEnroll = async () => {
    if (enroll) await supabase.auth.mfa.unenroll({ factorId: enroll.factorId });
    setEnroll(null);
    setCode('');
  };

  const confirmEnroll = async () => {
    if (!enroll || code.replace(/\s/g, '').length !== 6) return;
    setVerifying(true);
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
      factorId: enroll.factorId,
    });
    if (challengeErr || !challenge) {
      setVerifying(false);
      toast(challengeErr?.message ?? 'Could not start verification');
      return;
    }
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: enroll.factorId,
      challengeId: challenge.id,
      code: code.replace(/\s/g, ''),
    });
    setVerifying(false);
    if (verifyErr) {
      toast(verifyErr.message || 'Invalid code — try again');
      return;
    }
    toast('Two-factor authentication turned on');
    setEnroll(null);
    setCode('');
    refresh();
  };

  const removeFactor = async (factorId: string) => {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      toast(error.message);
      return;
    }
    toast('Two-factor authentication turned off');
    refresh();
  };

  const copySecret = async () => {
    if (!enroll) return;
    await navigator.clipboard.writeText(enroll.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const hasFactor = factors.some((f) => f.status === 'verified');

  return (
    <div className="min-h-screen app-glow-bg">
      <header className="sticky top-0 z-10 glass border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => (enroll ? cancelEnroll() : onBack())}
          className="p-1.5 hover:bg-white/10 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-neutral-300" />
        </button>
        <h1 className="font-semibold text-white">Two-factor authentication</h1>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-white/15 border-t-drop-400 rounded-full animate-spin" />
          </div>
        ) : enroll ? (
          <div className="glass rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-white font-medium">
              <Smartphone className="w-4 h-4 text-accent" /> Scan with your authenticator app
            </div>
            <p className="text-xs text-neutral-500">
              Use Google Authenticator, Authy, 1Password, or any TOTP app. Can't scan? Enter the code manually.
            </p>
            <div
              className="bg-white rounded-xl p-3 mx-auto w-fit"
              // Supabase returns a trusted, self-generated inline SVG QR code
              // for this factor — nothing user-controlled reaches this DOM.
              dangerouslySetInnerHTML={{ __html: enroll.qrCode }}
            />
            <button
              onClick={copySecret}
              className="w-full flex items-center justify-center gap-2 text-xs font-mono px-3 py-2 rounded-lg bg-white/5 text-neutral-300 hover:bg-white/10"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {enroll.secret}
            </button>
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                Enter the 6-digit code from the app
              </label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                inputMode="numeric"
                placeholder="000000"
                className="w-full px-3.5 py-2.5 rounded-lg glass-input text-sm tracking-widest text-center"
              />
            </div>
            <button
              onClick={confirmEnroll}
              disabled={verifying || code.length !== 6}
              className="w-full bg-gradient-to-r from-drop-500 to-drop-600 text-white py-2.5 rounded-lg text-sm font-medium hover:brightness-110 disabled:opacity-50"
            >
              {verifying ? 'Verifying…' : 'Confirm & turn on'}
            </button>
          </div>
        ) : (
          <>
            <div className="glass rounded-2xl p-5 flex items-start gap-3">
              <ShieldCheck className={`w-5 h-5 mt-0.5 ${hasFactor ? 'text-emerald-400' : 'text-neutral-500'}`} />
              <div>
                <p className="text-sm font-medium text-white">
                  {hasFactor ? 'Two-factor authentication is on' : 'Two-factor authentication is off'}
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  {hasFactor
                    ? "You'll need a code from your authenticator app to sign in on new devices."
                    : 'Add an extra layer of security so a stolen password alone can\'t get into your account.'}
                </p>
              </div>
            </div>

            {factors.length > 0 && (
              <div className="space-y-2">
                {factors.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 px-4 py-3 rounded-xl glass">
                    <Smartphone className="w-4 h-4 text-neutral-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">{f.friendly_name || 'Authenticator app'}</p>
                      <p className="text-xs text-neutral-500 capitalize">{f.status}</p>
                    </div>
                    <button
                      onClick={() => removeFactor(f.id)}
                      className="p-2 rounded-lg hover:bg-white/10 text-red-400"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!hasFactor && (
              <button
                onClick={startEnroll}
                className="w-full bg-gradient-to-r from-drop-500 to-drop-600 text-white py-2.5 rounded-lg text-sm font-medium hover:brightness-110"
              >
                Set up two-factor authentication
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
