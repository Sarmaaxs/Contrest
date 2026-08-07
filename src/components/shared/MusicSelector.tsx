import { useEffect, useRef, useState } from 'react';
import { Music, Search, X, Play, Pause, Check, Loader2 } from 'lucide-react';
import {
  searchAudiusTracks,
  getTrendingAudiusTracks,
  formatDuration,
  resolveStreamUrl,
  type AudiusTrack,
} from '@/lib/audius';

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
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  const togglePreview = async (track: AudiusTrack) => {
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    try {
      audioRef.current?.pause();
      const src = await resolveStreamUrl(track.streamUrl);
      const audio = new Audio(src);
      audioRef.current = audio;
      setPlayingId(track.id);
      audio.onended = () => setPlayingId(null);
      audio.onerror = () => setPlayingId(null);
      await audio.play();
    } catch {
      setPlayingId(null);
    }
  };

  const pick = (track: AudiusTrack) => {
    audioRef.current?.pause();
    setPlayingId(null);
    onSelect(track);
    setOpen(false);
  };

  const clear = () => {
    audioRef.current?.pause();
    setPlayingId(null);
    onSelect(null);
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
      ) : (
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
                  audioRef.current?.pause();
                  setPlayingId(null);
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
