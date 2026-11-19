-- NOVZI: autorización explícita por diagramas sin alterar documentos ni versiones anteriores.
-- Los miembros históricos conservan el alcance completo que ya tenían.
ALTER TABLE project_members
 ADD COLUMN IF NOT EXISTS diagram_scope text NOT NULL DEFAULT 'all'
 CHECK (diagram_scope IN ('all','selected'));
CREATE TABLE IF NOT EXISTS project_diagram_grants (
 project_id uuid NOT NULL,
 user_id uuid NOT NULL,
 diagram_id text NOT NULL CHECK(length(diagram_id) BETWEEN 1 AND 150),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,user_id,diagram_id),
 FOREIGN KEY(project_id,user_id) REFERENCES project_members(project_id,user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_project_diagram_grants_user
 ON project_diagram_grants(user_id,project_id);
