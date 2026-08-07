/*
# Contrest: moderation, privacy, stories, blocks, reports, reposts, live, bookmarks

Run after previous migrations in Supabase SQL Editor.
*/

-- Profiles: privacy + theme prefs
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS logo_variant text NOT NULL DEFAULT 'official';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS theme_accent text NOT NULL DEFAULT 'purple';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_logo_variant_check') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_logo_variant_check
      CHECK (logo_variant IN ('classic', 'official', 'white'));
  END IF;
END $$;

-- Follow requests (for private accounts)
CREATE TABLE IF NOT EXISTS follow_requests (
  requester_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (requester_id, target_id),
  CHECK (requester_id <> target_id),
  CHECK (status IN ('pending', 'accepted', 'declined'))
);

ALTER TABLE follow_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fr_read" ON follow_requests;
CREATE POLICY "fr_read" ON follow_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR target_id = auth.uid());

DROP POLICY IF EXISTS "fr_insert" ON follow_requests;
CREATE POLICY "fr_insert" ON follow_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS "fr_update" ON follow_requests;
CREATE POLICY "fr_update" ON follow_requests FOR UPDATE TO authenticated
  USING (target_id = auth.uid() OR requester_id = auth.uid());

DROP POLICY IF EXISTS "fr_delete" ON follow_requests;
CREATE POLICY "fr_delete" ON follow_requests FOR DELETE TO authenticated
  USING (requester_id = auth.uid() OR target_id = auth.uid());

-- Blocks
CREATE TABLE IF NOT EXISTS blocks (
  blocker_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocks_read_own" ON blocks;
CREATE POLICY "blocks_read_own" ON blocks FOR SELECT TO authenticated
  USING (blocker_id = auth.uid());

DROP POLICY IF EXISTS "blocks_insert_own" ON blocks;
CREATE POLICY "blocks_insert_own" ON blocks FOR INSERT TO authenticated
  WITH CHECK (blocker_id = auth.uid());

DROP POLICY IF EXISTS "blocks_delete_own" ON blocks;
CREATE POLICY "blocks_delete_own" ON blocks FOR DELETE TO authenticated
  USING (blocker_id = auth.uid());

-- Reports
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  target_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  post_id uuid REFERENCES posts(id) ON DELETE SET NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('open', 'reviewed', 'actioned', 'dismissed'))
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_insert_own" ON reports;
CREATE POLICY "reports_insert_own" ON reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "reports_read_own" ON reports;
CREATE POLICY "reports_read_own" ON reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

-- Bookmarks
CREATE TABLE IF NOT EXISTS bookmarks (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bm_read_own" ON bookmarks;
CREATE POLICY "bm_read_own" ON bookmarks FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "bm_insert_own" ON bookmarks;
CREATE POLICY "bm_insert_own" ON bookmarks FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "bm_delete_own" ON bookmarks;
CREATE POLICY "bm_delete_own" ON bookmarks FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Reposts
CREATE TABLE IF NOT EXISTS reposts (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

ALTER TABLE reposts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reposts_read_all" ON reposts;
CREATE POLICY "reposts_read_all" ON reposts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "reposts_insert_own" ON reposts;
CREATE POLICY "reposts_insert_own" ON reposts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "reposts_delete_own" ON reposts;
CREATE POLICY "reposts_delete_own" ON reposts FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Stories (24h ephemeral)
CREATE TABLE IF NOT EXISTS stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image',
  caption text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  CHECK (media_type IN ('image', 'video'))
);

ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stories_read" ON stories;
CREATE POLICY "stories_read" ON stories FOR SELECT TO authenticated
  USING (expires_at > now());

DROP POLICY IF EXISTS "stories_insert_own" ON stories;
CREATE POLICY "stories_insert_own" ON stories FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "stories_delete_own" ON stories;
CREATE POLICY "stories_delete_own" ON stories FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS story_views (
  story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id)
);

ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sv_read" ON story_views;
CREATE POLICY "sv_read" ON story_views FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "sv_insert" ON story_views;
CREATE POLICY "sv_insert" ON story_views FOR INSERT TO authenticated
  WITH CHECK (viewer_id = auth.uid());

-- Live streams (metadata; actual media is client/WebRTC placeholder)
CREATE TABLE IF NOT EXISTS live_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Live',
  status text NOT NULL DEFAULT 'live',
  viewer_count int NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  CHECK (status IN ('live', 'ended'))
);

ALTER TABLE live_streams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_read" ON live_streams;
CREATE POLICY "live_read" ON live_streams FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "live_insert" ON live_streams;
CREATE POLICY "live_insert" ON live_streams FOR INSERT TO authenticated
  WITH CHECK (host_id = auth.uid());

DROP POLICY IF EXISTS "live_update" ON live_streams;
CREATE POLICY "live_update" ON live_streams FOR UPDATE TO authenticated
  USING (host_id = auth.uid());

-- Posts: soft moderation flag
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_flagged boolean NOT NULL DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_visibility_check') THEN
    ALTER TABLE posts ADD CONSTRAINT posts_visibility_check
      CHECK (visibility IN ('public', 'followers', 'close_friends'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stories_user_expires ON stories(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

NOTIFY pgrst, 'reload schema';
