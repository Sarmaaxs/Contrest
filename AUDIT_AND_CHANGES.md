# Contrest v4 — engineering audit and hardening pass

This archive contains a focused hardening pass over the supplied `Contrest-v4-updated.zip` codebase.

## Changes applied

### Security and privacy
- Enforced post visibility at the Supabase/Postgres boundary with `can_view_post()`.
- Followers-only, close-friends, private-account, flagged-post, and block rules now apply to direct post reads instead of relying only on the UI.
- Applied the same post-visibility rule to likes, comments, and repost reads.
- Restricted story-view history to the viewer or the owner of the story.
- Kept the conversation-membership hardening already present and added no unsafe membership fallback.
- Nuvessia now requires a valid Supabase user session and has a per-user request limit.
- GIPHY search now requires authentication and has a per-user request limit.
- Upstream AI/GIPHY error bodies are no longer returned to browsers.
- Service-role authentication in the message-email function now uses an exact bearer-token comparison rather than substring matching.
- Login alerts no longer send the user's IP address to a third-party geolocation service.
- New-device alerts handle Linux, ChromeOS, Windows Phone, Samsung Internet, and other common user agents.
- A race between two simultaneous sign-ins cannot create two alerts for the same device because the unique device constraint is respected.

### Notifications
- Notification preferences now actually gate notification creation.
- Rapid duplicate notifications are suppressed for a short client-side window.
- Self-generated social notifications are ignored (security login alerts remain allowed).

### Create / media
- Removed competitor-specific Create UI references and changed the visual accent to Contrest's own theme variables.
- Corrected the upload-size text to match the actual 12 MB photo / 25 MB video limits.
- Re-selecting the same file now works after clearing/retaking media.
- Failed posts clean up uploaded media/audio where possible, reducing orphaned Storage usage.
- Removed the dangerous legacy post-insert fallback that could discard privacy/moderation fields and accidentally publish with weaker defaults.

### Settings / UX
- "Download your data" now works as a client-side JSON export for the user's profile, posts, comments, likes, follows, and bookmarks.
- Fixed Quiet Mode so it actually reduces decorative motion globally.
- Fixed Data Saver so it is applied globally and causes Reels to preload only the active video.
- Removed an unused location-sharing state that had no functional effect.
- Profile setting writes now surface Supabase errors instead of silently pretending they succeeded.

## Verification notes

A dependency install was attempted, but the environment timed out while downloading packages. The archive therefore was **not falsely marked as build/typecheck/lint PASS**. Static source, configuration, and migration inspection was performed, and the final ZIP includes the changes above.

Before production deployment, run:

```bash
npm install
npm run typecheck
npm run lint
npm run build
```

Then apply all Supabase migrations in order and test RLS with at least two separate authenticated accounts.
