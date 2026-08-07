import { useState } from 'react';
import { Flag, Ban, X, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { REPORT_REASONS } from '@/lib/moderation';

type Props = {
  postId?: string;
  targetUserId?: string;
  targetUsername?: string;
  onClose: () => void;
  onBlocked?: () => void;
};

export default function ReportBlockMenu({ postId, targetUserId, targetUsername, onClose, onBlocked }: Props) {
  const { user } = useAuth();
  const [mode, setMode] = useState<'menu' | 'report' | 'done'>('menu');
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitReport = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from('reports').insert({
      reporter_id: user.id,
      target_user_id: targetUserId ?? null,
      post_id: postId ?? null,
      reason,
      details: details.trim() || null,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setMode('done');
  };

  const blockUser = async () => {
    if (!user || !targetUserId) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from('blocks').insert({
      blocker_id: user.id,
      blocked_id: targetUserId,
    });
    // Best-effort unfollow both ways
    await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', targetUserId);
    await supabase.from('follows').delete().eq('follower_id', targetUserId).eq('following_id', user.id);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    onBlocked?.();
    setMode('done');
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-md glass-strong rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="font-semibold text-white text-sm">
            {mode === 'report' ? 'Report' : mode === 'done' ? 'Thanks' : 'Options'}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full">
            <X className="w-4 h-4 text-neutral-400" />
          </button>
        </div>

        {mode === 'menu' && (
          <div className="p-2">
            <button
              onClick={() => setMode('report')}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 text-left"
            >
              <Flag className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-sm font-medium text-white">Report {postId ? 'post' : 'user'}</p>
                <p className="text-xs text-neutral-500">Flag spam, hate, or harmful content</p>
              </div>
            </button>
            {targetUserId && targetUserId !== user?.id && (
              <button
                onClick={blockUser}
                disabled={busy}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 text-left"
              >
                <Ban className="w-5 h-5 text-red-400" />
                <div>
                  <p className="text-sm font-medium text-red-300">Block @{targetUsername ?? 'user'}</p>
                  <p className="text-xs text-neutral-500">They won&apos;t be able to message or see you</p>
                </div>
              </button>
            )}
          </div>
        )}

        {mode === 'report' && (
          <div className="p-4 space-y-3">
            <p className="text-xs text-neutral-400">Why are you reporting this?</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm ${
                    reason === r ? 'bg-accent/20 text-white border border-accent/40' : 'hover:bg-white/5 text-neutral-300'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={2}
              placeholder="Optional details…"
              className="w-full px-3 py-2 rounded-lg glass-input text-sm resize-none"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              onClick={submitReport}
              disabled={busy}
              className="w-full py-2.5 rounded-lg text-sm font-medium text-white bg-accent-grad hover:brightness-110 disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Submit report'}
            </button>
          </div>
        )}

        {mode === 'done' && (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-white font-medium">We received your request</p>
            <p className="text-sm text-neutral-400 mt-1">Our team reviews reports to keep Contrest safe.</p>
            <button onClick={onClose} className="mt-5 text-sm text-accent hover:underline">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
