-- ATLAS V4.7: workspace membership and project membership are independent.
-- Preserve previous effective access on existing projects, while new projects start private.
ALTER TABLE projects ADD CONSTRAINT projects_id_workspace_unique UNIQUE(id,workspace_id);
CREATE TABLE IF NOT EXISTS project_members (
 project_id uuid NOT NULL,
 workspace_id uuid NOT NULL,
 user_id uuid NOT NULL,
 role_id uuid NOT NULL,
 joined_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,user_id),
 FOREIGN KEY (project_id,workspace_id) REFERENCES projects(id,workspace_id) ON DELETE CASCADE,
 FOREIGN KEY (workspace_id,user_id) REFERENCES workspace_members(workspace_id,user_id) ON DELETE CASCADE,
 FOREIGN KEY (workspace_id,role_id) REFERENCES workspace_roles(workspace_id,id)
);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id,project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_workspace ON project_members(workspace_id,project_id);
-- Existing workspace members retain their effective access to EXISTING projects.
-- Future projects do NOT inherit workspace members automatically.
INSERT INTO project_members(project_id,workspace_id,user_id,role_id)
SELECT p.id,p.workspace_id,m.user_id,CASE WHEN p.created_by=m.user_id THEN owner_role.id ELSE m.role_id END
FROM projects p JOIN workspace_members m ON m.workspace_id=p.workspace_id
JOIN workspace_roles owner_role ON owner_role.workspace_id=p.workspace_id AND owner_role.role_key='owner'
WHERE m.role_id IS NOT NULL ON CONFLICT(project_id,user_id) DO NOTHING;
-- Add only the newly introduced built-in grants to old workspaces.
INSERT INTO role_permissions(role_id,permission)
SELECT r.id,p.permission FROM workspace_roles r
CROSS JOIN (VALUES ('project.delete'),('project.members.manage'),('workspace.rename')) AS p(permission)
WHERE r.role_key IN ('owner','admin') ON CONFLICT DO NOTHING;
INSERT INTO role_permissions(role_id,permission)
SELECT id,'workspace.delete' FROM workspace_roles WHERE role_key='owner' ON CONFLICT DO NOTHING;
