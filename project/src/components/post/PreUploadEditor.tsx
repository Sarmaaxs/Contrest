import { useEffect, useRef, useState } from 'react';
import { X, Play, Pause, Sparkles, Type, Music, Loader2 } from 'lucide-react';
import { ShaderEngine, type ShaderType } from '@/lib/editor/shaderEngine';
import { detectBeatsFromFile } from '@/lib/editor/beatDetector';

type TextOverlay = { id: string; text: string; x: number; y: number; color: string };

const FILTERS: { id: ShaderType; label: string; swatch: string; defaultIntensity: number }[] = [
  { id: 'none', label: 'Original', swatch: 'linear-gradient(135deg,#3f3f46,#18181b)', defaultIntensity: 0.5 },
  { id: 'duotone', label: 'Contrest', swatch: 'linear-gradient(135deg,#f0a8ff,#241049)', defaultIntensity: 0.85 },
  { id: 'edge_glow', label: 'Neon', swatch: 'linear-gradient(135deg,#22e6ff,#ff2fd6)', defaultIntensity: 0.6 },
  { id: 'kaleidoscope', label: 'Kaleido', swatch: 'conic-gradient(from 0deg,#a855f7,#22d3ee,#f472b6,#a855f7)', defaultIntensity: 0.4 },
  { id: 'vhs', label: 'VHS', swatch: 'linear-gradient(135deg,#f43f5e,#0891b2)', defaultIntensity: 0.55 },
  { id: 'rgb_split', label: 'Glitch', swatch: 'linear-gradient(135deg,#ef4444,#3b82f6)', defaultIntensity: 0.5 },
  { id: 'contrast', label: 'Punch', swatch: 'linear-gradient(135deg,#fde047,#7c2d12)', defaultIntensity: 0.5 },
  { id: 'blur', label: 'Soft', swatch: 'linear-gradient(135deg,#e2e8f0,#64748b)', defaultIntensity: 0.4 },
];

export default function PreUploadEditor({
  file,
  onCancel,
  onDone,
}: {
  file: File;
  onCancel: () => void;
  onDone: (editedFile: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const glCanvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const outCanvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ShaderEngine | null>(null);
  const rafRef = useRef<number | null>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  const [srcUrl] = useState(() => URL.createObjectURL(file));
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [filter, setFilter] = useState<ShaderType>('none');
  const [intensity, setIntensity] = useState(0.5);
  const [texts, setTexts] = useState<TextOverlay[]>([]);
  const [activeTextId, setActiveTextId] = useState<string | null>(null);
  const [beats, setBeats] = useState<number[]>([]);
  const [beatSync, setBeatSync] = useState(false);
  const [detectingBeats, setDetectingBeats] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [webglSupported, setWebglSupported] = useState(true);
  const lastBeatFired = useRef(-1);

  // Set up WebGL engine once the output canvas exists. If WebGL2 isn't available
  // (older phones, some in-app browsers), fall back to plain video passthrough —
  // trim/text/beat-sync-pulse/export still work, just without GPU filters.
  useEffect(() => {
    if (!outCanvasRef.current) return;
    try {
      engineRef.current = new ShaderEngine(glCanvasRef.current);
    } catch {
      engineRef.current = null;
      setWebglSupported(false);
    }
  }, []);

  useEffect(() => {
    engineRef.current && (engineRef.current.shaderType = filter);
  }, [filter]);
  useEffect(() => {
    engineRef.current && (engineRef.current.intensity = intensity);
  }, [intensity]);

  const onLoadedMeta = () => {
    const v = videoRef.current!;
    setDuration(v.duration);
    setTrimEnd(v.duration);
  };

  // Compositing loop: WebGL filtered frame -> 2D canvas -> text overlays on top.
  useEffect(() => {
    const tick = () => {
      const v = videoRef.current;
      const engine = engineRef.current;
      const out = outCanvasRef.current;
      if (v && out && v.videoWidth) {
        if (out.width !== v.videoWidth || out.height !== v.videoHeight) {
          out.width = v.videoWidth;
          out.height = v.videoHeight;
        }
        const ctx = out.getContext('2d')!;
        if (engine) {
          engine.drawFrame(v);
          ctx.drawImage(glCanvasRef.current, 0, 0, out.width, out.height);
        } else {
          // No WebGL2 — draw the raw frame straight through. Filters are
          // unavailable in this mode, but trim/text/export still work.
          ctx.drawImage(v, 0, 0, out.width, out.height);
        }
        for (const t of texts) {
          ctx.font = `${Math.round(out.width * 0.06)}px sans-serif`;
          ctx.fillStyle = t.color;
          ctx.textAlign = 'center';
          ctx.shadowColor = 'rgba(0,0,0,0.6)';
          ctx.shadowBlur = 6;
          ctx.fillText(t.text, t.x * out.width, t.y * out.height);
        }

        if (engine && beatSync && beats.length && v.currentTime >= trimStart && v.currentTime <= trimEnd) {
          const hit = beats.find((b) => Math.abs(b - v.currentTime) < 0.05 && b !== lastBeatFired.current);
          if (hit !== undefined) {
            lastBeatFired.current = hit;
            engine.applyBeatGlitch(1);
          }
        }

        if (playing && v.currentTime >= trimEnd) {
          v.pause();
          v.currentTime = trimStart;
          setPlaying(false);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [texts, beats, beatSync, trimStart, trimEnd, playing]);

  const togglePlay = () => {
    const v = videoRef.current!;
    if (playing) {
      v.pause();
    } else {
      if (v.currentTime < trimStart || v.currentTime >= trimEnd) v.currentTime = trimStart;
      v.play();
    }
    setPlaying(!playing);
  };

  const runBeatDetection = async () => {
    setDetectingBeats(true);
    setError(null);
    try {
      const found = await detectBeatsFromFile(file);
      setBeats(found);
      setBeatSync(true);
    } catch {
      setError('Could not analyze audio for beats — this clip may have no audio track.');
    } finally {
      setDetectingBeats(false);
    }
  };

  const addText = () => {
    const id = crypto.randomUUID();
    setTexts((t) => [...t, { id, text: 'Tap to edit', x: 0.5, y: 0.5, color: '#ffffff' }]);
    setActiveTextId(id);
  };

  const onOverlayPointerDown = (e: React.PointerEvent, t: TextOverlay) => {
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    dragRef.current = {
      id: t.id,
      offsetX: (e.clientX - rect.left) / rect.width - t.x,
      offsetY: (e.clientY - rect.top) / rect.height - t.y,
    };
    setActiveTextId(t.id);
  };
  const onOverlayPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - dragRef.current.offsetX;
    const y = (e.clientY - rect.top) / rect.height - dragRef.current.offsetY;
    setTexts((prev) => prev.map((t) => (t.id === dragRef.current!.id ? { ...t, x: clamp01(x), y: clamp01(y) } : t)));
  };
  const onOverlayPointerUp = () => {
    dragRef.current = null;
  };

  const exportVideo = async () => {
    const v = videoRef.current!;
    const out = outCanvasRef.current!;
    setExporting(true);
    setExportProgress(0);
    setError(null);
    try {
      v.pause();
      v.currentTime = trimStart;
      await new Promise((r) => setTimeout(r, 80));

      const canvasStream = out.captureStream(30);
      let audioTrack: MediaStreamTrack | null = null;
      try {
        const anyVideo = v as any;
        if (anyVideo.captureStream) {
          const vs: MediaStream = anyVideo.captureStream();
          audioTrack = vs.getAudioTracks()[0] ?? null;
        }
      } catch {
        // no audio track available — export will be silent, still succeeds
      }
      const tracks = [...canvasStream.getVideoTracks(), ...(audioTrack ? [audioTrack] : [])];
      const combined = new MediaStream(tracks);

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';
      const recorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: 5_000_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);

      const stopped = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });

      recorder.start();
      await v.play();

      const total = trimEnd - trimStart;
      const progressTimer = setInterval(() => {
        setExportProgress(Math.min(99, Math.round(((v.currentTime - trimStart) / total) * 100)));
        if (v.currentTime >= trimEnd) {
          clearInterval(progressTimer);
          recorder.stop();
          v.pause();
        }
      }, 100);

      await stopped;
      setExportProgress(100);

      const blob = new Blob(chunks, { type: 'video/webm' });
      const editedFile = new File([blob], `edited-${Date.now()}.webm`, { type: 'video/webm' });
      onDone(editedFile);
    } catch (e: any) {
      setError(e?.message ?? 'Export failed — try a shorter clip or a different browser.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-ink-950 flex flex-col text-white">
      <header className="relative flex items-center justify-between px-4 py-3.5 bg-gradient-to-b from-black/60 to-transparent">
        <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>
        <p className="text-sm font-semibold tracking-wide">Edit clip</p>
        <button
          onClick={exportVideo}
          disabled={exporting || !!error}
          className="px-5 py-1.5 rounded-full bg-accent-grad text-sm font-semibold hover:brightness-110 active:scale-95 transition disabled:opacity-50 flex items-center gap-1.5 shadow-accent-sm"
        >
          {exporting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> {exportProgress}%
            </>
          ) : (
            'Done'
          )}
        </button>
      </header>

      {error && (
        <div className="mx-4 mt-3 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.4) 100%)' }}
        />
        <video ref={videoRef} src={srcUrl} onLoadedMetadata={onLoadedMeta} playsInline muted={false} className="hidden" />
        <div
          className="relative max-h-full max-w-full rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl shadow-black/60"
          onPointerMove={onOverlayPointerMove}
          onPointerUp={onOverlayPointerUp}
          onPointerLeave={onOverlayPointerUp}
        >
          <canvas ref={outCanvasRef} className="max-h-[58vh] max-w-full object-contain block" />
          {texts.map((t) => (
            <div
              key={t.id}
              onPointerDown={(e) => onOverlayPointerDown(e, t)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-move select-none px-1.5 py-0.5 rounded-md ${
                activeTextId === t.id ? 'ring-1 ring-accent bg-black/20' : ''
              }`}
              style={{ left: `${t.x * 100}%`, top: `${t.y * 100}%` }}
            >
              {activeTextId === t.id ? (
                <input
                  autoFocus
                  value={t.text}
                  onChange={(e) =>
                    setTexts((prev) => prev.map((x) => (x.id === t.id ? { ...x, text: e.target.value } : x)))
                  }
                  onBlur={() => setActiveTextId(null)}
                  className="bg-transparent text-center text-white font-bold text-lg outline-none border-b border-white/40 min-w-[40px]"
                />
              ) : (
                <span className="text-white font-bold text-lg drop-shadow-lg">{t.text}</span>
              )}
            </div>
          ))}
          <button
            onClick={togglePlay}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 p-3.5 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm active:scale-95 transition"
          >
            {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>
        </div>
      </div>

      {/* Trim */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1.5 font-medium">
          <span className="text-accent">{fmt(trimStart)}</span>
          <span className="uppercase tracking-wider text-neutral-500 text-[10px]">Trim</span>
          <span className="text-accent">{fmt(trimEnd)}</span>
        </div>
        <div className="relative h-6 flex items-center">
          <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/10" />
          <div
            className="absolute h-1.5 rounded-full bg-accent-grad"
            style={{
              left: `${duration ? (trimStart / duration) * 100 : 0}%`,
              right: `${duration ? 100 - (trimEnd / duration) * 100 : 0}%`,
            }}
          />
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.05}
            value={trimStart}
            onChange={(e) => setTrimStart(Math.min(Number(e.target.value), trimEnd - 0.2))}
            className="absolute inset-0 w-full appearance-none bg-transparent pointer-events-auto range-thumb-only"
          />
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.05}
            value={trimEnd}
            onChange={(e) => setTrimEnd(Math.max(Number(e.target.value), trimStart + 0.2))}
            className="absolute inset-0 w-full appearance-none bg-transparent pointer-events-auto range-thumb-only"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="pt-3 pb-1">
        {!webglSupported && (
          <p className="mx-4 text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-2">
            GPU filters aren't supported on this browser/device — trim, text, and posting still work fine, just without filters/beat-glitch. Try Chrome or a recent browser for filters.
          </p>
        )}
        <div className="flex items-center gap-3 overflow-x-auto px-4 pb-1 scrollbar-none">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                if (!webglSupported && f.id !== 'none') return;
                setFilter(f.id);
                setIntensity(f.defaultIntensity);
              }}
              disabled={!webglSupported && f.id !== 'none'}
              className="shrink-0 flex flex-col items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span
                className={`w-12 h-12 rounded-full ring-2 transition-all ${
                  filter === f.id ? 'ring-accent scale-105' : 'ring-white/10'
                }`}
                style={{ background: f.swatch }}
              />
              <span className={`text-[10px] font-medium ${filter === f.id ? 'text-white' : 'text-neutral-500'}`}>
                {f.label}
              </span>
            </button>
          ))}
        </div>
        {filter !== 'none' && webglSupported && (
          <div className="px-4 mt-1">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={intensity}
              onChange={(e) => setIntensity(Number(e.target.value))}
              className="w-full"
            />
          </div>
        )}
      </div>

      {/* Tools */}
      <div className="px-4 py-3 flex items-center gap-3 border-t border-white/5">
        <ToolButton icon={<Type className="w-4 h-4" />} label="Text" onClick={addText} />
        <ToolButton
          icon={detectingBeats ? <Loader2 className="w-4 h-4 animate-spin" /> : <Music className="w-4 h-4" />}
          label={beats.length ? `${beats.length} beats` : 'Sync beat'}
          active={beatSync}
          onClick={() => (beats.length ? setBeatSync((v) => !v) : runBeatDetection())}
        />
        <span className="flex flex-col items-center gap-1 px-3 py-1.5 text-[11px] font-medium text-neutral-600">
          <Sparkles className="w-4 h-4" />
          Filters ↑
        </span>
      </div>
    </div>
  );
}

function ToolButton({
  icon,
  label,
  onClick,
  active,
  muted,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  muted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-medium ${
        active ? 'bg-accent-grad text-white' : muted ? 'text-neutral-600' : 'bg-white/[0.06] text-neutral-300'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
function clamp01(n: number) {
  return Math.max(0.05, Math.min(0.95, n));
}
