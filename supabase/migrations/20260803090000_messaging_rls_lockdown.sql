ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_conv_member(conv_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_members
    WHERE conversation_id = conv_id
      AND user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_conv_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_conv_member(uuid) TO authenticated;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('conversations', 'conversation_members', 'messages')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

CREATE POLICY "conversations_select_member" ON public.conversations
  FOR SELECT TO authenticated
  USING (public.is_conv_member(id));

CREATE POLICY "conversations_insert_auth" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "conversation_members_select_own_or_member" ON public.conversation_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_conv_member(conversation_id));

CREATE POLICY "conversation_members_insert_auth" ON public.conversation_members
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "conversation_members_delete_own" ON public.conversation_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "messages_select_member" ON public.messages
  FOR SELECT TO authenticated
  USING (public.is_conv_member(conversation_id));

CREATE POLICY "messages_insert_member" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_conv_member(conversation_id));

CREATE POLICY "messages_update_own" ON public.messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid());

DROP FUNCTION IF EXISTS public.start_dm(uuid);

CREATE FUNCTION public.start_dm(other_user_id uuid)
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

  SELECT cm1.conversation_id INTO existing
  FROM public.conversation_members cm1
  JOIN public.conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
  WHERE cm1.user_id = me AND cm2.user_id = other_user_id
  LIMIT 1;

  IF existing IS NOT NULL THEN
    RETURN existing;
  END IF;

  INSERT INTO public.conversations DEFAULT VALUES RETURNING id INTO conv_id;
  INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (conv_id, me);
  INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (conv_id, other_user_id);
  RETURN conv_id;
END;
$$;

ALTER FUNCTION public.start_dm(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.start_dm(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_dm(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
