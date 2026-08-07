# Contrest

Social video/content platform. React + TypeScript + Vite frontend, Supabase
(Postgres, Auth, Storage, Realtime, Edge Functions) backend.

## Setup

```bash
npm install
cp .env.example .env   # fill in your Supabase project URL and anon key
npm run dev
```

## Database

Migrations live in `supabase/migrations/`, applied in filename order via the
Supabase CLI or by running each file in the SQL Editor in order:

```bash
supabase db push
```

## Docs

- `docs/setup.md` — device upload / camera / live streaming setup
- `docs/storage.md` — storage provider guidance and limits
- `CHANGELOG.md` — feature and fix history

## Edge Functions

`supabase/functions/nuvessia-chat` powers in-app support chat. Deploy and
configure its API key as a Supabase secret, never as a client-side `VITE_`
variable:

```bash
supabase functions deploy nuvessia-chat
supabase secrets set GROQ_API_KEY=your_key_here
```

## Message email alerts (custom SMTP / Gmail)

Uses the same style of SMTP as Supabase Auth (e.g. Gmail app password). Subject is vague on purpose: **"Someone sent you a message"**.

```bash
supabase functions deploy notify-message-email

# Same credentials as Project Settings → Auth → SMTP
supabase secrets set SMTP_HOST=smtp.gmail.com
supabase secrets set SMTP_PORT=465
supabase secrets set SMTP_USER=you@gmail.com
supabase secrets set SMTP_PASS=your_gmail_app_password
supabase secrets set SMTP_FROM="Contrest <you@gmail.com>"
supabase secrets set APP_URL=https://contrest.pro.et
```

Without SMTP secrets the function no-ops (chat still works).

## Read receipts (Telegram-style)

Run migration `20260806100000_message_read_receipts.sql`.
- 1 check = sent, not opened yet
- 2 blue checks = recipient opened the chat

## Verification (Supabase only)

```sql
UPDATE public.profiles SET is_verified = true WHERE username = 'your_handle';
```


## Password reset (OTP)

Auth screen uses `resetPasswordForEmail` → user enters the **OTP code** + new password via `verifyOtp({ type: 'recovery' })`.
Emails are sent through **your existing Supabase Auth custom SMTP** — no extra app password in the client.

Ensure Auth email template for Recovery is the OTP/code style (not only a magic link) in Supabase Dashboard → Auth → Email Templates.

## Message emails vs Auth SMTP

Supabase **Auth SMTP** only powers Auth emails (signup, recovery OTP, etc.).
Edge Functions cannot read those SMTP settings automatically. Optional DM alert emails need function secrets *once* (same Gmail values) — not again on every login.
