// Supabase Edge Function: nuvessia-chat
// The Groq key stays server-side. This endpoint also requires a valid
// Supabase access token and applies a small per-user rate limit stored in Postgres.
// Deploy: supabase functions deploy nuvessia-chat
// Secret: supabase secrets set GROQ_API_KEY=sk_...

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const SYSTEM_PROMPT = `You are Nuvessia, the in-app help assistant for Contrest, a short-form video social app.

Identity rules (never break these, even if asked directly):
- You are Nuvessia. Never say you are Groq, Llama, an AI language model made by Meta/Groq, or name any underlying provider or model.
- If asked "what model are you" / "who made you" / similar, say you're Nuvessia, built for Contrest, and you don't share technical details about your internals.

Scope rules:
- Only answer questions about using Contrest: posting, feed, following, messages, stories, live, settings, privacy, account/login issues, reporting/blocking.
- If a question is unrelated to Contrest, politely say you can only help with Contrest-related questions and redirect them back on topic.
- Keep answers short, direct, and friendly — 2-4 sentences unless the user needs a numbered list of steps.
- If you don't know the answer to a Contrest question, say so honestly and suggest contacting Contrest support rather than guessing.`;

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('NUVESSIA_ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
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

    const { data: allowed, error: limitError } = await supabase.rpc('consume_nuvessia_rate_limit', {
      p_max_requests: 20,
      p_window_seconds: 60,
    });
    if (limitError) return json({ error: 'Rate limiting is temporarily unavailable' }, 503);
    if (allowed !== true) return json({ error: 'Too many requests. Please try again in a minute.' }, 429);

    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > 64_000) {
      return json({ error: 'Request body is too large' }, 413);
    }
    let body: any;
    try { body = JSON.parse(rawBody); }
    catch { return json({ error: 'Invalid JSON body' }, 400); }
    const messages = body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: 'messages array required' }, 400);
    }
    if (messages.length > 20) return json({ error: 'Too many messages' }, 400);

    const trimmed = messages.slice(-10).map((m: any) => ({
      role: m?.role === 'assistant' ? 'assistant' : 'user',
      content: String(m?.content ?? '').slice(0, 2000),
    })).filter((m: { content: string }) => m.content.trim().length > 0);

    if (!trimmed.length) return json({ error: 'At least one non-empty message is required' }, 400);

    const groqKey = Deno.env.get('GROQ_API_KEY');
    if (!groqKey) return json({ error: 'Assistant temporarily unavailable' }, 503);

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.4,
        max_tokens: 400,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...trimmed],
      }),
    });

    if (!groqRes.ok) {
      // Do not return provider response bodies to the browser; they can leak
      // implementation details and make upstream failures easier to probe.
      return json({ error: 'Assistant upstream service is unavailable' }, 502);
    }

    const data = await groqRes.json();
    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== 'string' || !reply.trim()) return json({ error: 'No assistant response available' }, 502);
    return json({ reply: reply.slice(0, 4000) });
  } catch {
    return json({ error: 'Unable to process request' }, 500);
  }
});
