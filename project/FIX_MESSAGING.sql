-- ============================================================
-- CONTREST: HARD FIX for "infinite recursion detected in policy
-- for relation conversation_members"
-- Paste ALL of this in Supabase → SQL Editor → Run
-- ============================================================

-- 1) Helper that bypasses RLS (SECURITY DEFINER + postgres owner)
CREATE OR REPLACE FUNCTION public.is_conv_member(conv_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE ok boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_members cm
    WHERE cm.conversation_id = conv_id
      AND cm.user_id = auth.uid()
  ) INTO ok;
  RETURN COALESCE(ok, false);
END;
$$;

ALTER FUNCTION public.is_conv_member(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_conv_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_conv_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conv_member(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_conv_member(uuid) TO service_role;

-- 2) DROP every policy on the three tables (names vary by past migrations)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('conversation_members', 'conversations', 'messages')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- 3) conversation_members — NO self-subqueries (those cause recursion)
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

-- Read: any signed-in user can read membership rows
-- (needed so inbox can resolve the other person's profile)
CREATE POLICY "cm_select_authenticated"
  ON public.conversation_members
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert: any signed-in user can add members (app only adds self + peers in DMs)
CREATE POLICY "cm_insert_authenticated"
  ON public.conversation_members
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Delete: leave a chat (own row only)
CREATE POLICY "cm_delete_own"
  ON public.conversation_members
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- 4) conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conv_select_member"
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (public.is_conv_member(id));

CREATE POLICY "conv_insert_auth"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 5) messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select_member"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (public.is_conv_member(conversation_id));

CREATE POLICY "messages_insert_member"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conv_member(conversation_id)
  );

CREATE POLICY "messages_update_own"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid());

CREATE POLICY "messages_delete_own"
  ON public.messages
  FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid());

-- 6) Extra profile columns (safe if already exist)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_preset text;

-- 7) Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Done. Test: follow someone → Message on profile, or Inbox search → Message.
