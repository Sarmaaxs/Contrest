/**
 * "Someone sent you a message" — platform-style, not every "hi".
 *
 * Rules:
 *  1) Unread must be at least 24 hours old before any email.
 *  2) After an email:
 *       - If they opened/read the chat → next email after 1 week
 *       - If they never checked → next email after 2 weeks
 *  3) At most one email per conversation+recipient per those windows.
 *
 * Triggers:
 *  - Client may invoke after send (usually no-ops until 24h).
 *  - Cron should invoke hourly with body {} to process all due chats.
 *
 * Secrets: SMTP_* and APP_URL=https://contrest.pro.et
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const TWO_WEEKS = 14 * DAY;
const UNREAD_MIN_AGE = DAY; // 24h

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const smtpHost = Deno.env.get('SMTP_HOST') ?? 'smtp.gmail.com';
    const smtpPort = Number(Deno.env.get('SMTP_PORT') ?? '465');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');
    const smtpFrom = Deno.env.get('SMTP_FROM') ?? smtpUser ?? 'noreply@contrest.pro.et';
    const appUrl = Deno.env.get('APP_URL') ?? 'https://contrest.pro.et';

    if (!smtpUser || !smtpPass) {
      return json({ ok: true, skipped: true, reason: 'SMTP secrets missing' });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const conversationId = body?.conversation_id as string | undefined;

    // Auth: user JWT (from app) OR service role / cron secret
    const authHeader = req.headers.get('Authorization') ?? '';
    const isService =
      authHeader === `Bearer ${serviceKey}` ||
      req.headers.get('x-cron-secret') === Deno.env.get('CRON_SECRET');

    let actorId: string | null = null;
    if (!isService) {
      if (!authHeader) return json({ error: 'unauthorized' }, 401);
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const {
        data: { user },
      } = await userClient.auth.getUser();
      if (!user) return json({ error: 'unauthorized' }, 401);
      actorId = user.id;
    }

    // Candidates: one conversation or scan
    type Candidate = { conversation_id: string; recipient_id: string };
    const candidates: Candidate[] = [];

    if (conversationId) {
      const { data: members } = await admin
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', conversationId);
      for (const m of members ?? []) {
        if (actorId && m.user_id === actorId) continue;
        candidates.push({ conversation_id: conversationId, recipient_id: m.user_id });
      }
    } else if (isService) {
      // Cron path: find chats with old unread
      const { data: unreadRows } = await admin
        .from('messages')
        .select('conversation_id, sender_id, created_at')
        .is('read_at', null)
        .neq('status', 'scheduled')
        .lt('created_at', new Date(Date.now() - UNREAD_MIN_AGE).toISOString())
        .limit(500);

      const seen = new Set<string>();
      for (const row of unreadRows ?? []) {
        const { data: members } = await admin
          .from('conversation_members')
          .select('user_id')
          .eq('conversation_id', row.conversation_id);
        for (const m of members ?? []) {
          if (m.user_id === row.sender_id) continue;
          const key = `${row.conversation_id}:${m.user_id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          candidates.push({ conversation_id: row.conversation_id, recipient_id: m.user_id });
        }
      }
    } else {
      return json({ error: 'conversation_id required' }, 400);
    }

    const results: { conversation_id: string; user_id: string; status: string }[] = [];

    for (const { conversation_id: cid, recipient_id: rid } of candidates) {
      // Oldest unread for this recipient (messages not from them)
      const { data: unread } = await admin
        .from('messages')
        .select('id, created_at')
        .eq('conversation_id', cid)
        .neq('sender_id', rid)
        .is('read_at', null)
        .neq('status', 'scheduled')
        .order('created_at', { ascending: true })
        .limit(1);

      if (!unread?.length) {
        results.push({ conversation_id: cid, user_id: rid, status: 'skipped_no_unread' });
        continue;
      }

      const oldest = new Date(unread[0].created_at).getTime();
      if (Date.now() - oldest < UNREAD_MIN_AGE) {
        results.push({ conversation_id: cid, user_id: rid, status: 'skipped_unread_under_24h' });
        continue;
      }

      // Cooldown from last email
      const { data: cool } = await admin
        .from('message_email_cooldowns')
        .select('last_sent_at')
        .eq('conversation_id', cid)
        .eq('user_id', rid)
        .maybeSingle();

      if (cool?.last_sent_at) {
        const lastSent = new Date(cool.last_sent_at).getTime();

        // Did they open/read anything after that email?
        const { count: readAfter } = await admin
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', cid)
          .neq('sender_id', rid)
          .not('read_at', 'is', null)
          .gt('read_at', cool.last_sent_at);

        const engaged = (readAfter ?? 0) > 0;
        const wait = engaged ? WEEK : TWO_WEEKS;

        if (Date.now() - lastSent < wait) {
          results.push({
            conversation_id: cid,
            user_id: rid,
            status: engaged ? 'skipped_cooldown_1week' : 'skipped_cooldown_2weeks',
          });
          continue;
        }
      }

      // Resolve email
      let to: string | undefined;
      try {
        const { data } = await admin.auth.admin.getUserById(rid);
        to = data?.user?.email;
      } catch {
        /* skip */
      }
      if (!to) {
        results.push({ conversation_id: cid, user_id: rid, status: 'skipped_no_email' });
        continue;
      }

      const subject = 'Someone sent you a message';
      const html = `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#0a0a0c;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:440px;margin:32px auto;padding:28px 24px;background:#12121a;border-radius:16px;border:1px solid rgba(255,255,255,0.08);">
    <p style="margin:0 0 6px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#a855f7;font-weight:600;">Contrest</p>
    <h1 style="margin:0 0 12px;font-size:22px;color:#fff;font-weight:700;">Someone sent you a message</h1>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:#a3a3a3;">
      Open Contrest to see who it is and reply.
    </p>
    <a href="${appUrl}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:linear-gradient(135deg,#a855f7,#ec4899);color:#fff;font-weight:600;font-size:14px;text-decoration:none;">
      Check it out
    </a>
  </div>
</body></html>`;

      try {
        const client = new SMTPClient({
          connection: {
            hostname: smtpHost,
            port: smtpPort,
            tls: true,
            auth: { username: smtpUser, password: smtpPass },
          },
        });
        await client.send({
          from: smtpFrom,
          to,
          subject,
          content: 'Someone sent you a message. Open Contrest to see who.',
          html,
        });
        try {
          await client.close();
        } catch {
          /* ignore */
        }

        await admin.from('message_email_cooldowns').upsert({
          conversation_id: cid,
          user_id: rid,
          last_sent_at: new Date().toISOString(),
        });

        results.push({ conversation_id: cid, user_id: rid, status: 'sent' });
      } catch (e) {
        results.push({
          conversation_id: cid,
          user_id: rid,
          status: `error:${String(e).slice(0, 80)}`,
        });
      }
    }

    return json({ ok: true, results });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
