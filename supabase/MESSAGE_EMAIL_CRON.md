# Message email schedule (24h unread rule)

Because mail only sends after **24 hours unread**, something must run later than the moment you hit Send.

## Option A — Supabase Dashboard schedule (easiest)

1. Deploy: `supabase functions deploy notify-message-email`
2. Dashboard → **Edge Functions** → `notify-message-email` → **Schedules** (or Project → Cron)
3. Cron: `0 * * * *` (every hour)
4. Body: `{}`
5. Auth: use service role header, or set secret:

```bash
supabase secrets set CRON_SECRET=some_long_random_string
```

And configure the schedule to send header `x-cron-secret: some_long_random_string`.

## Option B — Invoke with service role hourly from any cron

```bash
curl -X POST "https://YOUR_REF.supabase.co/functions/v1/notify-message-email" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Rules reminder

| Rule | Value |
|------|--------|
| Unread age before first email | 24 hours |
| After email, user **opened/read** chat | next email after **1 week** |
| After email, user **never checked** | next email after **2 weeks** |
| APP_URL | `https://contrest.pro.et` |
