-- NOVZI: control de mantenimientos manuales de datos.
-- La migración NO borra nada; el reinicio requiere un comando manual y un respaldo.
CREATE TABLE IF NOT EXISTS novzi_maintenance_runs (
 action_key text PRIMARY KEY,
 performed_at timestamptz NOT NULL DEFAULT now(),
 accounts_preserved integer NOT NULL CHECK(accounts_preserved >= 0),
 demos_created integer NOT NULL CHECK(demos_created >= 0),
 info jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(info)='object')
);
