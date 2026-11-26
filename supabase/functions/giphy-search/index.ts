// Supabase Edge Function: giphy-search
// Keeps the GIPHY key server-side and requires an authenticated Contrest user.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('CONTREST_ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;
const requestLog = new Map<string, number[]>();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function allowedNow(userId: string): boolean {
  const now = Date.now();
  const recent = (requestLog.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) {
    requestLog.set(userId, recent);
    return false;
  }
  recent.push(now);
  requestLog.set(userId, recent);
  return true;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseAnonKey) return json({ error: 'Authentication service unavailable' }, 500);

    const token = authHeader.slice('Bearer '.length);
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return json({ error: 'Invalid or expired session' }, 401);
    if (!allowedNow(user.id)) return json({ error: 'Too many GIF searches. Please wait a minute.' }, 429);

    const body = await req.json();
    const query = String(body?.q ?? '').slice(0, 60).trim();
    const apiKey = Deno.env.get('GIPHY_API_KEY');
    if (!apiKey) return json({ error: 'GIF service temporarily unavailable' }, 503);

    const endpoint = query
      ? `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=24&rating=pg-13`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=24&rating=pg-13`;

    const giphyRes = await fetch(endpoint);
    if (!giphyRes.ok) return json({ error: 'GIF service temporarily unavailable' }, 502);

    const data = await giphyRes.json();
    const gifs = (data?.data ?? []).map((g: any) => ({
      id: String(g.id ?? ''),
      title: String(g.title || 'GIF').slice(0, 120),
      url: g.images?.fixed_height?.url ?? g.images?.original?.url,
      previewUrl: g.images?.fixed_height_small?.url ?? g.images?.preview_gif?.url,
    })).filter((g: any) => g.id && g.url);

    return json({ gifs });
  } catch {
    return json({ error: 'Unable to search GIFs right now' }, 500);
  }
});
