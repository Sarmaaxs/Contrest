/*
# Auto-create profiles + message scheduling

1. Problem being fixed
   "Could not find the table 'public.profiles' in the schema cache" happens when
   this project's tables were never created in the connected Supabase project
   (or PostgREST's cache hasn't picked them up yet). Run the FULL contents of
   `20260727153230_contrest_schema.sql` first, then this file, in the Supabase
   SQL Editor for project kmktoccugiwjaemcjsfo. If the error still shows up
   afterwards, it's just PostgREST's schema cache being stale — run
   `NOTIFY pgrst, 'reload schema';` at the bottom (included below) or open
   Project Settings -> API -> "Reload schema" in the dashboard.

2. Changes
   - A trigger that creates a `profiles` row automatically the moment someone
     signs up, using the username/full_name passed in signUp's metadata. This
     removes the race condition where the client tried to insert a profile
     row before the session/RLS context was ready.
   - Adds `status` + `scheduled_for` to `messages` so a message can be queued
     to send later ("Send later" feature). Scheduled messages are only
     visible to their sender until they flip to `sent`.
*/

-- 1. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Message scheduling ("send later")
ALTER TABLE messages ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'sent';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_status_check'
  ) THEN
    ALTER TABLE messages ADD CONSTRAINT messages_status_check CHECK (status IN ('sent', 'scheduled'));
  END IF;
END $$;

-- Recipients only see messages that have actually been sent; the sender can
-- still see their own scheduled (not-yet-sent) drafts.
DROP POLICY IF EXISTS "messages_read_members" ON messages;
CREATE POLICY "messages_read_members" ON messages FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM conversation_members cm
      WHERE cm.conversation_id = messages.conversation_id AND cm.user_id = auth.uid()
    )
    AND (status = 'sent' OR sender_id = auth.uid())
  );

-- Sender can update their own message (used to flip a scheduled message to sent)
DROP POLICY IF EXISTS "messages_update_own" ON messages;
CREATE POLICY "messages_update_own" ON messages FOR UPDATE
  TO authenticated USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);

CREATE INDEX IF NOT EXISTS idx_messages_scheduled ON messages(scheduled_for) WHERE status = 'scheduled';

NOTIFY pgrst, 'reload schema';
