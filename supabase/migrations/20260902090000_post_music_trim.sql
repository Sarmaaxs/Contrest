/*
  Adds a trim start-point and a "custom upload" mode to post music, so
  people can pick which 15s of a track plays instead of always starting at
  0:00, and can attach their own audio clip instead of only catalog tracks.

  Run in Supabase SQL Editor if not using `supabase db push`.
*/

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS music_start_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS music_source text NOT NULL DEFAULT 'audius';

ALTER TABLE public.posts
  ADD CONSTRAINT posts_music_start_seconds_check CHECK (music_start_seconds >= 0),
  ADD CONSTRAINT posts_music_source_check CHECK (music_source IN ('audius', 'custom'));

NOTIFY pgrst, 'reload schema';
