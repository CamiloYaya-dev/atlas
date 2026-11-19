-- NOVZI 4.8.2: diagnósticos AS-IS por proyecto y líneas base históricas.
-- Migración ADITIVA: no modifica ningún archivo 001–015 ni borra registros existentes.
ALTER TABLE functional_sequences DROP CONSTRAINT IF EXISTS functional_sequences_kind_check;
ALTER TABLE functional_sequences ADD CONSTRAINT functional_sequences_kind_check CHECK(kind IN ('finding','rf','rnf','story','asis'));
ALTER TABLE functional_items DROP CONSTRAINT IF EXISTS functional_items_kind_check;
ALTER TABLE functional_items ADD CONSTRAINT functional_items_kind_check CHECK(kind IN ('finding','rf','rnf','story','asis'));
ALTER TABLE functional_fields DROP CONSTRAINT IF EXISTS functional_fields_kind_check;
ALTER TABLE functional_fields ADD CONSTRAINT functional_fields_kind_check CHECK(kind IN ('finding','rf','rnf','story','asis'));
ALTER TABLE functional_templates DROP CONSTRAINT IF EXISTS functional_templates_kind_check;
ALTER TABLE functional_templates ADD CONSTRAINT functional_templates_kind_check CHECK(kind IN ('finding','rf','rnf','story','asis'));

ALTER TABLE functional_items ADD COLUMN closed_at timestamptz;
ALTER TABLE functional_items ADD COLUMN closed_by uuid;

CREATE TABLE functional_baselines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 item_id uuid NOT NULL,
 number integer NOT NULL DEFAULT 1,
 item_snapshot jsonb NOT NULL CHECK(jsonb_typeof(item_snapshot)='object'),
 links_snapshot jsonb NOT NULL CHECK(jsonb_typeof(links_snapshot)='array'),
 records_snapshot jsonb NOT NULL CHECK(jsonb_typeof(records_snapshot)='array'),
 fields_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(fields_snapshot)='array'),
 document_snapshot jsonb NOT NULL CHECK(jsonb_typeof(document_snapshot)='object'),
 template_snapshot jsonb,
 project_document_version integer NOT NULL,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (project_id,item_id) REFERENCES functional_items(project_id,id) ON DELETE CASCADE,
 UNIQUE(project_id,item_id,number)
);
CREATE INDEX idx_functional_baselines_item ON functional_baselines(project_id,item_id,created_at DESC);
CREATE TABLE functional_baseline_attachments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 baseline_id uuid NOT NULL REFERENCES functional_baselines(id) ON DELETE CASCADE,
 source_item_id uuid NOT NULL,
 original_attachment_id uuid NOT NULL,
 file_name text NOT NULL,
 mime_type text NOT NULL,
 file_data bytea NOT NULL,
 created_at timestamptz NOT NULL,
 UNIQUE(baseline_id,original_attachment_id)
);
CREATE INDEX idx_functional_baseline_attachments ON functional_baseline_attachments(baseline_id);

-- Protegemos contra escrituras accidentales desde cualquier ruta de la API.
-- La eliminación completa de un proyecto mantiene el comportamiento de cascada.
CREATE FUNCTION novzi_guard_closed_asis() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ref_item_id uuid; ref_project_id uuid;
BEGIN
 IF TG_TABLE_NAME='functional_items' THEN
  ref_item_id := OLD.id; ref_project_id := OLD.project_id;
  IF OLD.kind='asis' AND OLD.closed_at IS NOT NULL THEN
   IF TG_OP='UPDATE' OR EXISTS(SELECT 1 FROM projects WHERE id=ref_project_id) THEN
    RAISE EXCEPTION 'Diagnóstico AS-IS cerrado: su línea base es de solo lectura' USING ERRCODE='23514';
   END IF;
  END IF;
 ELSE
  IF TG_TABLE_NAME='functional_attachments' THEN
   ref_item_id := CASE WHEN TG_OP='INSERT' THEN NEW.item_id ELSE OLD.item_id END;
  ELSE
   ref_item_id := CASE WHEN TG_OP='INSERT' THEN NEW.source_id ELSE OLD.source_id END;
  END IF;
  ref_project_id := CASE WHEN TG_OP='INSERT' THEN NEW.project_id ELSE OLD.project_id END;
  IF EXISTS(SELECT 1 FROM functional_items WHERE project_id=ref_project_id AND id=ref_item_id AND kind='asis' AND closed_at IS NOT NULL)
   AND EXISTS(SELECT 1 FROM projects WHERE id=ref_project_id) THEN
   RAISE EXCEPTION 'Diagnóstico AS-IS cerrado: no se pueden modificar sus vínculos ni evidencias' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER trg_novzi_closed_asis_item BEFORE UPDATE OR DELETE ON functional_items
 FOR EACH ROW EXECUTE FUNCTION novzi_guard_closed_asis();
CREATE TRIGGER trg_novzi_closed_asis_link BEFORE INSERT OR UPDATE OR DELETE ON functional_links
 FOR EACH ROW EXECUTE FUNCTION novzi_guard_closed_asis();
CREATE TRIGGER trg_novzi_closed_asis_attachment BEFORE INSERT OR UPDATE OR DELETE ON functional_attachments
 FOR EACH ROW EXECUTE FUNCTION novzi_guard_closed_asis();

CREATE FUNCTION novzi_guard_asis_baseline() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ref_project_id uuid;
BEGIN
 ref_project_id := CASE WHEN TG_TABLE_NAME='functional_baselines' THEN OLD.project_id
  ELSE (SELECT project_id FROM functional_baselines WHERE id=OLD.baseline_id) END;
 IF TG_OP='UPDATE' OR EXISTS(SELECT 1 FROM projects WHERE id=ref_project_id) THEN
  RAISE EXCEPTION 'La línea base histórica es inmutable' USING ERRCODE='23514';
 END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER trg_novzi_baseline_immutable BEFORE UPDATE OR DELETE ON functional_baselines
 FOR EACH ROW EXECUTE FUNCTION novzi_guard_asis_baseline();
CREATE TRIGGER trg_novzi_baseline_files_immutable BEFORE UPDATE OR DELETE ON functional_baseline_attachments
 FOR EACH ROW EXECUTE FUNCTION novzi_guard_asis_baseline();
