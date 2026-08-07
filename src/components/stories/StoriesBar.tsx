import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, X, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Story, Profile } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import Avatar from '@/components/shared/Avatar';
import { moderateText } from '@/lib/moderation';
import { uploadMedia, isVideoFile, validateMediaFile } from '@/lib/upload';

type StoryGroup = {
  user: Profile;
  stories: Story[];
  seen: boolean;
};

export default function StoriesBar() {
  const { user, profile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [viewer, setViewer] = useState<{ groupIdx: number; storyIdx: number } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('stories')
      .select('*, profiles!stories_user_id_fkey(*)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true });

    const map = new Map<string, StoryGroup>();
    (data ?? []).forEach((s: any) => {
      const st = s as Story;
      const p = st.profiles as Profile;
      if (!p) return;
      const g = map.get(p.id) ?? { user: p, stories: [], seen: false };
      g.stories.push(st);
      map.set(p.id, g);
    });

    const list = Array.from(map.values());
    list.sort((a, b) => {
      if (a.user.id === user.id) return -1;
      if (b.user.id === user.id) return 1;
      return 0;
    });
    setGroups(list);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const pick = (f: File | null | undefined) => {
    if (!f) return;
    const err = validateMediaFile(f, 'media');
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
  };

  const createStory = async () => {
    if (!user || !file) {
      setError('Pick a photo or video from your device');
      return;
    }
    const mod = moderateText(caption);
    if (!mod.allowed) {
      setError(mod.reason ?? 'Blocked by moderation');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { url } = await uploadMedia(user.id, file, 'media');
      const { error: err } = await supabase.from('stories').insert({
        user_id: user.id,
        media_url: url,
        media_type: isVideoFile(file) ? 'video' : 'image',
        caption: caption.trim() || null,
      });
      if (err) throw new Error(err.message);
      setShowCreate(false);
      setFile(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      setCaption('');
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const openGroup = (idx: number) => setViewer({ groupIdx: idx, storyIdx: 0 });

  const current = viewer ? groups[viewer.groupIdx]?.stories[viewer.storyIdx] : null;
  const currentUser = viewer ? groups[viewer.groupIdx]?.user : null;

  const next = () => {
    if (!viewer) return;
    const g = groups[viewer.groupIdx];
    if (viewer.storyIdx + 1 < g.stories.length) {
      setViewer({ ...viewer, storyIdx: viewer.storyIdx + 1 });
    } else if (viewer.groupIdx + 1 < groups.length) {
      setViewer({ groupIdx: viewer.groupIdx + 1, storyIdx: 0 });
    } else {
      setViewer(null);
    }
  };

  const prev = () => {
    if (!viewer) return;
    if (viewer.storyIdx > 0) {
      setViewer({ ...viewer, storyIdx: viewer.storyIdx - 1 });
    } else if (viewer.groupIdx > 0) {
      const prevG = groups[viewer.groupIdx - 1];
      setViewer({ groupIdx: viewer.groupIdx - 1, storyIdx: prevG.stories.length - 1 });
    }
  };

  useEffect(() => {
    if (!viewer || !current || !user) return;
    supabase.from('story_views').upsert({ story_id: current.id, viewer_id: user.id }).then(() => {});
    const t = setTimeout(next, 5000);
    return () => clearTimeout(t);
  }, [viewer?.groupIdx, viewer?.storyIdx]);

  return (
    <>
      <div className="flex gap-3 overflow-x-auto hide-scrollbar py-2 px-1">
        <button onClick={() => setShowCreate(true)} className="flex flex-col items-center gap-1.5 shrink-0 w-16">
          <div className="relative">
            <div className="w-14 h-14 rounded-full p-[2px] bg-white/15">
              <div className="w-full h-full rounded-full bg-ink-950 p-[2px] overflow-hidden">
                <Avatar url={profile?.avatar_url} name={profile?.full_name} size="lg" />
              </div>
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-accent-grad flex items-center justify-center border-2 border-ink-950">
              <Plus className="w-3 h-3 text-white" />
            </span>
          </div>
          <span className="text-[10px] text-neutral-400 truncate w-full text-center">Your story</span>
        </button>

        {groups
          .filter((g) => g.user.id !== user?.id)
          .map((g) => {
            const idx = groups.findIndex((x) => x.user.id === g.user.id);
            return (
              <button key={g.user.id} onClick={() => openGroup(idx)} className="flex flex-col items-center gap-1.5 shrink-0 w-16">
                <div className={`w-14 h-14 rounded-full p-[2px] ${g.seen ? 'ring-story-seen' : 'ring-story'}`}>
                  <div className="w-full h-full rounded-full bg-ink-950 p-[2px] overflow-hidden">
                    <Avatar url={g.user.avatar_url} name={g.user.full_name} size="lg" />
                  </div>
                </div>
                <span className="text-[10px] text-neutral-300 truncate w-full text-center">@{g.user.username}</span>
              </button>
            );
          })}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-strong rounded-2xl overflow-hidden">
            <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <button onClick={() => setShowCreate(false)} className="text-sm text-neutral-400">
                Cancel
              </button>
              <h2 className="font-semibold text-white text-sm">New story</h2>
              <button onClick={createStory} disabled={busy || !file} className="text-sm font-medium text-accent disabled:opacity-50">
                {busy ? '…' : 'Share'}
              </button>
            </header>
            <div className="p-4 space-y-3">
              {!preview ? (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full aspect-[3/4] rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-2 hover:border-accent/40"
                >
                  <Upload className="w-8 h-8 text-accent" />
                  <p className="text-sm text-white">From your device</p>
                  <p className="text-xs text-neutral-500">Photo or video</p>
                </button>
              ) : (
                <div className="aspect-[3/4] rounded-xl overflow-hidden bg-black relative">
                  {file && isVideoFile(file) ? (
                    <video src={preview} controls className="w-full h-full object-contain" />
                  ) : (
                    <img src={preview} alt="" className="w-full h-full object-cover" />
                  )}
                  <button
                    type="button"
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60"
                    onClick={() => {
                      setFile(null);
                      if (preview) URL.revokeObjectURL(preview);
                      setPreview(null);
                    }}
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => pick(e.target.files?.[0])}
              />
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={2}
                placeholder="Caption (optional)"
                className="w-full px-3.5 py-2.5 rounded-lg glass-input text-sm resize-none"
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>
          </div>
        </div>
      )}

      {viewer && current && currentUser && (
        <div className="fixed inset-0 z-[70] bg-black flex flex-col">
          <div className="absolute top-0 inset-x-0 z-10 flex gap-1 p-2">
            {groups[viewer.groupIdx].stories.map((_, i) => (
              <div key={i} className="flex-1 h-0.5 rounded-full bg-white/25 overflow-hidden">
                <div className={`h-full bg-white ${i <= viewer.storyIdx ? 'w-full' : 'w-0'}`} />
              </div>
            ))}
          </div>
          <div className="absolute top-4 left-3 right-3 z-10 flex items-center gap-2 pt-4">
            <Avatar url={currentUser.avatar_url} name={currentUser.full_name} size="sm" />
            <span className="text-sm font-medium text-white flex-1">@{currentUser.username}</span>
            <button onClick={() => setViewer(null)} className="p-2">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          <div className="flex-1 relative flex items-center justify-center" onClick={next}>
            <button
              className="absolute left-0 top-0 bottom-0 w-1/3 z-10"
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              aria-label="Previous"
            />
            {current.media_type === 'video' ? (
              <video src={current.media_url} autoPlay muted className="max-h-full max-w-full object-contain" />
            ) : (
              <img src={current.media_url} alt="" className="max-h-full max-w-full object-contain" />
            )}
            {current.caption && (
              <p className="absolute bottom-16 left-4 right-4 text-white text-sm drop-shadow-lg">{current.caption}</p>
            )}
          </div>
          <div className="absolute bottom-6 inset-x-0 flex justify-between px-4 pointer-events-none">
            <ChevronLeft className="w-6 h-6 text-white/40" />
            <ChevronRight className="w-6 h-6 text-white/40" />
          </div>
        </div>
      )}
    </>
  );
}
