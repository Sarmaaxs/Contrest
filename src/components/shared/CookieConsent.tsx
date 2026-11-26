import { useEffect, useState } from 'react';
import { Cookie } from 'lucide-react';
import { getConsent, setConsent } from '@/lib/consent';

/**
 * The disclosure banner every real website shows on first visit. Contrest
 * doesn't set third-party ad-tracking cookies, but it does use local
 * storage/cookies for two things people are entitled to know about:
 * staying signed in (Supabase's auth session) and, only if accepted here,
 * anonymous usage analytics (Vercel Analytics). "Necessary only" actually
 * disables analytics — see src/lib/consent.ts — this isn't just a label.
 */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    setVisible(getConsent() === null);
  }, []);

  if (!visible) return null;

  const choose = (choice: 'all' | 'necessary') => {
    setConsent(choice);
    setVisible(false);
    // Analytics is only mounted after a choice — reload so main.tsx
    // re-evaluates hasAnalyticsConsent() cleanly on next load, and so an
    // "Accept all" takes effect immediately rather than only after a
    // manual refresh from the person.
    if (choice === 'all') window.location.reload();
  };

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed bottom-0 inset-x-0 z-[100] p-3 sm:p-4 flex justify-center"
    >
      <div className="w-full max-w-lg glass-strong rounded-2xl border border-white/10 p-4 shadow-2xl shadow-black/50">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
            <Cookie className="w-4 h-4 text-accent" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-white font-medium">We use cookies &amp; local storage</p>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
              Contrest uses your browser's storage to keep you signed in and remember your
              preferences. With your consent, we also use anonymous analytics to see how the app
              is used.{' '}
              <button
                type="button"
                onClick={() => setShowDetails((v) => !v)}
                className="underline underline-offset-2 hover:text-neutral-200"
              >
                {showDetails ? 'Hide details' : 'Details'}
              </button>
            </p>
            {showDetails && (
              <ul className="text-[11px] text-neutral-500 mt-2 space-y-1 list-disc pl-4">
                <li>
                  <span className="text-neutral-300">Required:</span> session storage to keep you
                  signed in — always on, the app can't function without it.
                </li>
                <li>
                  <span className="text-neutral-300">Optional:</span> Vercel Analytics, anonymous
                  usage stats — only loads if you choose "Accept all" below.
                </li>
              </ul>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button
            type="button"
            onClick={() => choose('necessary')}
            className="flex-1 text-sm font-medium text-neutral-300 py-2 rounded-lg hover:bg-white/5"
          >
            Necessary only
          </button>
          <button
            type="button"
            onClick={() => choose('all')}
            className="flex-1 text-sm font-semibold text-white py-2 rounded-lg bg-gradient-to-r from-drop-500 to-drop-600 hover:brightness-110"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
