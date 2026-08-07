
-- Allow any authenticated user to start conversations & send messages
-- (client still respects "messages from anyone" preference for initiating)

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conv_insert" ON conversations;
CREATE POLICY "conv_insert" ON conversations FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "conv_select" ON conversations;
CREATE POLICY "conv_select" ON conversations FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM conversation_members cm
    WHERE cm.conversation_id = conversations.id AND cm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "cm_insert" ON conversation_members;
CREATE POLICY "cm_insert" ON conversation_members FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "cm_select" ON conversation_members;
CREATE POLICY "cm_select" ON conversation_members FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM conversation_members me
    WHERE me.conversation_id = conversation_members.conversation_id AND me.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "msg_insert" ON messages;
CREATE POLICY "msg_insert" ON messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversation_members cm
      WHERE cm.conversation_id = messages.conversation_id AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "msg_select" ON messages;
CREATE POLICY "msg_select" ON messages FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM conversation_members cm
    WHERE cm.conversation_id = messages.conversation_id AND cm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "msg_update" ON messages;
CREATE POLICY "msg_update" ON messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid());

NOTIFY pgrst, 'reload schema';
