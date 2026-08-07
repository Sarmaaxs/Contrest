import { useRef, useState } from 'react';
import { X, Image as ImageIcon, Video as VideoIcon, Upload, Camera } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { moderateText } from '@/lib/moderation';
import { extractHashtags } from '@/lib/feed';
import { isVideoFile, validateMediaFile } from '@/lib/upload';
import { uploadAny } from '@/lib/storageProviders';
import PreUploadEditor from '@/components/post/PreUploadEditor';

export default function CreatePostModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [showEditor, setShowEditor] = useState(false);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'close_friends'>('public');
  const [contentOrigin, setContentOrigin] = useState<'ai' | 'human'>('human');
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  };

  const submit = async () => {
    if (!user) return;
    if (!file) {
      setError('Pick a photo or video from your device.');
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
    try {
      const { url } = await uploadAny(user.id, file, 'media');
      setProgress('Posting…');
      // Prefer full schema; fall back if migrations not run yet
      let insertError = (
        await supabase.from('posts').insert({
          user_id: user.id,
          media_url: url,
          media_type: mediaType,
          content_origin: contentOrigin,
          caption: caption.trim() || null,
          is_flagged: mod.flagged,
          visibility,
          hashtags: extractHashtags(caption),
        })
      ).error;
      if (insertError && /is_flagged|visibility|content_origin|schema cache/i.test(insertError.message)) {
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
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed. Make sure Storage buckets are set up.');
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white/[0.04] backdrop-blur-xl rounded-2xl w-full max-w-lg overflow-hidden border border-white/10 max-h-[90vh] flex flex-col">
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 gap-3 shrink-0">
          <button onClick={onClose} className="p-1.5 hover:bg-white/[0.06] rounded-full shrink-0">
            <X className="w-5 h-5 text-neutral-300" />
          </button>
          <h2 className="font-semibold text-white text-sm sm:text-base truncate">New post</h2>
          <button
            onClick={submit}
            disabled={submitting || !file}
            className="shrink-0 min-w-[4.5rem] px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-accent-grad hover:brightness-110 disabled:opacity-50 whitespace-nowrap"
          >
            {submitting ? (progress ?? '…') : 'Share'}
          </button>
        </header>

        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Device pick — TikTok style */}
          {!preview ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-white/20 hover:border-accent/50 bg-white/[0.03] flex flex-col items-center justify-center gap-3 transition-colors"
              >
                <div className="w-14 h-14 rounded-full bg-accent-grad flex items-center justify-center shadow-accent-sm">
                  <Upload className="w-6 h-6 text-white" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-white">Upload from device</p>
                  <p className="text-xs text-neutral-500 mt-1">Photo or video · up to 50MB</p>
                </div>
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl glass hover:bg-white/[0.08] text-sm text-neutral-200"
                >
                  <Camera className="w-4 h-4 text-accent" />
                  Camera
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl glass hover:bg-white/[0.08] text-sm text-neutral-200"
                >
                  <ImageIcon className="w-4 h-4 text-accent" />
                  Gallery
                </button>
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
          ) : (
            <div className="relative aspect-square w-full bg-black rounded-xl overflow-hidden flex items-center justify-center">
              {mediaType === 'video' ? (
                <video src={preview} controls className="max-h-full max-w-full" />
              ) : (
                <img src={preview} alt="preview" className="w-full h-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (preview) URL.revokeObjectURL(preview);
                  setPreview(null);
                }}
                className="absolute top-2 right-2 p-2 rounded-full bg-black/60 hover:bg-black/80"
              >
                <X className="w-4 h-4 text-white" />
              </button>
              <span className="absolute bottom-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/60 text-white flex items-center gap-1">
                {mediaType === 'video' ? <VideoIcon className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                {mediaType}
              </span>
              {mediaType === 'video' && (
                <button
                  type="button"
                  onClick={() => setShowEditor(true)}
                  className="absolute bottom-2 right-2 text-[11px] font-medium px-3 py-1.5 rounded-full bg-accent-grad text-white hover:brightness-110"
                >
                  Edit
                </button>
              )}
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

          <div>
            <label className="text-xs font-medium text-neutral-300 mb-1.5 block">Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              placeholder="Write a caption…"
              className="w-full px-3.5 py-2.5 rounded-lg glass-input text-sm resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-neutral-300 mb-1.5 block">Who can see this</label>
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
                  className={`flex-1 py-2 rounded-lg text-xs font-medium ${
                    visibility === v.id
                      ? 'bg-accent-grad text-white'
                      : 'bg-white/[0.06] text-neutral-300 hover:bg-white/10'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-neutral-500">
            Tip: tap <span className="text-neutral-300">Edit</span> on a video to trim, add filters, text, or sync effects to the beat · Captions are auto-checked for spam &amp; hate before going live.
          </p>

          {error && (
            <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>
          )}
        </div>
      </div>
    </div>
  );
}
