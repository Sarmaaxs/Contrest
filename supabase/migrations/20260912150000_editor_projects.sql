-- Contrest Studio project foundation.
CREATE TABLE IF NOT EXISTS editor_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Untitled project',
  project jsonb NOT NULL DEFAULT '{"version":1,"duration":0,"tracks":[]}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT editor_projects_name_length CHECK (char_length(name) BETWEEN 1 AND 120)
);

ALTER TABLE editor_projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS editor_projects_own_select ON editor_projects;
CREATE POLICY editor_projects_own_select ON editor_projects FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS editor_projects_own_insert ON editor_projects;
CREATE POLICY editor_projects_own_insert ON editor_projects FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS editor_projects_own_update ON editor_projects;
CREATE POLICY editor_projects_own_update ON editor_projects FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS editor_projects_own_delete ON editor_projects;
CREATE POLICY editor_projects_own_delete ON editor_projects FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS editor_projects_user_updated_idx ON editor_projects(user_id, updated_at DESC);

CREATE OR REPLACE FUNCTION public.set_editor_project_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS editor_projects_updated_at ON editor_projects;
CREATE TRIGGER editor_projects_updated_at BEFORE UPDATE ON editor_projects FOR EACH ROW EXECUTE FUNCTION public.set_editor_project_updated_at();
