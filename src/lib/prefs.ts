import type { LogoVariant, ThemeAccent } from '@/lib/supabase';

const LOGO_KEY = 'contrest_logo_variant';
const ACCENT_KEY = 'contrest_theme_accent';

const ACCENT_MAP: Record<ThemeAccent, { a400: string; a500: string; a600: string }> = {
  purple: { a400: '#c084fc', a500: '#a855f7', a600: '#7c3aed' },
  cyan: { a400: '#5ecbf5', a500: '#2fb6e8', a600: '#1a8fc4' },
  white: { a400: '#f5f5f5', a500: '#e5e5e5', a600: '#d4d4d4' },
};

export function getStoredLogoVariant(fallback: LogoVariant = 'official'): LogoVariant {
  try {
    const v = localStorage.getItem(LOGO_KEY) as LogoVariant | null;
    if (v === 'classic' || v === 'official') return v;
    // migrate away from white logo option
    if (v === 'white') return 'official';
  } catch {
    /* ignore */
  }
  return fallback;
}

export function setStoredLogoVariant(v: LogoVariant) {
  try {
    localStorage.setItem(LOGO_KEY, v === 'white' ? 'official' : v);
  } catch {
    /* ignore */
  }
}

export function getStoredAccent(fallback: ThemeAccent = 'purple'): ThemeAccent {
  try {
    const v = localStorage.getItem(ACCENT_KEY) as ThemeAccent | null;
    if (v === 'purple' || v === 'cyan' || v === 'white') return v;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function setStoredAccent(v: ThemeAccent) {
  try {
    localStorage.setItem(ACCENT_KEY, v);
  } catch {
    /* ignore */
  }
}

/** Apply accent so Tailwind var(--accent-*) and utilities update immediately */
export function applyAccent(accent: ThemeAccent) {
  const root = document.documentElement;
  root.dataset.accent = accent;
  const m = ACCENT_MAP[accent] ?? ACCENT_MAP.purple;
  root.style.setProperty('--accent-400', m.a400);
  root.style.setProperty('--accent-500', m.a500);
  root.style.setProperty('--accent-600', m.a600);
}
