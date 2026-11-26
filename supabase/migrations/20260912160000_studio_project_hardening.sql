-- Contrest Studio: validate project JSON and keep project payloads bounded.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'editor_projects_project_object') THEN
    ALTER TABLE editor_projects ADD CONSTRAINT editor_projects_project_object CHECK (jsonb_typeof(project) = 'object');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS editor_projects_updated_at_idx
  ON editor_projects(updated_at DESC);

COMMENT ON TABLE editor_projects IS 'Owner-scoped Contrest Studio project documents. Media blobs are kept in Storage; this JSON stores the edit decision list.';
