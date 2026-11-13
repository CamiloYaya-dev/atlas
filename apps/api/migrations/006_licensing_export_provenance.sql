-- ATLAS licensing v1: no se modifica el contrato del documento ni las migraciones anteriores.
-- Los permisos de acceso siguen siendo independientes de los derechos comerciales.
CREATE TABLE IF NOT EXISTS workspace_licenses (
  workspace_id uuid PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  plan_code text NOT NULL CHECK (plan_code IN ('free','pro','enterprise')),
  status text NOT NULL CHECK (status IN ('active','revoked','expired')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  features jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(features)='object'),
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_workspace_licenses_status ON workspace_licenses(status,ends_at);
-- Registro histórico de procedencia; no depende del proyecto, que puede eliminarse.
CREATE TABLE IF NOT EXISTS export_audit_logs (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL,
  diagram_id text NOT NULL,
  actor_id uuid NOT NULL,
  document_version integer NOT NULL CHECK (document_version >= 1),
  format text NOT NULL CHECK (format IN ('png','jpg')),
  plan_code text NOT NULL,
  license_active boolean NOT NULL,
  watermark_applied boolean NOT NULL,
  image_sha256 char(64) NOT NULL,
  signature char(64) NOT NULL,
  file_bytes integer NOT NULL CHECK (file_bytes > 0),
  created_at timestamptz NOT NULL,
  CHECK (length(diagram_id) <= 150)
);
CREATE INDEX IF NOT EXISTS idx_export_audit_org ON export_audit_logs(workspace_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_audit_project ON export_audit_logs(project_id,created_at DESC);
-- Auditoría de las concesiones en audit_events; solo el administrador de plataforma puede cambiarlas.

-- Solo INSERT: conservar evidencia tras una revocación y evitar reescrituras accidentales.
CREATE OR REPLACE FUNCTION atlas_export_audit_append_only() RETURNS trigger AS $$
BEGIN
 RAISE EXCEPTION 'Historial de exportaciones inmutable';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_export_audit_append_only ON export_audit_logs;
CREATE TRIGGER trg_export_audit_append_only BEFORE UPDATE OR DELETE ON export_audit_logs
 FOR EACH ROW EXECUTE FUNCTION atlas_export_audit_append_only();
