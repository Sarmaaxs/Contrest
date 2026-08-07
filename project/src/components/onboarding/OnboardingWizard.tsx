import { useRef, useState } from 'react';
import { Camera, ArrowRight, ArrowLeft, Check, Lock, Globe } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { uploadAny } from '@/lib/storageProviders';
import { useAuth } from '@/context/AuthContext';
import Logo from '@/components/shared/Logo';
import Avatar from '@/components/shared/Avatar';

const INTEREST_OPTIONS = [
  'Comedy', 'Music', 'Gaming', 'Sports', 'Fashion', 'Food', 'Tech',
  'Art', 'Dance', 'Fitness', 'Travel', 'Beauty', 'Pets', 'Movies & TV',
  'Cars', 'Photography', 'DIY', 'Business', 'Education', 'News',
];

const TOTAL_STEPS = 4;

export default function OnboardingWizard({ onDone }: { onDone: () => void }) {
  const { user, profile, refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [interests, setInterests] = useState<string[]>(profile?.interests ?? []);
  const [isPrivate, setIsPrivate] = useState(profile?.is_private ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleInterest = (tag: string) => {
    setInterests((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const pickAvatar = async (file: File) => {
    if (!user) return;
    setUploadingAvatar(true);
    try {
      const { url } = await uploadAny(user.id, file, 'avatar');
      setAvatarUrl(url);
    } catch (e: any) {
      setError(e?.message ?? 'Could not upload photo');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const finish = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from('profiles')
      .update({
        avatar_url: avatarUrl,
        bio: bio.trim() || null,
        interests,
        is_private: isPrivate,
        onboarded: true,
      })
      .eq('id', user.id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    await refreshProfile();
    onDone();
  };

  const skipAll = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from('profiles').update({ onboarded: true }).eq('id', user.id);
    setSaving(false);
    await refreshProfile();
    onDone();
  };

  return (
    <div className="min-h-screen app-glow-bg flex items-center justify-center p-4 relative overflow-hidden text-white">
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-drop-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 w-96 h-96 rounded-full bg-drop-400/10 blur-3xl" />

      <div className="w-full max-w-md relative">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Logo size={28} animated={false} />
            <span className="font-semibold tracking-tight">Set up your account</span>
          </div>
          <button onClick={skipAll} disabled={saving} className="text-xs text-neutral-500 hover:text-neutral-300">
            Skip for now
          </button>
        </div>

        <div className="flex gap-1.5 mb-6">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i < step ? 'bg-accent-grad' : 'bg-white/10'}`} />
          ))}
        </div>

        <div className="glass-strong rounded-2xl p-6 shadow-2xl shadow-black/40">
          {step === 1 && (
            <StepShell title="Add a profile photo" subtitle="Helps people recognize you. You can change this anytime.">
              <div className="flex flex-col items-center py-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-28 h-28 rounded-full overflow-hidden group"
                  disabled={uploadingAvatar}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <Avatar url={null} name={profile?.full_name} size="2xl" />
                  )}
                  <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                    <Camera className="w-6 h-6 text-white" />
                  </span>
                  {uploadingAvatar && (
                    <span className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </span>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) pickAvatar(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 text-sm font-medium text-accent hover:opacity-80"
                >
                  {avatarUrl ? 'Change photo' : 'Upload a photo'}
                </button>
              </div>
            </StepShell>
          )}

          {step === 2 && (
            <StepShell title="Write a short bio" subtitle="Tell people a little about yourself. Optional.">
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 150))}
                placeholder="e.g. Editing videos & posting whatever's fun 🎬"
                rows={4}
                className="w-full px-3.5 py-2.5 rounded-lg glass-input text-sm resize-none"
              />
              <p className="text-right text-[11px] text-neutral-500 mt-1">{bio.length}/150</p>
            </StepShell>
          )}

          {step === 3 && (
            <StepShell title="What are you into?" subtitle="Pick a few — this shapes your For You feed.">
              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleInterest(tag)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                      interests.includes(tag)
                        ? 'bg-accent-grad text-white border-transparent'
                        : 'bg-white/[0.04] text-neutral-300 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </StepShell>
          )}

          {step === 4 && (
            <StepShell title="Choose your privacy" subtitle="You can change this later in Settings → Privacy.">
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setIsPrivate(false)}
                  className={`w-full flex items-start gap-3 p-3.5 rounded-xl text-left border ${
                    !isPrivate ? 'border-accent bg-white/[0.06]' : 'border-white/10 bg-white/[0.02]'
                  }`}
                >
                  <Globe className="w-5 h-5 text-neutral-300 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-white">Public</p>
                    <p className="text-xs text-neutral-500">Anyone can see your posts and follow you instantly.</p>
                  </div>
                  {!isPrivate && <Check className="w-4 h-4 text-accent ml-auto shrink-0" />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrivate(true)}
                  className={`w-full flex items-start gap-3 p-3.5 rounded-xl text-left border ${
                    isPrivate ? 'border-accent bg-white/[0.06]' : 'border-white/10 bg-white/[0.02]'
                  }`}
                >
                  <Lock className="w-5 h-5 text-neutral-300 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-white">Private</p>
                    <p className="text-xs text-neutral-500">People need to request to follow you before seeing your posts.</p>
                  </div>
                  {isPrivate && <Check className="w-4 h-4 text-accent ml-auto shrink-0" />}
                </button>
              </div>
            </StepShell>
          )}

          {error && (
            <div className="mt-4 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 mt-6">
            {step > 1 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="px-4 py-2.5 rounded-lg text-sm font-medium text-neutral-300 hover:bg-white/5 flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
            <button
              onClick={() => (step < TOTAL_STEPS ? setStep((s) => s + 1) : finish())}
              disabled={saving || uploadingAvatar}
              className="flex-1 bg-gradient-to-r from-drop-500 to-drop-600 text-white py-2.5 rounded-lg text-sm font-medium hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {saving ? 'Saving…' : step < TOTAL_STEPS ? (
                <>
                  Continue <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                "Let's go"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-1">{title}</h2>
      <p className="text-sm text-neutral-500 mb-5">{subtitle}</p>
      {children}
    </div>
  );
}
