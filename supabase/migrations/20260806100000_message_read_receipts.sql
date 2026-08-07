/*
  Telegram-style read receipts on messages.
  - read_at null  => delivered / not seen yet (1 check)
  - read_at set   => recipient opened the chat (2 checks)
*/

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_messages_unread
  ON public.messages (conversation_id, read_at)
  WHERE read_at IS NULL;

-- Recipient can mark others' messages as read
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

NOTIFY pgrst, 'reload schema';

