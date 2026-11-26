import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Download, Film, Pause, Play, Plus, Redo2, Save, Scissors, Trash2, Type, Undo2, Upload, Volume2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import type { Clip, Project, Track } from '@/lib/editor/types';

type Props = { projectId: string; onBack: () => void };
const defaultProject = (id: string): Project => ({ id, name: 'Untitled project', fps: 30, width: 1080, height: 1920, tracks: [] });
const uid = () => crypto.randomUUID();

function makeTrack(type: Track['type']): Track { return { id: uid(), type, clips: [], locked: false, muted: false }; }

export default function StudioEditorView({ projectId, onBack }: Props) {
  const toast = useToast();
  const [project, setProject] = useState<Project>(() => defaultProject(projectId));
  const [history, setHistory] = useState<Project[]>([]);
  const [future, setFuture] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [textOverlay, setTextOverlay] = useState('');
  const localRecoveryKey = `contrest_studio_recovery_${projectId}`;
  const previewRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileUrls = useRef<string[]>([]);

  const duration = useMemo(() => project.tracks.flatMap(t => t.clips).reduce((m, c) => Math.max(m, c.startTime + c.duration), 0), [project]);
  const selected = useMemo(() => project.tracks.flatMap(t => t.clips).find(c => c.id === selectedClip) ?? null, [project, selectedClip]);

  useEffect(() => () => { fileUrls.current.forEach(URL.revokeObjectURL); }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let recovered: Project | null = null;
      try { const raw = localStorage.getItem(localRecoveryKey); if (raw) recovered = JSON.parse(raw) as Project; } catch {}
      if (projectId.startsWith('local-') && recovered) { setProject(recovered); setLoading(false); return; }
      const { data, error } = await supabase.from('editor_projects').select('name,project').eq('id', projectId).maybeSingle();
      if (cancelled) return;
      if (data?.project) setProject({ ...defaultProject(projectId), ...(data.project as Project), name: data.name || (data.project as Project).name || 'Untitled project' });
      else if (recovered) setProject(recovered);
      else if (error) toast('Project could not be loaded; using a local recovery copy.');
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [projectId, toast, localRecoveryKey]);

  useEffect(() => {
    if (loading) return;
    const timer = window.setTimeout(() => { try { localStorage.setItem(localRecoveryKey, JSON.stringify(project)); } catch {} }, 500);
    return () => window.clearTimeout(timer);
  }, [project, loading, localRecoveryKey]);

  const commit = useCallback((next: Project) => {
    setHistory(h => [...h.slice(-29), project]);
    setFuture([]);
    setProject(next);
  }, [project]);

  const undo = () => { const prev = history[history.length - 1]; if (!prev) return; setFuture(f => [project, ...f]); setProject(prev); setHistory(h => h.slice(0, -1)); };
  const redo = () => { const next = future[0]; if (!next) return; setHistory(h => [...h, project]); setProject(next); setFuture(f => f.slice(1)); };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('editor_projects').update({ name: project.name, project }).eq('id', projectId);
    setSaving(false);
    if (error) toast('Cloud save failed. Your current project remains in this tab.'); else toast('Project saved');
  };

  const addMedia = (files: FileList | null) => {
    if (!files?.length) return;
    const media = Array.from(files);
    const trackType: Track['type'] = media.some(f => f.type.startsWith('video')) ? 'video' : 'audio';
    let track = project.tracks.find(t => t.type === trackType && !t.locked);
    const tracks = project.tracks.map(t => ({ ...t, clips: [...t.clips] }));
    if (!track) { track = makeTrack(trackType); tracks.push(track); }
    const target = tracks.find(t => t.id === track!.id)!;
    let cursor = target.clips.reduce((m, c) => Math.max(m, c.startTime + c.duration), 0);
    for (const file of media) {
      const src = URL.createObjectURL(file); fileUrls.current.push(src);
      const clip: Clip = { id: uid(), src, startTime: cursor, duration: file.type.startsWith('image') ? 4 : 8, mediaOffset: 0, keyframes: [], shaders: [] };
      target.clips.push(clip); cursor += clip.duration;
    }
    commit({ ...project, tracks });
    setSelectedTrack(target.id); setSelectedClip(target.clips[target.clips.length - 1]?.id ?? null); setPreviewUrl(target.clips[target.clips.length - 1]?.src ?? null);
  };

  const addText = () => {
    const track = project.tracks.find(t => t.type === 'text' && !t.locked) ?? makeTrack('text');
    const tracks = project.tracks.some(t => t.id === track.id) ? project.tracks.map(t => ({ ...t, clips: [...t.clips] })) : [...project.tracks, track];
    const target = tracks.find(t => t.id === track.id)!;
    const text = textOverlay.trim() || 'Your text';
    target.clips.push({ id: uid(), src: `text:${text}`, startTime: playhead, duration: 3, mediaOffset: 0, keyframes: [], shaders: [] });
    commit({ ...project, tracks }); setTextOverlay(''); setSelectedTrack(target.id); setSelectedClip(target.clips[target.clips.length - 1]!.id);
  };

  const updateSelected = (patch: Partial<Clip>) => {
    if (!selectedClip) return;
    const tracks = project.tracks.map(t => ({ ...t, clips: t.clips.map(c => c.id === selectedClip ? { ...c, ...patch } : c) }));
    commit({ ...project, tracks });
  };
  const split = () => {
    if (!selected || playhead <= selected.startTime || playhead >= selected.startTime + selected.duration) return;
    const first: Clip = { ...selected, id: uid(), duration: playhead - selected.startTime };
    const second: Clip = { ...selected, id: uid(), startTime: playhead, mediaOffset: selected.mediaOffset + first.duration, duration: selected.duration - first.duration };
    const tracks = project.tracks.map(t => ({ ...t, clips: t.clips.flatMap(c => c.id === selected.id ? [first, second] : [c]) }));
    commit({ ...project, tracks }); setSelectedClip(second.id);
  };
  const removeSelected = () => {
    if (!selectedClip) return;
    commit({ ...project, tracks: project.tracks.map(t => ({ ...t, clips: t.clips.filter(c => c.id !== selectedClip) })) }); setSelectedClip(null); setPreviewUrl(null);
  };

  useEffect(() => {
    if (!playing || duration <= 0) return;
    const start = performance.now() - playhead * 1000;
    let frame = 0;
    const tick = (now: number) => { const next = (now - start) / 1000; if (next >= duration) { setPlayhead(duration); setPlaying(false); return; } setPlayhead(next); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [playing]);

  useEffect(() => {
    const clip = project.tracks.flatMap(t => t.clips).find(c => playhead >= c.startTime && playhead < c.startTime + c.duration && !c.src.startsWith('text:'));
    if (clip && clip.src !== previewUrl) setPreviewUrl(clip.src);
  }, [playhead, project.tracks, previewUrl]);

  const exportPreview = async () => {
    if (!previewUrl || !canvasRef.current) { toast('Add a video clip and select a moment to export.'); return; }
    const video = previewRef.current;
    if (!video) return;
    const canvas = canvasRef.current; canvas.width = 720; canvas.height = 1280;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    try {
      video.currentTime = Math.max(0, playhead - (selected?.startTime ?? 0));
      await video.play();
      const stream = canvas.captureStream(30); const mime = MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : ''; const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = []; recorder.ondataavailable = e => e.data.size && chunks.push(e.data);
      const stopped = new Promise<void>(resolve => { recorder.onstop = () => resolve(); });
      recorder.start();
      const end = performance.now() + Math.min(8000, Math.max(1000, (selected?.duration ?? 4) * 1000));
      const draw = () => { ctx.drawImage(video, 0, 0, canvas.width, canvas.height); if (textOverlay) { ctx.font = 'bold 56px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = 'white'; ctx.fillText(textOverlay, canvas.width / 2, canvas.height - 140); } if (performance.now() < end) requestAnimationFrame(draw); else recorder.stop(); };
      draw(); await stopped; video.pause();
      const blob = new Blob(chunks, { type: 'video/webm' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${project.name.replace(/[^a-z0-9-_]+/gi, '-').slice(0, 60) || 'contrest-edit'}.webm`; a.click(); URL.revokeObjectURL(url); toast('Preview exported');
    } catch { toast('Export could not start. Try a local video file.'); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-neutral-400">Loading Studio…</div>;
  return <div className="min-h-screen bg-black/20 text-white">
    <header className="sticky top-0 z-20 glass border-b border-white/10 px-3 md:px-5 py-3 flex items-center gap-3">
      <button onClick={onBack} className="p-2 rounded-xl hover:bg-white/10" aria-label="Back"><ArrowLeft className="w-5 h-5" /></button>
      <div className="min-w-0 flex-1"><input value={project.name} onChange={e => setProject(p => ({ ...p, name: e.target.value.slice(0,120) }))} className="bg-transparent font-semibold outline-none w-full" aria-label="Project name" /><p className="text-[11px] text-neutral-500">{Math.ceil(duration)}s · {project.width}×{project.height} · {project.fps} FPS</p></div>
      <button onClick={undo} disabled={!history.length} className="p-2 rounded-xl hover:bg-white/10 disabled:opacity-30" aria-label="Undo"><Undo2 className="w-4 h-4" /></button>
      <button onClick={redo} disabled={!future.length} className="p-2 rounded-xl hover:bg-white/10 disabled:opacity-30" aria-label="Redo"><Redo2 className="w-4 h-4" /></button>
      <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-accent-grad px-3 py-2 text-sm font-semibold"><Save className="w-4 h-4" />{saving ? 'Saving' : 'Save'}</button>
    </header>
    <main className="max-w-6xl mx-auto p-3 md:p-5 space-y-4">
      <div className="grid lg:grid-cols-[1fr_360px] gap-4">
        <section className="glass rounded-2xl p-3 min-h-[520px] flex flex-col">
          <div className="flex items-center justify-center gap-2 mb-3">
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer text-sm"><Upload className="w-4 h-4" /> Add media<input type="file" accept="video/*,image/*,audio/*" multiple hidden onChange={e => addMedia(e.target.files)} /></label>
            <button onClick={addText} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm"><Type className="w-4 h-4" /> Text</button>
            <button onClick={() => setPlaying(p => !p)} className="w-10 h-10 rounded-full bg-accent-grad flex items-center justify-center" aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}</button>
          </div>
          <div className="flex-1 flex items-center justify-center rounded-xl bg-black overflow-hidden relative">
            {previewUrl && !previewUrl.startsWith('text:') ? <video ref={previewRef} src={previewUrl} muted playsInline className="max-h-[58vh] max-w-full object-contain" onLoadedMetadata={() => { if (previewRef.current) previewRef.current.currentTime = Math.max(0, playhead - (selected?.startTime ?? 0)); }} /> : <div className="text-center text-neutral-500"><Film className="w-10 h-10 mx-auto mb-2" /><p className="text-sm">Drop a clip into your project</p></div>}
            {selected?.src.startsWith('text:') && <div className="absolute inset-x-0 bottom-12 text-center text-3xl font-bold text-white drop-shadow-lg">{selected.src.slice(5)}</div>}
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <div className="mt-3 flex gap-2"><input value={textOverlay} onChange={e => setTextOverlay(e.target.value)} placeholder="Optional export text overlay" className="flex-1 glass-input rounded-xl px-3 py-2 text-sm" /><button onClick={exportPreview} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 text-sm"><Download className="w-4 h-4" /> Export</button></div>
        </section>
        <aside className="glass rounded-2xl p-4 space-y-4">
          <div><h2 className="font-semibold">Inspector</h2><p className="text-xs text-neutral-500 mt-1">Edit the selected clip.</p></div>
          {selected ? <>
            <label className="block text-xs text-neutral-400">Start (seconds)<input type="number" min="0" step="0.1" value={selected.startTime} onChange={e => updateSelected({ startTime: Math.max(0, Number(e.target.value)) })} className="mt-1 w-full glass-input rounded-lg px-3 py-2 text-sm" /></label>
            <label className="block text-xs text-neutral-400">Duration<input type="number" min="0.2" step="0.1" value={selected.duration} onChange={e => updateSelected({ duration: Math.max(0.2, Number(e.target.value)) })} className="mt-1 w-full glass-input rounded-lg px-3 py-2 text-sm" /></label>
            <div className="grid grid-cols-2 gap-2"><button onClick={() => updateSelected({ startTime: Math.max(0, selected.startTime - 0.5) })} className="rounded-lg bg-white/10 py-2 text-sm">−0.5s</button><button onClick={() => updateSelected({ startTime: selected.startTime + 0.5 })} className="rounded-lg bg-white/10 py-2 text-sm">+0.5s</button></div><div className="grid grid-cols-2 gap-2"><button onClick={split} className="inline-flex justify-center items-center gap-2 rounded-lg bg-white/10 py-2 text-sm"><Scissors className="w-4 h-4" /> Split</button><button onClick={removeSelected} className="inline-flex justify-center items-center gap-2 rounded-lg bg-red-500/10 text-red-300 py-2 text-sm"><Trash2 className="w-4 h-4" /> Delete</button></div>
          </> : <p className="text-sm text-neutral-500">Select a clip in the timeline.</p>}
          <div className="border-t border-white/10 pt-4"><h3 className="text-sm font-medium mb-2">Canvas</h3><div className="grid grid-cols-3 gap-2">{[[1080,1920,'9:16'],[1920,1080,'16:9'],[1080,1080,'1:1']].map(([w,h,label]) => <button key={String(label)} onClick={() => commit({ ...project, width: Number(w), height: Number(h) })} className={`rounded-lg py-2 text-xs ${project.width === Number(w) && project.height === Number(h) ? 'bg-accent/20 text-accent' : 'bg-white/5 text-neutral-400'}`}>{label}</button>)}</div></div>
        </aside>
      </div>
      <section className="glass rounded-2xl p-3">
        <div className="flex items-center justify-between mb-3"><div><h2 className="font-semibold">Timeline</h2><p className="text-xs text-neutral-500">Drag-style editing foundation with precise clip timing.</p></div><span className="text-xs text-neutral-500">Playhead {playhead.toFixed(1)}s</span></div>
        <div className="relative h-2 bg-white/10 rounded-full cursor-pointer mb-4" onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setPlayhead(Math.max(0, Math.min(duration, ((e.clientX-r.left)/r.width)*duration))); }}><div className="absolute top-0 bottom-0 left-0 bg-accent rounded-full" style={{ width: duration ? `${playhead/duration*100}%` : '0%' }} /></div>
        <div className="space-y-2">{project.tracks.map(track => <div key={track.id} onClick={() => setSelectedTrack(track.id)} className={`rounded-xl p-2 ${selectedTrack === track.id ? 'bg-white/[.07]' : 'bg-white/[.03]'}`}><div className="flex items-center gap-2 mb-2 text-xs text-neutral-400">{track.type === 'audio' ? <Volume2 className="w-3.5 h-3.5" /> : track.type === 'text' ? <Type className="w-3.5 h-3.5" /> : <Film className="w-3.5 h-3.5" />}{track.type} · {track.clips.length} clip{track.clips.length === 1 ? '' : 's'}</div><div className="relative h-12 bg-black/30 rounded-lg overflow-hidden">{track.clips.map(c => <button key={c.id} onClick={e => { e.stopPropagation(); setSelectedClip(c.id); setSelectedTrack(track.id); setPreviewUrl(c.src.startsWith('text:') ? null : c.src); setPlayhead(c.startTime); }} className={`absolute top-1 bottom-1 rounded-md px-2 text-left text-[10px] truncate border ${selectedClip === c.id ? 'border-accent bg-accent/20' : 'border-white/10 bg-white/10'}`} style={{ left: `${duration ? c.startTime/duration*100 : 0}%`, width: `${duration ? Math.max(2, c.duration/duration*100) : 8}%` }}>{c.src.startsWith('text:') ? c.src.slice(5) : 'Media clip'}</button>)}</div></div>)}</div>
        {project.tracks.length === 0 && <button onClick={() => { const t=makeTrack('video'); commit({...project,tracks:[t]}); }} className="w-full py-8 text-sm text-neutral-500 hover:text-white"><Plus className="w-5 h-5 mx-auto mb-2" />Add your first track</button>}
      </section>
    </main>
  </div>;
}
