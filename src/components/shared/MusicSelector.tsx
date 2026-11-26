import { useEffect, useRef, useState } from 'react';
import { Music, Search, X, Play, Pause, Check, Loader2, Upload, Scissors } from 'lucide-react';
import {
  searchAudiusTracks,
  getTrendingAudiusTracks,
  formatDuration,
  resolveStreamUrl,
  type AudiusTrack,
} from '@/lib/audius';

const CLIP_SECONDS = 15; // matches the short-form clip default
const MAX_CUSTOM_AUDIO_BYTES = 8 * 1024 * 1024;

type Props = {
  selected: AudiusTrack | null;
  onSelect: (track: AudiusTrack | null) => void;
  compact?: boolean;
};

export default function MusicSelector({ selected, onSelect, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState<AudiusTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [customError, setCustomError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Bumped on every play/pause request so a slow-resolving preview from an
  // earlier click can't clobber a later one — this was the root cause of
  // "pause doesn't work": clicking play, then quickly clicking pause before
  // the stream URL finished resolving, was treated as a second "play"
  // because `playingId` hadn't updated yet, leaving two audio elements
  // racing each other with only one ever getting paused.
  const requestIdRef = useRef(0);

  const load = async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const list = q.trim() ? await searchAudiusTracks(q) : await getTrendingAudiusTracks();
      setTracks(list);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load tracks');
      setTracks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => load(query), 280);
    return () => clearTimeout(t);
  }, [open, query]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  // Also stop playback the instant the picker closes (X button, backdrop
  // tap, or picking a track) — belt-and-braces alongside stopPreview() so a
  // preview can never keep playing once the sheet is gone.
  useEffect(() => {
    if (!open) audioRef.current?.pause();
  }, [open]);

  const stopPreview = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingId(null);
    setLoadingId(null);
    requestIdRef.current++;
  };

  const togglePreview = async (track: AudiusTrack) => {
    // Already playing (or loading) this exact track — pause/cancel it, full stop.
    if (playingId === track.id || loadingId === track.id) {
      stopPreview();
      return;
    }
    const myRequest = ++requestIdRef.current;
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingId(null);
    setLoadingId(track.id);
    try {
      const src = await resolveStreamUrl(track.streamUrl);
      // A newer click (play a different track, or pause) happened while we
      // were waiting — drop this stale response instead of racing it.
      if (myRequest !== requestIdRef.current) return;
      const audio = new Audio(src);
      audio.onended = () => setPlayingId((cur) => (cur === track.id ? null : cur));
      audio.onerror = () => setPlayingId((cur) => (cur === track.id ? null : cur));
      audioRef.current = audio;
      await audio.play();
      if (myRequest !== requestIdRef.current) {
        audio.pause();
        return;
      }
      setLoadingId(null);
      setPlayingId(track.id);
    } catch {
      if (myRequest === requestIdRef.current) {
        setLoadingId(null);
        setPlayingId(null);
      }
    }
  };

  const pick = (track: AudiusTrack) => {
    stopPreview();
    onSelect({ ...track, startSeconds: 0, source: 'audius' });
    setOpen(false);
  };

  const clear = () => {
    stopPreview();
    onSelect(null);
  };

  const pickCustomFile = (file: File | null) => {
    setCustomError(null);
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      setCustomError('Choose an audio file (MP3, M4A, WAV, OGG, AAC).');
      return;
    }
    if (file.size > MAX_CUSTOM_AUDIO_BYTES) {
      setCustomError('Audio clip must be under 8MB.');
      return;
    }
    const url = URL.createObjectURL(file);
    const probe = new Audio(url);
    probe.onloadedmetadata = () => {
      onSelect({
        id: `custom-${Date.now()}`,
        title: file.name.replace(/\.[^.]+$/, ''),
        user: { name: 'Your upload' },
        duration: Math.round(probe.duration || 0),
        streamUrl: url,
        startSeconds: 0,
        source: 'custom',
        file,
      });
      setOpen(false);
    };
    probe.onerror = () => setCustomError("Couldn't read that audio file.");
  };

  const setTrimStart = (startSeconds: number) => {
    if (!selected) return;
    onSelect({ ...selected, startSeconds });
  };

  /** Play a short preview starting at the chosen trim point, so the person
   * can hear exactly what will be attached before posting. */
  const previewTrim = async (track: AudiusTrack) => {
    try {
      stopPreview();
      const src = track.source === 'custom' ? track.streamUrl : await resolveStreamUrl(track.streamUrl);
      const audio = new Audio(src);
      audio.currentTime = track.startSeconds ?? 0;
      audioRef.current = audio;
      await audio.play();
      setTimeout(() => {
        if (audioRef.current === audio) {
          audio.pause();
          audioRef.current = null;
        }
      }, CLIP_SECONDS * 1000);
    } catch {
      /* preview is best-effort */
    }
  };

  return (
    <div className={compact ? '' : 'w-full'}>
      {selected ? (
        <div className="flex items-center gap-3 rounded-xl glass px-3 py-2.5">
          {selected.artwork?.['150x150'] ? (
            <img
              src={selected.artwork['150x150']}
              alt=""
              className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
              <Music className="w-4 h-4 text-accent" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{selected.title}</p>
            <p className="text-xs text-neutral-400 truncate">
              {selected.user.name}
              {selected.duration ? ` · ${formatDuration(selected.duration)}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-xs text-accent font-medium px-2 py-1 rounded-lg hover:bg-white/5"
          >
            Change
          </button>
          <button
            type="button"
            onClick={clear}
            className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-400"
            aria-label="Remove music"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : null}

      {/* Trim — pick which 15s of the track actually plays, instead of
          always attaching the whole song from 0:00. Same idea as
          short-form clip trimmer. */}
      {selected && selected.duration > CLIP_SECONDS && (
        <div className="mt-2 rounded-xl glass px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1.5 text-xs text-neutral-400">
            <Scissors className="w-3.5 h-3.5" />
            Trim — using {formatDuration(Math.min(CLIP_SECONDS, selected.duration))} starting at{' '}
            {formatDuration(selected.startSeconds ?? 0)}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => previewTrim(selected)}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 shrink-0"
              aria-label="Preview trimmed clip"
            >
              <Play className="w-3.5 h-3.5 text-white" />
            </button>
            <input
              type="range"
              min={0}
              max={Math.max(0, Math.floor(selected.duration - CLIP_SECONDS))}
              step={1}
              value={Math.min(selected.startSeconds ?? 0, Math.max(0, selected.duration - CLIP_SECONDS))}
              onChange={(e) => setTrimStart(Number(e.target.value))}
              onMouseUp={() => previewTrim(selected)}
              onTouchEnd={() => previewTrim(selected)}
              className="w-full accent-accent"
            />
          </div>
        </div>
      )}

      {!selected && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2 rounded-xl glass px-3 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-white/5 transition-colors"
        >
          <Music className="w-4 h-4 text-accent" />
          <span>Add sound</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
          <div className="w-full max-w-md max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl glass-strong overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
              <Music className="w-5 h-5 text-accent" />
              <h3 className="font-semibold text-white flex-1">Sounds</h3>
              <button
                type="button"
                onClick={() => {
                  stopPreview();
                  setOpen(false);
                }}
                className="p-1.5 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5 text-neutral-300" />
              </button>
            </div>

            <div className="px-4 py-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search songs…"
                  className="w-full glass-input rounded-xl pl-9 pr-3 py-2.5 text-sm"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-neutral-500 mt-2">
                Preview a track, then tap to attach it to your post.
              </p>

              {/* Can't find a specific mainstream song? The catalog above is
                  independent/creative-commons only — we can't legally ship
                  major-label tracks without a licensing deal (that's the
                  licensing arrangements used by major platforms
                  labels). Uploading your own clip sidesteps that: it's the
                  an original-sound workflow. */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 px-3 py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-white/5"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload your own sound instead
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => pickCustomFile(e.target.files?.[0] ?? null)}
              />
              {customError && <p className="text-[11px] text-red-400 mt-1.5">{customError}</p>}
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-4 min-h-0">
              {loading && (
                <div className="flex items-center justify-center py-10 text-neutral-400 gap-2 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                </div>
              )}
              {error && !loading && (
                <p className="text-sm text-red-400 px-3 py-6 text-center">{error}</p>
              )}
              {!loading && !error && tracks.length === 0 && (
                <p className="text-sm text-neutral-500 px-3 py-6 text-center">No tracks found</p>
              )}
              <ul className="space-y-1">
                {tracks.map((t) => {
                  const isSel = selected?.id === t.id;
                  const isPlaying = playingId === t.id;
                  return (
                    <li
                      key={t.id}
                      className={`flex items-center gap-2 rounded-xl px-2 py-2 ${
                        isSel ? 'bg-accent/15 ring-1 ring-accent/40' : 'hover:bg-white/5'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => togglePreview(t)}
                        className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 relative overflow-hidden"
                      >
                        {t.artwork?.['150x150'] ? (
                          <img src={t.artwork['150x150']} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                        ) : null}
                        {isPlaying ? (
                          <Pause className="w-3.5 h-3.5 relative z-10 text-white" />
                        ) : loadingId === t.id ? (
                          <Loader2 className="w-3.5 h-3.5 relative z-10 text-white animate-spin" />
                        ) : (
                          <Play className="w-3.5 h-3.5 relative z-10 text-white" />
                        )}
                      </button>
                      <button type="button" onClick={() => pick(t)} className="flex-1 min-w-0 text-left">
                        <p className="text-sm text-white truncate font-medium">{t.title}</p>
                        <p className="text-xs text-neutral-400 truncate">
                          {t.user.name}
                          {t.duration ? ` · ${formatDuration(t.duration)}` : ''}
                          {t.genre ? ` · ${t.genre}` : ''}
                        </p>
                      </button>
                      {isSel && <Check className="w-4 h-4 text-accent flex-shrink-0" />}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
