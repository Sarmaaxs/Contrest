# Contrest — device uploads & live setup

## 1. Run SQL migrations (Supabase SQL Editor)

In order:

1. `supabase/migrations/20260727153230_contrest_schema.sql`
2. `supabase/migrations/20260728090000_profile_trigger_and_scheduling.sql`
3. `supabase/migrations/20260728180000_moderation_privacy_stories.sql`
4. **`supabase/migrations/20260730100000_storage_and_fixes.sql`** ← storage buckets for photos/videos/avatars

Or create buckets manually in Dashboard → Storage:

- Bucket `media` (public), 50MB, images + video
- Bucket `avatars` (public), 5MB, images only

Policies: authenticated users may insert/update/delete only under folder `{auth.uid()}/...`

## 2. Why follow / search / live failed before

- Search results were not clickable → fixed (opens profile + Follow button)
- Explore did not receive `onOpenProfile` → fixed
- Posts required a URL → now **Gallery / Camera** device upload
- Avatar was URL-only → camera button on profile (mobile-first)
- Live needed `live_streams` table + clearer errors; host now gets **real camera** via getUserMedia

## 3. Run app

```bash
npm install
npm run dev
```

Allow camera/mic when browser asks (Live + camera capture).
