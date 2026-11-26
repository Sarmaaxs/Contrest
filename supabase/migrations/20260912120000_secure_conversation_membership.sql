/*
# Close conversation_members authorization gap

Problem:
  conversation_members_insert_auth was `WITH CHECK (auth.uid() IS NOT NULL)`.
  That lets ANY authenticated user insert a row with ANY conversation_id and
  ANY user_id — i.e. add themselves (or force-add someone else) into a
  conversation they have no relationship to, and via is_conv_member() that
  row then unlocks read/write access to every message in that thread.

Fix:
  1. Direct table INSERT is restricted to inserting your own membership row
     only (user_id = auth.uid()). This still lets start_dm() work because
     that function is SECURITY DEFINER and bypasses RLS internally — but a
     client can no longer add someone else's user_id via a raw insert.
  2. Adding OTHER people (group invites) now requires the new
     add_group_members() function below, which is SECURITY DEFINER but
     validates — inside the function, not trusting any client-supplied
     flag — that the caller is already a member of the conversation before
     it's allowed to add anyone else to it. Outsiders who aren't already in
     the conversation cannot add themselves or anyone else to it this way.

No existing table structure changes; existing conversations/messages rows
and the working start_dm() 1:1-DM path are untouched.
*/

-- 1. Lock down direct inserts to "you may only ever insert your own row"
DROP POLICY IF EXISTS "conversation_members_insert_auth" ON public.conversation_members;
DROP POLICY IF EXISTS "cm_insert_auth" ON public.conversation_members;

CREATE POLICY "conversation_members_insert_self_only" ON public.conversation_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 2. Secure RPC for adding other members to a group. Caller must already be
--    a member of the conversation — enforced server-side, not via any value
--    the client sends.
DROP FUNCTION IF EXISTS public.add_group_members(uuid, uuid[]);

CREATE FUNCTION public.add_group_members(conversation_id uuid, member_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  target uuid;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF conversation_id IS NULL OR member_ids IS NULL THEN
    RAISE EXCEPTION 'conversation_id and member_ids are required';
  END IF;

  -- Authorization check happens here, server-side — never trust that the
  -- caller is allowed just because they supplied a conversation_id.
  IF NOT public.is_conv_member(conversation_id) THEN
    RAISE EXCEPTION 'not authorized to add members to this conversation';
  END IF;

  FOREACH target IN ARRAY member_ids LOOP
    IF target IS NOT NULL AND target <> me THEN
      INSERT INTO public.conversation_members (conversation_id, user_id)
      VALUES (conversation_id, target)
      ON CONFLICT (conversation_id, user_id) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

ALTER FUNCTION public.add_group_members(uuid, uuid[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.add_group_members(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_group_members(uuid, uuid[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
