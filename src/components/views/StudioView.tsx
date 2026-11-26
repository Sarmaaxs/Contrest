import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Sparkles, BarChart3, Film, FolderOpen, Plus, Save, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

type Project = { id: string; name: string; updated_at: string; local?: boolean };

const LOCAL_KEY = 'contrest_studio_projects';
const localProjectKey = (id: string) => `contrest_studio_project_${id}`;

function readLocal(): Project[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; }
}
function writeLocal(projects: Project[]) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(projects.slice(0, 20))); } catch { /* ignore */ }
}

export default function StudioView({ onBack, onOpenProject }: { onBack: () => void; onOpenProject?: (id: string) => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [projects, setProjects] = useState<Project[]>(readLocal);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ posts: 0, likes: 0, comments: 0, followers: 0 });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [projectsRes, postsRes, followersRes] = await Promise.all([
        supabase.from('editor_projects').select('id,name,updated_at').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(20),
        supabase.from('posts').select('id,likes(count),comments(count)', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', user.id),
      ]);
      if (cancelled) return;
      if (projectsRes.error && projectsRes.error.code !== '42P01') toast('Studio projects could not be loaded yet.');
      const remote = (projectsRes.data ?? []) as Project[];
      const postRows = (postsRes.data ?? []) as any[];
      const likes = postRows.reduce((sum, p) => sum + Number(p.likes?.[0]?.count ?? 0), 0);
      const comments = postRows.reduce((sum, p) => sum + Number(p.comments?.[0]?.count ?? 0), 0);
      setProjects([...remote, ...readLocal().filter((p) => !remote.some((r) => r.id === p.id))]);
      setStats({ posts: postsRes.count ?? postRows.length, likes, comments, followers: followersRes.count ?? 0 });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, toast]);

  const createProject = async () => {
    if (!user) return;
    const name = `Untitled project ${projects.length + 1}`;
    const { data, error } = await supabase.from('editor_projects').insert({ user_id: user.id, name, project: { version: 1, duration: 0, tracks: [] } }).select('id,name,updated_at').single();
    if (!error && data) {
      setProjects((p) => [data as Project, ...p]);
      toast('Studio project created');
      return;
    }
    const local = { id: `local-${crypto.randomUUID()}`, name, updated_at: new Date().toISOString(), local: true };
    const next = [local, ...readLocal()]; writeLocal(next);
    try { localStorage.setItem(localProjectKey(local.id), JSON.stringify({ id: local.id, name, fps: 30, width: 1080, height: 1920, tracks: [] })); } catch {}
    setProjects(next); toast('Offline project created');
  };

  const removeLocal = (id: string) => {
    const next = readLocal().filter((p) => p.id !== id); writeLocal(next);
    try { localStorage.removeItem(localProjectKey(id)); } catch {} setProjects((p) => p.filter((x) => x.id !== id));
  };

  const cards = useMemo(() => [
    ['Posts', stats.posts], ['Likes', stats.likes], ['Comments', stats.comments], ['Followers', stats.followers],
  ], [stats]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 md:py-10">
      <div className="flex items-center justify-between gap-3 mb-8">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-white/10" aria-label="Back"><ArrowLeft className="w-5 h-5" /></button>
          <div><p className="text-xs uppercase tracking-widest text-accent font-semibold">Contrest Studio</p><h1 className="text-2xl font-bold">Create, save, publish.</h1></div>
        </div>
        <button onClick={createProject} className="inline-flex items-center gap-2 rounded-xl bg-accent-grad px-4 py-2.5 text-sm font-semibold"><Plus className="w-4 h-4" /> New project</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {cards.map(([label, value]) => <div key={String(label)} className="glass rounded-2xl p-4"><p className="text-xs text-neutral-500">{label}</p><p className="text-xl font-semibold mt-1">{value}</p></div>)}
      </div>

      <div className="grid md:grid-cols-[1.5fr_1fr] gap-5">
        <section className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4"><div><h2 className="font-semibold">Projects</h2><p className="text-xs text-neutral-500 mt-1">Your saved editing work.</p></div><FolderOpen className="w-5 h-5 text-neutral-500" /></div>
          {loading ? <div className="py-10 text-center text-sm text-neutral-500">Loading projects…</div> : projects.length === 0 ? <div className="py-10 text-center"><Film className="w-8 h-8 mx-auto text-neutral-600 mb-3" /><p className="text-sm text-neutral-400">No projects yet.</p><button onClick={createProject} className="mt-4 text-sm text-accent font-semibold">Create your first project</button></div> : <div className="space-y-2">{projects.map((p) => <div key={p.id} className="flex items-center gap-3 rounded-xl bg-white/[.04] p-3"><div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center"><Film className="w-5 h-5 text-accent" /></div><button type="button" onClick={() => onOpenProject?.(p.id)} className="min-w-0 flex-1 text-left"><p className="text-sm font-medium truncate">{p.name}</p><p className="text-xs text-neutral-500">{p.local ? 'Saved on this device' : new Date(p.updated_at).toLocaleString()}</p></button>{p.local && <button onClick={() => removeLocal(p.id)} className="p-2 text-neutral-500 hover:text-red-300" aria-label="Delete local project"><Trash2 className="w-4 h-4" /></button>}</div>)}</div>}
        </section>

        <section className="glass rounded-2xl p-5">
          <h2 className="font-semibold mb-4">Studio tools</h2>
          <div className="space-y-3 text-sm">{[
            ['Timeline', 'Multi-track media with clip timing, split and delete.'],
            ['Creative tools', 'Text tracks, canvas ratios and lightweight browser effects.'],
            ['Recovery', 'Cloud projects plus local browser recovery.'],
            ['Export', 'Preview and WebM export directly in a supported browser.'],
          ].map(([title, text]) => <div key={title} className="flex gap-3"><div className="mt-0.5"><Sparkles className="w-4 h-4 text-accent" /></div><div><p className="font-medium">{title}</p><p className="text-xs text-neutral-500 mt-0.5">{text}</p></div></div>)}</div>
          <div className="mt-6 pt-4 border-t border-white/10 flex gap-2 text-xs text-neutral-500"><Save className="w-4 h-4" /> Projects are saved in your account; offline projects stay on this device.</div>
        </section>
      </div>
    </div>
  );
}
