/*
  Optional music metadata on posts (Audius background tracks).
  Run in Supabase SQL Editor if not using `supabase db push`.
*/

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS music_track_id text,
  ADD COLUMN IF NOT EXISTS music_title text,
  ADD COLUMN IF NOT EXISTS music_artist text,
  ADD COLUMN IF NOT EXISTS music_stream_url text,
  ADD COLUMN IF NOT EXISTS music_artwork_url text;

NOTIFY pgrst, 'reload schema';
