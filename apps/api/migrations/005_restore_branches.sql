-- ATLAS V4.8.1: reversible, reviewable restoration proposals. History remains immutable.
CREATE TABLE project_restore_branches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 source_version integer NOT NULL CHECK(source_version > 0),
 base_version integer NOT NULL CHECK(base_version > 0),
 created_by uuid NOT NULL,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','applied','discarded')),
 created_at timestamptz NOT NULL DEFAULT now(),
 resolved_at timestamptz,
 FOREIGN KEY(project_id,source_version) REFERENCES project_document_versions(project_id,version),
 FOREIGN KEY(project_id,base_version) REFERENCES project_document_versions(project_id,version)
);
CREATE INDEX idx_restore_branches_by_project ON project_restore_branches(project_id,created_at DESC);
