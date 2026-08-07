-- ============================================================
-- FINAL DM FIX
-- Root cause: insert().select() on conversations fails because
-- SELECT policy requires membership, but members are added AFTER
-- the insert. Supabase reports that as "violates RLS on conversations".
--
-- Fix: one SECURITY DEFINER function that creates the thread + both
-- members in a single transaction (bypasses RLS safely).
-- ============================================================

CREATE OR REPLACE FUNCTION public.start_dm(other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv_id uuid;
  existing uuid;
  me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF other_user_id IS NULL OR other_user_id = me THEN
    RAISE EXCEPTION 'invalid other user';
  END IF;

  -- Existing 1:1 between me and other?
  SELECT cm1.conversation_id INTO existing
  FROM public.conversation_members cm1
  INNER JOIN public.conversation_members cm2
    ON cm1.conversation_id = cm2.conversation_id
  WHERE cm1.user_id = me
    AND cm2.user_id = other_user_id
  LIMIT 1;

  IF existing IS NOT NULL THEN
    RETURN existing;
  END IF;

  INSERT INTO public.conversations DEFAULT VALUES
  RETURNING id INTO conv_id;

  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (conv_id, me);

  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (conv_id, other_user_id);

  RETURN conv_id;
END;
$$;

ALTER FUNCTION public.start_dm(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.start_dm(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_dm(uuid) TO authenticated;

-- Keep table policies simple (no recursion)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('conversation_members', 'conversations', 'messages')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.is_conv_member(conv_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = conv_id AND user_id = auth.uid()
  );
END;
$$;
ALTER FUNCTION public.is_conv_member(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.is_conv_member(uuid) TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_select" ON public.conversations
  FOR SELECT TO authenticated USING (public.is_conv_member(id));

CREATE POLICY "conversations_insert" ON public.conversations
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "cm_select" ON public.conversation_members
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cm_insert" ON public.conversation_members
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "cm_delete" ON public.conversation_members
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "messages_select" ON public.messages
  FOR SELECT TO authenticated USING (public.is_conv_member(conversation_id));

CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_conv_member(conversation_id));

CREATE POLICY "messages_update" ON public.messages
  FOR UPDATE TO authenticated USING (sender_id = auth.uid());

NOTIFY pgrst, 'reload schema';
