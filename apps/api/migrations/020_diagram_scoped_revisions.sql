-- NOVZI: cada diagrama mantiene su propio cursor técnico y sus checkpoints.
-- El documento agregado del proyecto y sus versiones HISTÓRICAS permanecen intactos.
-- Ninguna revisión antigua se borra, renumera ni reescribe.
CREATE TABLE IF NOT EXISTS project_diagram_states (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  diagram_id text NOT NULL CHECK(length(diagram_id) BETWEEN 1 AND 150),
  state_revision bigint NOT NULL DEFAULT 1 CHECK(state_revision > 0),
  changed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id,diagram_id)
);
CREATE TABLE IF NOT EXISTS project_diagram_checkpoints (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  diagram_id text NOT NULL CHECK(length(diagram_id) BETWEEN 1 AND 150),
  version integer NOT NULL CHECK(version > 0),
  snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
  project_cursor integer NOT NULL CHECK(project_cursor > 0),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL CHECK(reason IN ('baseline','automatic','manual','restore')),
  PRIMARY KEY(project_id,diagram_id,version)
);
CREATE INDEX IF NOT EXISTS idx_diagram_checkpoints_recent
 ON project_diagram_checkpoints(project_id,diagram_id,version DESC);
-- Backfill de la instantánea ACTUAL como v1 por diagrama (no recrea historial pasado).
INSERT INTO project_diagram_states(project_id,diagram_id,state_revision,changed_at)
SELECT p.project_id,d.item->>'id',1,p.updated_at
FROM project_documents p CROSS JOIN LATERAL jsonb_array_elements(p.document->'diagrams') AS d(item)
WHERE jsonb_typeof(p.document->'diagrams')='array'
ON CONFLICT DO NOTHING;
INSERT INTO project_diagram_checkpoints(project_id,diagram_id,version,snapshot,project_cursor,created_by,created_at,reason)
SELECT p.project_id,d.item->>'id',1,
  jsonb_build_object(
    'diagram',d.item,
    'elements',COALESCE((
      SELECT jsonb_object_agg(e.key,e.value)
      FROM jsonb_each(COALESCE(p.document->'elements','{}'::jsonb)) AS e(key,value)
      WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements(d.item->'nodes') AS n(item)
        WHERE n.item->>'elementId'=e.key
      )
    ),'{}'::jsonb)
  ),p.version,p.updated_by,p.updated_at,'baseline'
FROM project_documents p CROSS JOIN LATERAL jsonb_array_elements(p.document->'diagrams') AS d(item)
WHERE jsonb_typeof(p.document->'diagrams')='array'
ON CONFLICT DO NOTHING;
