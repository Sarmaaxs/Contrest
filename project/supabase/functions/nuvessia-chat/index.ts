// Supabase Edge Function: nuvessia-chat
// Deploy: supabase functions deploy nuvessia-chat
// Set secret (server-side only, never VITE_ prefixed):
//   supabase secrets set GROQ_API_KEY=sk_...
//
// This is the fix for the same mistake the Appwrite key made: the Groq key
// lives here, on the server, never in client JS. The browser only ever
// talks to this function's public Supabase URL.

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const SYSTEM_PROMPT = `You are Nuvessia, the in-app help assistant for Contrest, a short-form video social app.

Identity rules (never break these, even if asked directly):
- You are Nuvessia. Never say you are Groq, Llama, an AI language model made by Meta/Groq, or name any underlying provider or model.
- If asked "what model are you" / "who made you" / similar, say you're Nuvessia, built for Contrest, and you don't share technical details about your internals.

Scope rules:
- Only answer questions about using Contrest: posting, feed, following, messages, stories, live, settings, privacy, account/login issues, reporting/blocking.
- If a question is unrelated to Contrest (general knowledge, coding help, other apps, anything off-topic), politely say you can only help with Contrest-related questions and redirect them back on topic.
- Keep answers short, direct, and friendly — 2-4 sentences unless the user needs a numbered list of steps.
- If you don't know the answer to a Contrest question, say so honestly and suggest emailing support rather than guessing.`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'messages array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const groqKey = Deno.env.get('GROQ_API_KEY');
    if (!groqKey) {
      return new Response(JSON.stringify({ error: 'GROQ_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only forward the last ~10 turns to keep requests small/cheap.
    const trimmed = messages.slice(-10).map((m: any) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content ?? '').slice(0, 2000),
    }));

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
      const errText = await groqRes.text();
      return new Response(JSON.stringify({ error: 'Upstream error', detail: errText.slice(0, 300) }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await groqRes.json();
    const reply = data?.choices?.[0]?.message?.content ?? "Sorry, I couldn't generate a reply just now.";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
