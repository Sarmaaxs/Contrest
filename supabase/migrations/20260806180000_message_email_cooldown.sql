/*
  Cooldown log so "Someone sent you a message" emails are not sent on every DM.
  Rule (enforced in edge function):
    - max 1 email per recipient per conversation per 6 hours
    - skip if recipient already has older unread messages in that chat
*/

CREATE TABLE IF NOT EXISTS public.message_email_cooldowns (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

ALTER TABLE public.message_email_cooldowns ENABLE ROW LEVEL SECURITY;
-- No client policies — service role only

NOTIFY pgrst, 'reload schema';

