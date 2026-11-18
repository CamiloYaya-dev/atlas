-- ATLAS Gestión funcional v1: hallazgos, RF/RNF, HU, campos, evidencias y plantillas.
-- Todos los recursos están aislados por proyecto. No alteramos el documento de diagramas.
CREATE TABLE functional_sequences (
 project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('finding','rf','rnf','story')),
 last_number integer NOT NULL DEFAULT 0 CHECK(last_number >= 0),
 PRIMARY KEY(project_id,kind)
);
CREATE TABLE functional_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('finding','rf','rnf','story')),
 number integer NOT NULL CHECK(number > 0),
 code text NOT NULL,
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 2 AND 200),
 payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(payload)='object'),
 version integer NOT NULL DEFAULT 1 CHECK(version > 0),
 created_by uuid NOT NULL,
 updated_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(project_id,kind,number),
 UNIQUE(project_id,code),
 UNIQUE(project_id,id)
);
CREATE INDEX idx_functional_items_project ON functional_items(project_id,kind,updated_at DESC);
CREATE TABLE functional_fields (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('finding','rf','rnf','story')),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 100),
 field_type text NOT NULL CHECK(field_type IN ('text','long','number','date','boolean','select','url')),
 required boolean NOT NULL DEFAULT false,
 options jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(options)='array'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(project_id,kind,name)
);
CREATE TABLE functional_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL,
 source_id uuid NOT NULL,
 target_type text NOT NULL CHECK(target_type IN ('record','diagram','node','edge')),
 target_id text NOT NULL CHECK(length(target_id) BETWEEN 1 AND 200),
 diagram_id text CHECK(diagram_id IS NULL OR length(diagram_id) BETWEEN 1 AND 200),
 label text NOT NULL DEFAULT '' CHECK(length(label) <= 200),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(project_id,source_id) REFERENCES functional_items(project_id,id) ON DELETE CASCADE,
 UNIQUE(source_id,target_type,target_id,diagram_id)
);
CREATE INDEX idx_functional_links_project ON functional_links(project_id,source_id);
CREATE UNIQUE INDEX uq_functional_links_target ON functional_links(source_id,target_type,target_id,COALESCE(diagram_id,''));
CREATE TABLE functional_attachments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL,
 item_id uuid NOT NULL,
 file_name text NOT NULL CHECK(length(file_name) BETWEEN 1 AND 200),
 mime_type text NOT NULL,
 file_data bytea NOT NULL CHECK(octet_length(file_data)<=2621440),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(project_id,item_id) REFERENCES functional_items(project_id,id) ON DELETE CASCADE
);
CREATE INDEX idx_functional_attachments_item ON functional_attachments(project_id,item_id);
CREATE TABLE functional_templates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('finding','rf','rnf','story')),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 120),
 paper text NOT NULL DEFAULT 'A4' CHECK(paper IN ('A4','LETTER')),
 orientation text NOT NULL DEFAULT 'portrait' CHECK(orientation IN ('portrait','landscape')),
 layout jsonb NOT NULL CHECK(jsonb_typeof(layout)='array'),
 version integer NOT NULL DEFAULT 1,
 is_default boolean NOT NULL DEFAULT false,
 created_by uuid NOT NULL,
 updated_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(project_id,id)
);
CREATE UNIQUE INDEX functional_template_single_default ON functional_templates(project_id,kind) WHERE is_default;
CREATE INDEX idx_functional_templates_project ON functional_templates(project_id,kind);
-- New capabilities only. Existing policy removals are not reset.
INSERT INTO role_permissions(role_id,permission)
SELECT id,p.permission FROM workspace_roles r
CROSS JOIN (VALUES
 ('functional.read','owner,admin,functional,technical,editor,viewer'),
 ('functional.create','owner,admin,functional,technical,editor'),
 ('functional.edit','owner,admin,functional,technical,editor'),
 ('functional.delete','owner,admin,functional'),
 ('functional.fields.manage','owner,admin,functional'),
 ('functional.templates.manage','owner,admin,functional'),
 ('functional.links.manage','owner,admin,functional,technical,editor'),
 ('functional.export','owner,admin,functional,technical,editor,viewer')
) AS p(permission,role_keys)
WHERE r.role_key=ANY(string_to_array(p.role_keys,','))
ON CONFLICT DO NOTHING;
