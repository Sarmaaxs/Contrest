/**
 * Music catalog for background sounds on posts.
 * API key is a public client key.
 */
const AUDIUS_API_KEY = 'de6ccbfbc0ffa3b051a83e1c6665ddb3ad309282';
const API_BASE = 'https://api.audius.co/v1';

export type AudiusTrack = {
  id: string;
  title: string;
  user: { name: string; handle?: string };
  artwork?: { '150x150'?: string; '480x480'?: string } | null;
  duration: number;
  genre?: string | null;
  mood?: string | null;
  permalink?: string;
  streamUrl: string;
};

type RawTrack = {
  id: string;
  title: string;
  user?: { name?: string; handle?: string };
  artwork?: { '150x150'?: string; '480x480'?: string } | null;
  duration?: number;
  genre?: string | null;
  mood?: string | null;
  permalink?: string;
  is_streamable?: boolean;
  is_stream_gated?: boolean;
  is_available?: boolean;
  is_delete?: boolean;
  is_unlisted?: boolean;
};

function mapTrack(t: RawTrack): AudiusTrack {
  const id = String(t.id);
  return {
    id,
    title: t.title ?? 'Untitled',
    user: { name: t.user?.name ?? 'Unknown', handle: t.user?.handle },
    artwork: t.artwork ?? null,
    duration: t.duration ?? 0,
    genre: t.genre ?? null,
    mood: t.mood ?? null,
    permalink: t.permalink,
    streamUrl: `${API_BASE}/tracks/${encodeURIComponent(id)}/stream?app_name=contrest&api_key=${AUDIUS_API_KEY}`,
  };
}

function isPlayable(t: RawTrack): boolean {
  if (t.is_delete || t.is_unlisted) return false;
  if (t.is_available === false) return false;
  if (t.is_streamable === false) return false;
  if (t.is_stream_gated === true) return false;
  return true;
}

async function audiusFetch(path: string): Promise<any> {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${API_BASE}${path}${sep}app_name=contrest&api_key=${AUDIUS_API_KEY}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      // Higher rate limits when key is valid; ignored if not required
      Authorization: `Bearer ${AUDIUS_API_KEY}`,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Music catalog error (${res.status}). Try again in a moment.`);
  }
  return res.json();
}

function mapList(data: any): AudiusTrack[] {
  const list: RawTrack[] = data?.data ?? (Array.isArray(data) ? data : []);
  return (Array.isArray(list) ? list : []).filter(isPlayable).map(mapTrack);
}

export async function searchAudiusTracks(query: string, limit = 30): Promise<AudiusTrack[]> {
  const q = query.trim();
  if (!q) return getTrendingAudiusTracks(limit);
  const data = await audiusFetch(
    `/tracks/search?query=${encodeURIComponent(q)}&limit=${limit}`
  );
  const mapped = mapList(data);
  // If search is sparse, top up with trending so the list never looks empty
  if (mapped.length < 8) {
    const more = await getTrendingAudiusTracks(limit);
    const seen = new Set(mapped.map((t) => t.id));
    for (const t of more) {
      if (!seen.has(t.id)) mapped.push(t);
      if (mapped.length >= limit) break;
    }
  }
  return mapped;
}

export async function getTrendingAudiusTracks(limit = 30): Promise<AudiusTrack[]> {
  const data = await audiusFetch(`/tracks/trending?limit=${limit}&time=week`);
  let mapped = mapList(data);
  if (mapped.length === 0) {
    const fallback = await audiusFetch(`/tracks/trending?limit=${limit}`);
    mapped = mapList(fallback);
  }
  return mapped;
}

/** Resolve redirect to a direct stream URL for more reliable <audio> playback */
export async function resolveStreamUrl(streamUrl: string): Promise<string> {
  try {
    const res = await fetch(streamUrl, { method: 'HEAD', redirect: 'follow' });
    if (res.ok && res.url) return res.url;
  } catch {
    /* CORS on HEAD may fail in browser — fall through */
  }
  return streamUrl;
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

