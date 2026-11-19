-- NOVZI 4.8.1: organizaciones reales y directorio privado; migración NO destructiva.
-- Conserva usuarios, sesiones, espacios, proyectos, documentos, AS-IS y versiones.
CREATE TABLE IF NOT EXISTS organizations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 120),
 created_by uuid NOT NULL REFERENCES novzi_users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS organization_members (
 organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES novzi_users(id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN ('owner','admin','member')),
 joined_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id,organization_id);
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_workspaces_organization ON workspaces(organization_id);
CREATE TABLE IF NOT EXISTS organization_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 email text NOT NULL CHECK(email=lower(email)),
 role text NOT NULL CHECK(role IN ('admin','member')),
 invited_by uuid NOT NULL REFERENCES novzi_users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
 accepted_at timestamptz,
 declined_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_org_invitation_email ON organization_invitations(email,expires_at) WHERE accepted_at IS NULL AND declined_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_invitation_pending ON organization_invitations(organization_id,email) WHERE accepted_at IS NULL AND declined_at IS NULL;

-- Un espacio legado se convierte en una organización independiente. No se mezclan
-- espacios de diferentes empresas basándose solamente en la cuenta creadora.
DO $$
DECLARE w record; org_id uuid; org_owner uuid;
BEGIN
 FOR w IN SELECT id,name,created_by FROM workspaces WHERE organization_id IS NULL ORDER BY created_at LOOP
  SELECT wm.user_id INTO org_owner FROM workspace_members wm JOIN novzi_users u ON u.id=wm.user_id
   WHERE wm.workspace_id=w.id ORDER BY (wm.role='owner') DESC,(wm.user_id=w.created_by) DESC LIMIT 1;
  IF org_owner IS NULL THEN
   SELECT id INTO org_owner FROM novzi_users WHERE id=w.created_by;
  END IF;
  IF org_owner IS NULL THEN
   RAISE EXCEPTION 'Espacio % sin usuario válido para migración: conservar datos y corregir antes de continuar',w.id;
  END IF;
  INSERT INTO organizations(name,created_by) VALUES ('Organización · '||left(w.name,100),org_owner) RETURNING id INTO org_id;
  INSERT INTO organization_members(organization_id,user_id,role) VALUES(org_id,org_owner,'owner');
  INSERT INTO organization_members(organization_id,user_id,role)
   SELECT org_id,wm.user_id,CASE WHEN wm.role='admin' THEN 'admin' ELSE 'member' END
   FROM workspace_members wm JOIN novzi_users u ON u.id=wm.user_id
   WHERE wm.workspace_id=w.id AND wm.user_id<>org_owner
   ON CONFLICT DO NOTHING;
  UPDATE workspaces SET organization_id=org_id WHERE id=w.id;
 END LOOP;
END $$;
