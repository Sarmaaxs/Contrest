# What changed, and why

Contrest is a React + Vite + Supabase social app. Everything below runs on
what you already had — no new backend, no rewrite. (More on the Go/Python/
"real company stack" question at the bottom.)

## Structure
- Deleted `project/` — a stale, out-of-sync duplicate of your entire `src/`
  folder that was shipping alongside the real one. It wasn't imported by
  anything; it was just clutter that made the repo confusing to navigate.
- Deleted a duplicate root `Maintenance.html` (the real one Vite serves is
  `public/maintenance.html`).

## Security fixes
1. **Removed a third-party sales tracker** silently loaded on every page via
   `index.html` (`assets.apollo.io` — a B2B lead-gen script, not something a
   consumer app should ship). It had full script access to your DOM. Gone.
2. **Real HTTP security headers** — `public/_headers` (Netlify/Cloudflare
   Pages format): CSP, `X-Frame-Options: DENY`, HSTS, `X-Content-Type-Options`,
   `Permissions-Policy`, `Referrer-Policy`. Same baseline Stripe/GitHub ship.
   If you deploy on Vercel, the equivalent goes in `vercel.json` — ask me and
   I'll generate it.
3. **Login throttling with exponential backoff** — `src/lib/security.ts`,
   wired into `AuthContext.signIn`. Same idea as GitHub/Google: slow down
   repeated failed logins instead of an outright lockout.
4. **Password strength enforcement** — a live strength meter on signup
   (Dropbox/GitHub-style) plus rejection of common/weak passwords, both
   client-side ahead of the Supabase call.
5. **Fixed a stored-XSS-adjacent upload bug** — file extensions were derived
   from the *user-supplied filename*, so a file named `pic.svg` could reach
   storage and later get served with SVG/script content. Extension
   resolution is now MIME-type-driven with a strict allowlist, and
   SVG/HTML/executable uploads are explicitly blocked.
6. **Abuse cooldowns** on posting, uploading, and messaging (Twitter/
   Instagram-style "you're doing that too much"), plus your existing
   `moderateText` filter now also runs on direct messages, not just posts.
7. **Input caps** — captions (2200 chars) and messages (2000 chars), matching
   Instagram's limits, with control-character stripping.

## New feature: two-factor authentication
`src/components/security/TwoFactorSetup.tsx`, reachable from
Settings → Account → Two-factor authentication.

Standard TOTP 2FA — the same mechanism Google, GitHub, and X use: scan a QR
code with an authenticator app, confirm one 6-digit code, done. Runs on
Supabase Auth's built-in MFA (`supabase.auth.mfa`), so there's no custom
backend to build or maintain.

Also added: **in-app change password** (Settings → Account → Change
password) — previously the only way to change your password was the
forgot-password email flow.

## About "copy the big-company stack"
The message you pasted describes a generic large-scale social app stack
(React frontend, Go/Python microservices, dedicated video processing
pipeline). That's real for apps operating at Instagram/TikTok's scale, but
it's a different architecture, not a feature — swapping Supabase for
hand-rolled Go/Python services would mean standing up and hosting your own
servers, databases, and auth system from scratch, which is a multi-month
infra project, not something to bolt onto an existing app in place.

What you have today (Supabase: Postgres + Auth + Storage + Edge Functions,
called from a React/Vite frontend) is functionally the same shape at your
current scale — Supabase Edge Functions *are* your backend logic layer, and
Storage + client-side compression is your (lightweight) media pipeline. If
you ever outgrow it, the natural move is offloading video specifically to a
dedicated service (Mux, Cloudflare Stream), not rewriting everything.

## Recommendation on the "messaging button"
I looked at `MessagesView` and its RLS migrations closely — it's genuinely
one of the more solid parts of the codebase (proper conversation-membership
RLS, read receipts, scheduled sends). I wouldn't cut it. It's now also the
best-protected surface (moderation + cooldown + input caps all added there
first).

## Still worth doing (didn't get to these)
- Feed pagination / infinite scroll — I didn't find explicit `range()`/
  `limit()` pagination in `feed.ts`; worth confirming `FeedView` isn't
  loading the whole table at once as your post count grows.
- "Active sessions" / login-activity page — needs the Supabase Admin API
  (server-side), not just the browser client, so it can't be done from the
  frontend alone.
- Rate limiting is currently in-memory per browser tab (resets on refresh).
  Fine as a UX nicety; real abuse prevention still has to live server-side
  (Supabase Auth already rate-limits sign-ins/sign-ups on its end).
