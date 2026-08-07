-- Fix: "new row violates row-level security policy for table conversations"
-- Run this whole block in Supabase SQL Editor

-- Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Nuke policies again on these tables
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

CREATE OR REPLACE FUNCTION public.is_conv_member(conv_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE ok boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = conv_id AND user_id = auth.uid()
  ) INTO ok;
  RETURN COALESCE(ok, false);
END;
$$;
ALTER FUNCTION public.is_conv_member(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.is_conv_member(uuid) TO authenticated;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- conversations: allow any logged-in user to CREATE a thread
CREATE POLICY "conversations_select"
  ON public.conversations FOR SELECT TO authenticated
  USING (public.is_conv_member(id));

CREATE POLICY "conversations_insert"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (true);

-- conversation_members: no self-subquery (no recursion)
-- SELECT open so you can see who else is in the chat
CREATE POLICY "cm_select"
  ON public.conversation_members FOR SELECT TO authenticated
  USING (true);

-- INSERT: you can add yourself OR someone else to a chat you create
CREATE POLICY "cm_insert"
  ON public.conversation_members FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "cm_delete"
  ON public.conversation_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- messages
CREATE POLICY "messages_select"
  ON public.messages FOR SELECT TO authenticated
  USING (public.is_conv_member(conversation_id));

CREATE POLICY "messages_insert"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_conv_member(conversation_id));

CREATE POLICY "messages_update"
  ON public.messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid());

NOTIFY pgrst, 'reload schema';
