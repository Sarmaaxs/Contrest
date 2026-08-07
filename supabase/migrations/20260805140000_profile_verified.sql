/*
  Verified accounts live in Supabase — not in client source.
  Users cannot set is_verified themselves (trigger blocks it).

  CEO / you (SQL Editor as postgres):
    UPDATE public.profiles SET is_verified = true WHERE username = 'your_handle';
    UPDATE public.profiles SET is_verified = false WHERE username = 'someone';
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_verified ON public.profiles (is_verified) WHERE is_verified = true;

-- Block client apps from self-granting the badge
CREATE OR REPLACE FUNCTION public.protect_is_verified()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
    -- authenticated/anon JWT cannot change the flag; SQL Editor (postgres) can
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

NOTIFY pgrst, 'reload schema';

