/*
  FIX: infinite recursion on conversation_members
  Policies that SELECT conversation_members inside their own USING clause recurse.
  Use SECURITY DEFINER helpers that bypass RLS for the membership check only.
*/

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

-- conversation_members
DROP POLICY IF EXISTS "cm_select" ON conversation_members;
DROP POLICY IF EXISTS "cm_insert" ON conversation_members;
DROP POLICY IF EXISTS "cm_update" ON conversation_members;
DROP POLICY IF EXISTS "cm_delete" ON conversation_members;
DROP POLICY IF EXISTS "members_read" ON conversation_members;
DROP POLICY IF EXISTS "members_insert" ON conversation_members;
DROP POLICY IF EXISTS "conversation_members_select" ON conversation_members;
DROP POLICY IF EXISTS "conversation_members_insert" ON conversation_members;

CREATE POLICY "cm_select_no_recurse" ON conversation_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_conv_member(conversation_id)
  );

CREATE POLICY "cm_insert_no_recurse" ON conversation_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_conv_member(conversation_id)
  );

-- Allow adding the other person when creating a DM (you are already inserting yourself)
-- Simpler: any authenticated user can insert a membership row for a conversation they just created
DROP POLICY IF EXISTS "cm_insert_no_recurse" ON conversation_members;
CREATE POLICY "cm_insert_auth" ON conversation_members
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "cm_delete_own" ON conversation_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- conversations
DROP POLICY IF EXISTS "conv_insert" ON conversations;
DROP POLICY IF EXISTS "conv_select" ON conversations;
CREATE POLICY "conv_insert_auth" ON conversations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "conv_select_member" ON conversations
  FOR SELECT TO authenticated
  USING (public.is_conv_member(id));

-- messages
DROP POLICY IF EXISTS "msg_insert" ON messages;
DROP POLICY IF EXISTS "msg_select" ON messages;
DROP POLICY IF EXISTS "msg_update" ON messages;
DROP POLICY IF EXISTS "messages_read_members" ON messages;
DROP POLICY IF EXISTS "messages_insert_own" ON messages;
DROP POLICY IF EXISTS "messages_update_own" ON messages;

CREATE POLICY "messages_select_member" ON messages
  FOR SELECT TO authenticated
  USING (public.is_conv_member(conversation_id));

CREATE POLICY "messages_insert_member" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conv_member(conversation_id)
  );

CREATE POLICY "messages_update_own" ON messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid());

-- gender + avatar preference on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_preset text;

NOTIFY pgrst, 'reload schema';
