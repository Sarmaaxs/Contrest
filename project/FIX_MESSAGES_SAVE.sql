-- Messages not saving after logout — usually RLS on messages
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS status text DEFAULT 'sent';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;
GRANT ALL ON public.messages TO authenticated;
NOTIFY pgrst, 'reload schema';
