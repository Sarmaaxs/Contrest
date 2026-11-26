# Contrest release-candidate pass

This pass focuses on completing the current product rather than adding superficial UI.

## Included
- Shareable post, message, profile and Studio project routes.
- Persistent editor project model with owner-only RLS.
- Contrest Studio editor: media import, timeline, clip timing, split/delete, text tracks, canvas ratios, undo/redo, cloud save and browser WebM preview export.
- Existing social features retained: bookmarks/saved posts, drafts, hashtags, mentions, blocks, reports, notifications, Reels and Quick Edit.
- Reels active-video playback and data-saver behavior remain enabled.

## Deployment
Apply all migrations in `supabase/migrations/` in timestamp order. In particular, apply the latest editor and privacy migrations before opening Studio for users.

## Validation
Run `npm install`, then `npm run typecheck`, `npm run lint`, and `npm run build` in a network-enabled environment. Browser WebM export depends on MediaRecorder support and is intentionally a lightweight preview export, not a server render pipeline.
