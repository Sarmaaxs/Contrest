# Changelog

## Share & invite
- Share sheet: copy post link, invite link, or native device share.
- Deep link `?post=<id>` opens a single-post viewer (not the full feed).
- Optional `?invite=1` flag for invite-style links.

## Background music (Audius)
- Music selector on create post: search/trending tracks from Audius.
- Preview before attaching; stream URL + title/artist stored on the post.
- Migration: `supabase/migrations/20260805120000_post_music.sql`

## Layout
- Mobile column capped ~430px on narrow layouts (Figma-style phone frame).
- No Contrest Pro upsell — settings remain free features only.

## Messaging
- Real-time direct messages with voice notes and stickers.
- Row-level security on conversations, conversation members, and messages,
  scoped so only conversation participants can read or write.

## Feed & posts
- Device photo/video upload (camera and gallery), replacing URL-only posts.
- Pre-upload video editor: trim, filters (GPU shader effects), beat-synced
  glitch effect, text overlay, WebM export. Falls back to trim + text only
  on browsers without WebGL2.
- Double-tap to like, with animation.
- Feed ranking uses profile interests set during onboarding.

## Profile & onboarding
- First-run onboarding wizard: photo, bio, interests, public/private choice.
- Clickable followers/following lists and profile grid posts.
- Camera-capture avatar upload.

## Live
- Peer-to-peer WebRTC video streaming (host camera to viewers directly).
  Suited to small concurrent audiences; no TURN relay configured.

## Notifications
- Follow, like, and comment notifications, with error logging on failed
  inserts.
- Tapping a like/comment notification opens the related post.

## Support
- In-app help center with FAQ and support chat, routed through a Supabase
  Edge Function so no third-party API key ships in client code.

## Stability
- App-wide error boundary; a single screen crash no longer blanks the
  whole app.
- Clear on-screen message when required environment variables are missing,
  instead of a silent blank page.
- Native `alert()` popups replaced with an in-app toast system.

## Security fixes
- Removed a client-side admin API key that had shipped in a third-party
  storage integration (now Supabase Storage only).
- Removed a status field that stored raw GPS coordinates readable by any
  authenticated user.
- Consolidated all messaging RLS policies into a single tracked migration
  (`supabase/migrations/20260803090000_messaging_rls_lockdown.sql`) after
  several ad hoc SQL Editor scripts had left row-level security in an
  inconsistent state.
