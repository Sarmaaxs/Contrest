-- =============================================================================
-- CONTREST — ALL-IN-ONE updates (safe to re-run)
-- Paste entire file into: Supabase → SQL Editor → Run
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Background music on posts
-- -----------------------------------------------------------------------------
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS music_url text,
  ADD COLUMN IF NOT EXISTS music_title text,
  ADD COLUMN IF NOT EXISTS music_artist text;

-- -----------------------------------------------------------------------------
-- 2) Verified badge (profiles.is_verified) — clients cannot self-grant
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_verified
  ON public.profiles (is_verified)
  WHERE is_verified = true;

CREATE OR REPLACE FUNCTION public.protect_is_verified()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
    IF coalesce(auth.role(), '') IN ('authenticated', 'anon') THEN
      NEW.is_verified := OLD.is_verified;
    END IF;
  END IF;
  IF TG_OP = 'INSERT' AND coalesce(auth.role(), '') IN ('authenticated', 'anon') THEN
    NEW.is_verified := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_is_verified ON public.profiles;
CREATE TRIGGER trg_protect_is_verified
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_is_verified();

-- CEO / your account — CHANGE THE USERNAME then uncomment:
-- UPDATE public.profiles SET is_verified = true WHERE username = 'your_handle';

-- -----------------------------------------------------------------------------
-- 3) Telegram-style read receipts (1 check / 2 checks)
-- -----------------------------------------------------------------------------
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_messages_unread
  ON public.messages (conversation_id, read_at)
  WHERE read_at IS NULL;

-- Recipient may mark others' messages as read
DROP POLICY IF EXISTS "messages_mark_read" ON public.messages;
CREATE POLICY "messages_mark_read" ON public.messages
  FOR UPDATE TO authenticated
  USING (
    public.is_conv_member(conversation_id)
    AND sender_id <> auth.uid()
  )
  WITH CHECK (
    public.is_conv_member(conversation_id)
  );

-- -----------------------------------------------------------------------------
-- 4) DM email cooldown (optional "Someone sent you a message" — not every msg)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_email_cooldowns (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

ALTER TABLE public.message_email_cooldowns ENABLE ROW LEVEL SECURITY;
-- no client policies — service role / edge function only

-- -----------------------------------------------------------------------------
-- 5) Hashtags helper index (search #tag) if column exists
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'hashtags'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_posts_hashtags ON public.posts USING gin (hashtags);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- Message email rules (edge function):
--   unread >= 24h before send
--   after send + they read  => 1 week cooldown
--   after send + they ignore => 2 weeks cooldown
-- Schedule hourly cron on notify-message-email with body {} (see MESSAGE_EMAIL_CRON.md)

-- Done. Then:
-- 1) Uncomment & run the UPDATE for your verified username (section 2)
-- 2) Auth → Emails → SMTP Settings = Gmail app password (reset OTP)
-- 3) Local .env = VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY only
