import { supabase } from '@/lib/supabase';
import { notify } from '@/lib/notify';

async function hashDevice(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function describeDevice(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /SamsungBrowser\//.test(ua)
        ? 'Samsung Internet'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Firefox\//.test(ua)
            ? 'Firefox'
            : /Safari\//.test(ua)
              ? 'Safari'
              : 'Browser';
  const os = /Windows Phone/.test(ua)
    ? 'Windows Phone'
    : /Windows/.test(ua)
      ? 'Windows'
      : /CrOS/.test(ua)
        ? 'ChromeOS'
        : /Android/.test(ua)
          ? 'Android'
          : /iPhone|iPad|iPod/.test(ua)
            ? 'iOS'
            : /Mac OS X|Macintosh/.test(ua)
              ? 'macOS'
              : /Linux/.test(ua)
                ? 'Linux'
                : 'Unknown device';
  return `${browser} on ${os}`;
}

/**
 * Records a successful sign-in only once per browser/device. We intentionally
 * do not call a third-party IP geolocation service: login security should not
 * leak the user's IP address to another company just to decorate a notice.
 */
export async function checkAndAlertNewDevice(userId: string): Promise<void> {
  try {
    const deviceHash = await hashDevice(`${navigator.userAgent}|${navigator.language}`);

    const { data: existing, error: lookupError } = await supabase
      .from('login_devices')
      .select('id')
      .eq('user_id', userId)
      .eq('device_hash', deviceHash)
      .maybeSingle();

    if (lookupError) return;

    if (existing) {
      await supabase.from('login_devices').update({ last_seen: new Date().toISOString() }).eq('id', existing.id);
      return;
    }

    const { error: insertError } = await supabase.from('login_devices').insert({
      user_id: userId,
      device_hash: deviceHash,
      user_agent: navigator.userAgent,
      location_label: null,
    });

    // A second tab/session can race the lookup. The unique constraint means
    // only the winner should send the security alert.
    if (insertError) {
      if (insertError.code === '23505') return;
      return;
    }

    await notify({
      user_id: userId,
      actor_id: userId,
      type: 'login_alert',
      message: `New sign-in detected from ${describeDevice()}. If this wasn't you, change your password in Settings.`,
    });
  } catch {
    // Never let device-alert telemetry block or break sign-in.
  }
}
