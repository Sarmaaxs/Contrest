/* Final security/performance hardening for ephemeral stories and hot queries. */

CREATE OR REPLACE FUNCTION public.is_story_owner(p_story_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.stories WHERE id = p_story_id AND user_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.is_story_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_story_owner(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_view_story(p_story_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  owner_id uuid;
  private_account boolean;
BEGIN
  IF me IS NULL OR p_story_id IS NULL THEN RETURN false; END IF;

  SELECT s.user_id, COALESCE(p.is_private, false)
    INTO owner_id, private_account
  FROM public.stories s
  JOIN public.profiles p ON p.id = s.user_id
  WHERE s.id = p_story_id AND s.expires_at > now();

  IF NOT FOUND THEN RETURN false; END IF;
  IF owner_id = me THEN RETURN true; END IF;

  IF EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_id = me AND b.blocked_id = owner_id)
       OR (b.blocker_id = owner_id AND b.blocked_id = me)
  ) THEN RETURN false; END IF;

  IF private_account THEN
    RETURN EXISTS (
      SELECT 1 FROM public.follows f
      WHERE f.follower_id = me AND f.following_id = owner_id
    );
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.can_view_story(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_story(uuid) TO authenticated;

DROP POLICY IF EXISTS "stories_read" ON public.stories;
CREATE POLICY "stories_read_visible" ON public.stories
  FOR SELECT TO authenticated
  USING (public.can_view_story(id));

DROP POLICY IF EXISTS "sv_insert" ON public.story_views;
CREATE POLICY "sv_insert_visible" ON public.story_views
  FOR INSERT TO authenticated
  WITH CHECK (viewer_id = auth.uid() AND public.can_view_story(story_id));

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_created
  ON public.comments(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_likes_user_post
  ON public.likes(user_id, post_id);
CREATE INDEX IF NOT EXISTS idx_posts_visibility_created
  ON public.posts(visibility, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_story_views_story
  ON public.story_views(story_id, viewed_at DESC);

NOTIFY pgrst, 'reload schema';
