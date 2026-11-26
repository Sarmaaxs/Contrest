# Contrest Studio

Contrest Studio is the creator workspace planned for `editor.contrest.pro.et`.

## Current foundation
- Authenticated `editor_projects` storage with owner-only RLS.
- Versioned JSON project document (`version`, `duration`, `tracks`).
- Updated-at trigger and user/update index.
- In-app Studio dashboard with project creation, recovery-safe local projects, and creator metrics.

## V1 editor contract
A project document should remain serializable and renderer-independent:

```json
{
  "version": 1,
  "duration": 0,
  "tracks": []
}
```

Each future track should contain ordered clips with source asset IDs, start time, duration, trim in/out, transform, volume, and optional effect/text metadata. Keep the document backward-compatible by migrating `version` values rather than changing old projects in place.

## Subdomain deployment
Deploy the future editor application separately at `editor.contrest.pro.et`, while reusing Contrest authentication. The social app should publish finished exports through a controlled upload/publish API rather than sharing editor internals with the feed UI.

## Planned V1
Timeline, trim, split, reorder, text, overlays, audio, aspect ratios, transitions, filters, undo/redo, autosave, recovery, export and publish.
