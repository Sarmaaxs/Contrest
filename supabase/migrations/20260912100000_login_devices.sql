/*
  Known-device tracking, for the "new sign-in" security alert — the same
  thing modern account security systems do: alert only when a login comes from a device
  that hasn't been seen before, not on every single login.

  Run in Supabase SQL Editor if not using `supabase db push`.
*/

CREATE TABLE IF NOT EXISTS login_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_hash text NOT NULL,
  user_agent text,
  location_label text,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_hash)
);

ALTER TABLE login_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "login_devices_own" ON login_devices;
CREATE POLICY "login_devices_own" ON login_devices FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_login_devices_user ON login_devices(user_id);

NOTIFY pgrst, 'reload schema';
