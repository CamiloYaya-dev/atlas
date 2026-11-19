-- NOVZI: renombramiento transaccional del esquema de autenticación y su función de auditoría.
-- Esta migración se agrega; NUNCA editar las migraciones 001-014 aplicadas.
-- No borra usuarios, sesiones, proyectos ni exportaciones.
DO $$
BEGIN
 IF to_regclass('public.atlas_users') IS NOT NULL AND to_regclass('public.novzi_users') IS NULL THEN
  ALTER TABLE public.atlas_users RENAME TO novzi_users;
 ELSIF to_regclass('public.novzi_users') IS NULL THEN
  RAISE EXCEPTION 'No existe tabla de usuarios esperada para renombramiento NOVZI';
 END IF;
 IF to_regclass('public.atlas_sessions') IS NOT NULL AND to_regclass('public.novzi_sessions') IS NULL THEN
  ALTER TABLE public.atlas_sessions RENAME TO novzi_sessions;
 ELSIF to_regclass('public.novzi_sessions') IS NULL THEN
  RAISE EXCEPTION 'No existe tabla de sesiones esperada para renombramiento NOVZI';
 END IF;
 IF to_regclass('public.atlas_sessions_user') IS NOT NULL AND to_regclass('public.novzi_sessions_user') IS NULL THEN
  ALTER INDEX public.atlas_sessions_user RENAME TO novzi_sessions_user;
 END IF;
 IF to_regclass('public.atlas_sessions_active') IS NOT NULL AND to_regclass('public.novzi_sessions_active') IS NULL THEN
  ALTER INDEX public.atlas_sessions_active RENAME TO novzi_sessions_active;
 END IF;
 -- Las restricciones UNIQUE/PRIMARY KEY crean índices cuyos nombres no se
 -- actualizan automáticamente al renombrar una tabla en PostgreSQL.
 IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='atlas_users_pkey'
   AND conrelid='public.novzi_users'::regclass) THEN
  ALTER TABLE public.novzi_users RENAME CONSTRAINT atlas_users_pkey TO novzi_users_pkey;
 END IF;
 IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='atlas_users_email_key'
   AND conrelid='public.novzi_users'::regclass) THEN
  ALTER TABLE public.novzi_users RENAME CONSTRAINT atlas_users_email_key TO novzi_users_email_key;
 END IF;
 IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='atlas_sessions_pkey'
   AND conrelid='public.novzi_sessions'::regclass) THEN
  ALTER TABLE public.novzi_sessions RENAME CONSTRAINT atlas_sessions_pkey TO novzi_sessions_pkey;
 END IF;
 IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='atlas_sessions_token_hash_key'
   AND conrelid='public.novzi_sessions'::regclass) THEN
  ALTER TABLE public.novzi_sessions RENAME CONSTRAINT atlas_sessions_token_hash_key TO novzi_sessions_token_hash_key;
 END IF;
 IF to_regprocedure('public.atlas_export_audit_append_only()') IS NOT NULL
    AND to_regprocedure('public.novzi_export_audit_append_only()') IS NULL THEN
  ALTER FUNCTION public.atlas_export_audit_append_only() RENAME TO novzi_export_audit_append_only;
 END IF;
END $$;
