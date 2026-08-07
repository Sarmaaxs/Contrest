/*
# Algorithm signals, notifications, hashtags, mute, close friends
*/

-- Not interested / hide author
CREATE TABLE IF NOT EXISTS not_interested (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  author_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (post_id IS NOT NULL OR author_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ni_post ON not_interested(user_id, post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ni_author ON not_interested(user_id, author_id) WHERE author_id IS NOT NULL;
ALTER TABLE not_interested ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ni_own" ON not_interested;
CREATE POLICY "ni_own" ON not_interested FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Keyword mutes (hide posts whose caption matches)
CREATE TABLE IF NOT EXISTS muted_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE muted_keywords ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mk_own" ON muted_keywords;
CREATE POLICY "mk_own" ON muted_keywords FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Close friends list
CREATE TABLE IF NOT EXISTS close_friends (
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, friend_id),
  CHECK (owner_id <> friend_id)
);
ALTER TABLE close_friends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cf_own" ON close_friends;
CREATE POLICY "cf_own" ON close_friends FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  type text NOT NULL,
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  message text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_read" ON notifications;
CREATE POLICY "notif_read" ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notif_update" ON notifications;
CREATE POLICY "notif_update" ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notif_insert" ON notifications;
CREATE POLICY "notif_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, created_at DESC);

-- Hashtags extracted into array on posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS hashtags text[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_posts_hashtags ON posts USING GIN (hashtags);

-- Profile interests (optional self-tags for soft ranking)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interests text[] NOT NULL DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status_text text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status_emoji text;

-- Engagement signals for ranking (optional denormalized)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS like_count int NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS comment_count int NOT NULL DEFAULT 0;

NOTIFY pgrst, 'reload schema';
