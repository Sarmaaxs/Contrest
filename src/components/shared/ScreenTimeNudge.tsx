import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { isScreenTimeReminderOn, getScreenTimeMinutes, setScreenTimeReminderOn } from '@/lib/screenTime';

/**
 * A friendly "you've been here a while" check-in, not a lockout. This is
 * the single feature every major platform eventually added once they took
 * heat for optimizing purely for time-on-app: common social-media
 * screen-time reminders. It doesn't drive engagement — it's there
 * because unmoderated infinite-scroll is a genuine, well-documented user
 * complaint, and addressing it (instead of ignoring it, like most
 * from-scratch social apps do) is a real point of difference.
 *
 * Counts only foreground time (pauses when the tab isn't visible), and
 * respects "Turn off" immediately and permanently — this is meant to be
 * useful, not just present so we can say we have it.
 */
export default function ScreenTimeNudge() {
  const [visible, setVisible] = useState(false);
  const secondsRef = useRef(0);
  const dismissedThisSessionRef = useRef(false);

  useEffect(() => {
    if (!isScreenTimeReminderOn()) return;

    const thresholdSeconds = getScreenTimeMinutes() * 60;

    const tick = () => {
      if (document.visibilityState === 'visible' && !dismissedThisSessionRef.current) {
        secondsRef.current += 1;
        if (secondsRef.current >= thresholdSeconds) {
          setVisible(true);
        }
      }
    };

    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, []);

  if (!visible) return null;

  const snooze = () => {
    setVisible(false);
    secondsRef.current = 0;
  };

  const dismissForSession = () => {
    setVisible(false);
    dismissedThisSessionRef.current = true;
  };

  const turnOff = () => {
    setScreenTimeReminderOn(false);
    dismissForSession();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm glass-strong rounded-2xl p-5 text-center">
        <div className="w-12 h-12 rounded-full bg-accent/15 flex items-center justify-center mx-auto mb-3">
          <Clock className="w-6 h-6 text-accent" />
        </div>
        <h2 className="text-white font-semibold mb-1">Take a beat?</h2>
        <p className="text-sm text-neutral-400 mb-5">
          You've been scrolling for a while. No pressure — just checking in.
        </p>
        <div className="space-y-2">
          <button
            onClick={dismissForSession}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-drop-500 to-drop-600 hover:brightness-110"
          >
            Keep scrolling
          </button>
          <button
            onClick={snooze}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-neutral-300 hover:bg-white/5"
          >
            Remind me again later
          </button>
          <button onClick={turnOff} className="w-full py-1.5 text-xs text-neutral-500 hover:text-neutral-300">
            Turn off these reminders
          </button>
        </div>
      </div>
    </div>
  );
}
