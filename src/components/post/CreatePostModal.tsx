import { useEffect, useRef, useState } from 'react';
import {
  X,
  Image as ImageIcon,
  Video as VideoIcon,
  Camera,
  ChevronLeft,
  Music2,
  Sparkles,
  FlipHorizontal,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { moderateText } from '@/lib/moderation';
import { extractHashtags } from '@/lib/feed';
import { isVideoFile, validateMediaFile } from '@/lib/upload';
import { uploadAny } from '@/lib/storageProviders';
import PreUploadEditor from '@/components/post/PreUploadEditor';
import MusicSelector from '@/components/shared/MusicSelector';
import type { AudiusTrack } from '@/lib/audius';

type Step = 'capture' | 'compose';

export default function CreatePostModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const [step, setStep] = useState<Step>('capture');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [showEditor, setShowEditor] = useState(false);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'close_friends'>('public');
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [music, setMusic] = useState<AudiusTrack | null>(null);
  const [uploadPct, setUploadPct] = useState(0);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const pickFile = (f: File | null | undefined) => {
    if (!f) return;
    const err = validateMediaFile(f, 'media');
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setFile(f);
    setMediaType(isVideoFile(f) ? 'video' : 'image');
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
    setStep('compose');
  };

  const clearMedia = () => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setStep('capture');
    setMusic(null);
    setCaption('');
  };

  const submit = async () => {
    if (!user) return;
    if (!file) {
      setError('Pick a photo or video first.');
      return;
    }
    const mod = moderateText(caption);
    if (!mod.allowed) {
      setError(mod.reason ?? 'Content blocked by community guidelines.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setProgress('Uploading…');
    setUploadPct(12);
    const tick = window.setInterval(() => {
      setUploadPct((p) => Math.min(p + 8, 88));
    }, 400);
    try {
      const { url } = await uploadAny(user.id, file, 'media');
      setUploadPct(92);
      setProgress('Posting…');
      const musicFields = music
        ? {
            music_track_id: music.id,
            music_title: music.title,
            music_artist: music.user.name,
            music_stream_url: music.streamUrl,
            music_artwork_url: music.artwork?.['150x150'] ?? music.artwork?.['480x480'] ?? null,
          }
        : {};

      let insertError = (
        await supabase.from('posts').insert({
          user_id: user.id,
          media_url: url,
          media_type: mediaType,
          content_origin: 'human',
          caption: caption.trim() || null,
          is_flagged: mod.flagged,
          visibility,
          hashtags: extractHashtags(caption),
          ...musicFields,
        })
      ).error;
      if (insertError && /music_|is_flagged|visibility|content_origin|schema cache/i.test(insertError.message)) {
        insertError = (
          await supabase.from('posts').insert({
            user_id: user.id,
            media_url: url,
            media_type: mediaType,
            caption: caption.trim() || null,
            hashtags: extractHashtags(caption),
          })
        ).error;
      }
      if (insertError) throw new Error(insertError.message);
      setUploadPct(100);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed. Check Storage buckets.');
    } finally {
      window.clearInterval(tick);
      setSubmitting(false);
      setProgress(null);
    }
  };

  // ── Full-screen TikTok-style shell ──────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col">
      {/* Top bar */}
      <header className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        {step === 'compose' ? (
          <button
            type="button"
            onClick={clearMedia}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        <span className="text-sm font-semibold tracking-wide drop-shadow">
          {step === 'capture' ? 'Create' : 'New post'}
        </span>
        {step === 'compose' ? (
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !file}
            className="px-4 py-1.5 rounded-full text-sm font-bold disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #ff0050, #a855f7)' }}
          >
            {submitting ? progress ?? '…' : 'Post'}
          </button>
        ) : (
          <div className="w-10" />
        )}
      </header>

      {/* CAPTURE step — TikTok camera / gallery landing */}
      {step === 'capture' && (
        <div className="flex-1 flex flex-col relative">
          <div className="flex-1 bg-neutral-950 flex flex-col items-center justify-center px-6">
            <div
              className="w-full max-w-sm aspect-[9/16] max-h-[70vh] rounded-3xl border border-white/10 overflow-hidden relative flex flex-col items-center justify-center"
              style={{
                background:
                  'radial-gradient(ellipse at 50% 30%, rgba(168,85,247,0.25), transparent 55%), #0a0a0c',
              }}
            >
              <div className="absolute inset-0 opacity-30 pointer-events-none"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              />
              <div className="relative z-10 flex flex-col items-center gap-4 px-6 text-center">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #ff0050, #a855f7)', boxShadow: '0 0 40px rgba(255,0,80,0.35)' }}
                >
                  <Camera className="w-9 h-9 text-white" />
                </div>
                <div>
                  <p className="text-lg font-bold">Upload a photo or video</p>
                  <p className="text-sm text-neutral-400 mt-1">Up to 50MB · vertical looks best</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom action dock — TikTok style */}
          <div className="pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 px-4 bg-black border-t border-white/10">
            <div className="flex items-end justify-center gap-10 mb-4">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center gap-1.5"
              >
                <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/20 bg-white/10 flex items-center justify-center">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <span className="text-[11px] text-neutral-400">Upload</span>
              </button>

              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="flex flex-col items-center gap-2 -mt-2"
              >
                <div
                  className="w-[72px] h-[72px] rounded-full p-[3px]"
                  style={{ background: 'linear-gradient(135deg, #ff0050, #a855f7, #2fb6e8)' }}
                >
                  <div className="w-full h-full rounded-full bg-black flex items-center justify-center border-4 border-black">
                    <div className="w-14 h-14 rounded-full bg-white" />
                  </div>
                </div>
                <span className="text-[11px] font-medium text-white">Camera</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (fileRef.current) {
                    fileRef.current.accept = 'video/*';
                    fileRef.current.click();
                    // reset accept after
                    setTimeout(() => {
                      if (fileRef.current) fileRef.current.accept = 'image/*,video/*';
                    }, 500);
                  }
                }}
                className="flex flex-col items-center gap-1.5"
              >
                <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                  <VideoIcon className="w-5 h-5" />
                </div>
                <span className="text-[11px] text-neutral-400">Video</span>
              </button>
            </div>
            <p className="text-center text-[11px] text-neutral-500">
              Gallery · Camera · Video — same as TikTok upload
            </p>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*,video/*"
            capture="environment"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
        </div>
      )}

      {/* COMPOSE step — full-bleed preview + caption sheet */}
      {step === 'compose' && preview && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="relative flex-1 min-h-0 bg-black flex items-center justify-center">
            {mediaType === 'video' ? (
              <video
                ref={videoPreviewRef}
                src={preview}
                className="absolute inset-0 w-full h-full object-contain"
                playsInline
                loop
                muted
                autoPlay
                controls
              />
            ) : (
              <img src={preview} alt="preview" className="absolute inset-0 w-full h-full object-contain" />
            )}

            {/* Side tools — TikTok-like */}
            <div className="absolute right-3 bottom-28 flex flex-col gap-4 z-10">
              {mediaType === 'video' && (
                <button
                  type="button"
                  onClick={() => setShowEditor(true)}
                  className="flex flex-col items-center gap-1"
                >
                  <div className="w-11 h-11 rounded-full bg-black/50 backdrop-blur border border-white/20 flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-medium drop-shadow">Edit</span>
                </button>
              )}
              <button type="button" onClick={clearMedia} className="flex flex-col items-center gap-1">
                <div className="w-11 h-11 rounded-full bg-black/50 backdrop-blur border border-white/20 flex items-center justify-center">
                  <FlipHorizontal className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-medium drop-shadow">Retake</span>
              </button>
            </div>

            {submitting && (
              <div className="absolute inset-x-0 top-[max(3.5rem,env(safe-area-inset-top))] px-4 z-20">
                <div className="h-1 rounded-full bg-white/20 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${uploadPct}%`,
                      background: 'linear-gradient(90deg, #ff0050, #a855f7)',
                    }}
                  />
                </div>
                <p className="text-center text-xs text-white/80 mt-2 drop-shadow">{progress}</p>
              </div>
            )}
          </div>

          {/* Bottom compose panel */}
          <div className="bg-[#0a0a0c] border-t border-white/10 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3 max-h-[42vh] overflow-y-auto">
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={2}
              placeholder="Add a caption…"
              className="w-full bg-transparent text-sm text-white placeholder:text-neutral-500 resize-none outline-none"
            />

            <div className="flex items-center gap-2">
              <Music2 className="w-4 h-4 text-accent flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <MusicSelector selected={music} onSelect={setMusic} compact />
              </div>
            </div>

            <div className="flex gap-2">
              {(
                [
                  { id: 'public' as const, label: 'Public' },
                  { id: 'followers' as const, label: 'Followers' },
                  { id: 'close_friends' as const, label: 'Close friends' },
                ]
              ).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVisibility(v.id)}
                  className={`flex-1 py-2 rounded-full text-xs font-semibold transition-colors ${
                    visibility === v.id
                      ? 'text-white'
                      : 'bg-white/5 text-neutral-400'
                  }`}
                  style={
                    visibility === v.id
                      ? { background: 'linear-gradient(135deg, #ff0050, #a855f7)' }
                      : undefined
                  }
                >
                  {v.label}
                </button>
              ))}
            </div>

            {error && (
              <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                {error}
              </div>
            )}
          </div>
        </div>
      )}

      {showEditor && file && (
        <PreUploadEditor
          file={file}
          onCancel={() => setShowEditor(false)}
          onDone={(editedFile) => {
            setFile(editedFile);
            if (preview) URL.revokeObjectURL(preview);
            setPreview(URL.createObjectURL(editedFile));
            setShowEditor(false);
          }}
        />
      )}
    </div>
  );
}
