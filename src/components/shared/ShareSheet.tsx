import { useRef, useState } from 'react';
import { X, Link2, Copy, Check, UserPlus, Share2 } from 'lucide-react';
import { useToast } from '@/context/ToastContext';

const SHARE_ORIGIN = 'https://contrest.pro.et';

type Props = {
  postId: string;
  caption?: string | null;
  onClose: () => void;
};

/** Share / invite sheet — links always use contrest.pro.et */
export default function ShareSheet({ postId, caption, onClose }: Props) {
  const toast = useToast();
  const [copied, setCopied] = useState<'post' | 'invite' | null>(null);
  const inviteInputRef = useRef<HTMLInputElement>(null);
  const postInputRef = useRef<HTMLInputElement>(null);

  const postUrl = `${SHARE_ORIGIN}/post/${encodeURIComponent(postId)}`;
  const inviteUrl = `${SHARE_ORIGIN}/post/${encodeURIComponent(postId)}?invite=1`;

  const copy = async (url: string, kind: 'post' | 'invite') => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(kind);
      toast(kind === 'invite' ? 'Invite link copied' : 'Post link copied');
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Fallback: select the visible input so user can Ctrl/Cmd+C
      const el = kind === 'invite' ? inviteInputRef.current : postInputRef.current;
      if (el) {
        el.focus();
        el.select();
        try {
          document.execCommand('copy');
          setCopied(kind);
          toast('Link selected — press Ctrl+C / ⌘C to copy');
        } catch {
          toast('Select the link and copy manually');
        }
      }
    }
  };

  const nativeShare = async (url: string) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Contrest',
          text: caption?.trim() || 'Check this out on Contrest',
          url,
        });
      } else {
        await copy(url, 'post');
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl glass-strong overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="font-semibold text-white">Share</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10">
            <X className="w-5 h-5 text-neutral-300" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs text-neutral-400 leading-relaxed">
            Links open on <span className="text-neutral-200">contrest.pro.et</span> — viewers see{' '}
            <span className="text-neutral-200">this post only</span>, not your full feed.
          </p>

          {/* Primary action — opens the OS share sheet (Messages, WhatsApp,
              installed sharing targets. This is the Web Share API;
              the person picks the app themselves, we never guess for them. */}
          {typeof navigator !== 'undefined' && 'share' in navigator ? (
            <button
              type="button"
              onClick={() => nativeShare(postUrl)}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, var(--accent-500), var(--accent-600))' }}
            >
              <Share2 className="w-4 h-4" />
              Share to…
            </button>
          ) : (
            <p className="text-[11px] text-neutral-500 -mt-1">
              Your browser doesn't support sharing straight to apps — use copy link below.
            </p>
          )}

          {/* Post link — selectable + copy */}
          <div className="rounded-xl glass px-3 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                {copied === 'post' ? (
                  <Check className="w-4 h-4 text-accent" />
                ) : (
                  <Link2 className="w-4 h-4 text-accent" />
                )}
              </div>
              <p className="text-sm font-medium text-white flex-1">Post link</p>
              <button
                type="button"
                onClick={() => copy(postUrl, 'post')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, var(--accent-500), var(--accent-600))' }}
              >
                <Copy className="w-3.5 h-3.5" />
                {copied === 'post' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <input
              ref={postInputRef}
              readOnly
              value={postUrl}
              onFocus={(e) => e.target.select()}
              className="w-full text-[11px] text-neutral-400 bg-black/40 rounded-lg px-2.5 py-2 outline-none border border-white/10 select-all"
            />
          </div>

          {/* Invite link — selectable + copy */}
          <div className="rounded-xl glass px-3 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                {copied === 'invite' ? (
                  <Check className="w-4 h-4 text-accent" />
                ) : (
                  <UserPlus className="w-4 h-4 text-neutral-200" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">Invite friends</p>
                <p className="text-[11px] text-neutral-500">Opens this photo/video on Contrest</p>
              </div>
              <button
                type="button"
                onClick={() => copy(inviteUrl, 'invite')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, var(--accent-600), var(--accent-500))' }}
              >
                <Copy className="w-3.5 h-3.5" />
                {copied === 'invite' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <input
              ref={inviteInputRef}
              readOnly
              value={inviteUrl}
              onFocus={(e) => e.target.select()}
              className="w-full text-[11px] text-neutral-400 bg-black/40 rounded-lg px-2.5 py-2 outline-none border border-white/10 select-all"
            />
          </div>

        </div>
      </div>
    </div>
  );
}
