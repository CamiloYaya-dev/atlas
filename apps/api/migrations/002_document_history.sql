-- Historial inmutable por proyecto y versión.
CREATE TABLE IF NOT EXISTS project_document_versions (
 project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 version integer NOT NULL CHECK(version>0),
 document jsonb NOT NULL CHECK(jsonb_typeof(document)='object'),
 updated_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (project_id,version)
);
CREATE INDEX IF NOT EXISTS idx_document_versions_recent ON project_document_versions(project_id,version DESC);
-- Backfill idempotente del estado actual. Los cambios futuros registran cada versión nueva.
INSERT INTO project_document_versions(project_id,version,document,updated_by,created_at)
SELECT project_id,version,document,updated_by,updated_at FROM project_documents
ON CONFLICT DO NOTHING;
