/*
  Enforce Contrest post privacy at the database boundary, not only in the UI.
  Without this, a user who knew a post UUID could query a followers-only or
  close-friends post directly through Supabase and bypass the client filter.
*/

CREATE OR REPLACE FUNCTION public.can_view_post(p_post_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  p record;
BEGIN
  IF me IS NULL OR p_post_id IS NULL THEN RETURN false; END IF;

  SELECT posts.id, posts.user_id, posts.visibility, posts.is_flagged, profiles.is_private
    INTO p
  FROM public.posts
  JOIN public.profiles ON profiles.id = posts.user_id
  WHERE posts.id = p_post_id;

  IF NOT FOUND OR p.is_flagged THEN RETURN false; END IF;
  IF p.user_id = me THEN RETURN true; END IF;

  -- A block works in both directions for content visibility.
  IF EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_id = me AND b.blocked_id = p.user_id)
       OR (b.blocker_id = p.user_id AND b.blocked_id = me)
  ) THEN RETURN false; END IF;

  -- Private accounts require an accepted follow relationship.
  IF p.is_private AND NOT EXISTS (
    SELECT 1 FROM public.follows f
    WHERE f.follower_id = me AND f.following_id = p.user_id
  ) THEN RETURN false; END IF;

  IF COALESCE(p.visibility, 'public') = 'followers' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.follows f
      WHERE f.follower_id = me AND f.following_id = p.user_id
    );
  ELSIF COALESCE(p.visibility, 'public') = 'close_friends' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.close_friends cf
      WHERE cf.owner_id = p.user_id AND cf.friend_id = me
    );
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.can_view_post(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_post(uuid) TO authenticated;

DROP POLICY IF EXISTS "posts_read_all" ON public.posts;
DROP POLICY IF EXISTS "posts_read_visible" ON public.posts;
CREATE POLICY "posts_read_visible" ON public.posts
  FOR SELECT TO authenticated
  USING (public.can_view_post(id));

DROP POLICY IF EXISTS "likes_read_all" ON public.likes;
DROP POLICY IF EXISTS "likes_read_visible_posts" ON public.likes;
CREATE POLICY "likes_read_visible_posts" ON public.likes
  FOR SELECT TO authenticated
  USING (public.can_view_post(post_id));

DROP POLICY IF EXISTS "comments_read_all" ON public.comments;
DROP POLICY IF EXISTS "comments_read_visible_posts" ON public.comments;
CREATE POLICY "comments_read_visible_posts" ON public.comments
  FOR SELECT TO authenticated
  USING (public.can_view_post(post_id));

DROP POLICY IF EXISTS "reposts_read_all" ON public.reposts;
DROP POLICY IF EXISTS "reposts_read_visible_posts" ON public.reposts;
CREATE POLICY "reposts_read_visible_posts" ON public.reposts
  FOR SELECT TO authenticated
  USING (public.can_view_post(post_id));

-- Story-view history is private data. Only the viewer and story owner need it.
DROP POLICY IF EXISTS "sv_read" ON public.story_views;
DROP POLICY IF EXISTS "story_views_read_private" ON public.story_views;
CREATE POLICY "story_views_read_private" ON public.story_views
  FOR SELECT TO authenticated
  USING (
    viewer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_views.story_id AND s.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_follows_follower_following
  ON public.follows(follower_id, following_id);
CREATE INDEX IF NOT EXISTS idx_close_friends_owner_friend
  ON public.close_friends(owner_id, friend_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocker_blocked
  ON public.blocks(blocker_id, blocked_id);

NOTIFY pgrst, 'reload schema';
