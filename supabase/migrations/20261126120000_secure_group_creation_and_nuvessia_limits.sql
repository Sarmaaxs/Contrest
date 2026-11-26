-- Secure group creation and durable Nuvessia rate limiting.
CREATE OR REPLACE FUNCTION public.create_group_conversation(member_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE me uuid := auth.uid(); conv_id uuid; requested_count integer;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF member_ids IS NULL THEN RAISE EXCEPTION 'member_ids are required'; END IF;
  SELECT count(DISTINCT member_id) INTO requested_count FROM unnest(member_ids) AS members(member_id)
   WHERE member_id IS NOT NULL AND member_id <> me;
  IF requested_count < 1 OR requested_count > 49 THEN
    RAISE EXCEPTION 'a group must contain between 2 and 50 people';
  END IF;
  INSERT INTO public.conversations DEFAULT VALUES RETURNING id INTO conv_id;
  INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (conv_id, me);
  INSERT INTO public.conversation_members (conversation_id, user_id)
  SELECT conv_id, member_id FROM (SELECT DISTINCT unnest(member_ids) AS member_id) AS requested
   WHERE member_id IS NOT NULL AND member_id <> me;
  RETURN conv_id;
END;
$$;
ALTER FUNCTION public.create_group_conversation(uuid[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_group_conversation(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_group_conversation(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_group_members(conversation_id uuid, member_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE me uuid := auth.uid(); current_count integer; new_count integer; target uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF conversation_id IS NULL OR member_ids IS NULL THEN
    RAISE EXCEPTION 'conversation_id and member_ids are required';
  END IF;
  IF NOT public.is_conv_member(conversation_id) THEN
    RAISE EXCEPTION 'not authorized to add members to this conversation';
  END IF;
  -- Serialize membership-size checks so simultaneous invites cannot exceed the cap.
  PERFORM pg_advisory_xact_lock(hashtextextended(conversation_id::text, 0));
  SELECT count(*) INTO current_count FROM public.conversation_members
   WHERE conversation_id = add_group_members.conversation_id;
  SELECT count(DISTINCT candidate_id) INTO new_count FROM unnest(member_ids) AS candidates(candidate_id)
   WHERE candidate_id IS NOT NULL AND candidate_id <> me
     AND NOT EXISTS (SELECT 1 FROM public.conversation_members existing
       WHERE existing.conversation_id = add_group_members.conversation_id
         AND existing.user_id = candidate_id);
  IF current_count + new_count > 50 THEN
    RAISE EXCEPTION 'groups cannot contain more than 50 people';
  END IF;
  FOREACH target IN ARRAY member_ids LOOP
    IF target IS NOT NULL AND target <> me THEN
      INSERT INTO public.conversation_members (conversation_id, user_id)
      VALUES (conversation_id, target) ON CONFLICT (conversation_id, user_id) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;
ALTER FUNCTION public.add_group_members(uuid, uuid[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.add_group_members(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_group_members(uuid, uuid[]) TO authenticated;

CREATE TABLE IF NOT EXISTS public.nuvessia_rate_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count >= 0)
);
ALTER TABLE public.nuvessia_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.nuvessia_rate_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_nuvessia_rate_limit(
  p_max_requests integer DEFAULT 20, p_window_seconds integer DEFAULT 60
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE me uuid := auth.uid(); now_at timestamptz := clock_timestamp(); current_count integer;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_max_requests IS NULL OR p_max_requests < 1 OR p_max_requests > 100
     OR p_window_seconds IS NULL OR p_window_seconds < 1 OR p_window_seconds > 3600 THEN
    RAISE EXCEPTION 'invalid rate limit settings';
  END IF;
  INSERT INTO public.nuvessia_rate_limits AS limits (user_id, window_started_at, request_count)
  VALUES (me, now_at, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET window_started_at = CASE
          WHEN limits.window_started_at <= now_at - make_interval(secs => p_window_seconds)
          THEN now_at ELSE limits.window_started_at END,
        request_count = CASE
          WHEN limits.window_started_at <= now_at - make_interval(secs => p_window_seconds)
          THEN 1 ELSE limits.request_count + 1 END
  RETURNING request_count INTO current_count;
  RETURN current_count <= p_max_requests;
END;
$$;
ALTER FUNCTION public.consume_nuvessia_rate_limit(integer, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.consume_nuvessia_rate_limit(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_nuvessia_rate_limit(integer, integer) TO authenticated;
NOTIFY pgrst, 'reload schema';
