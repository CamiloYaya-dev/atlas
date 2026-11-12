# Historial de entregas

## Hotfix — typecheck de Fastify (11/11/2026)
- Corrige `TS18046` en `apps/api/src/server.ts` (errores recibidos como `unknown`).
- Conserva status HTTP y mensajes seguros sin exponer errores internos.
- No modifica migraciones ni datos de PostgreSQL.
- Prueba pendiente: typecheck de todo el monorepo con `node_modules` instalados en Windows.

## 4.1.0 — estructura y ambientes
- Conserva editor navegable V3 y V4.
- Frontend: módulos de API por dominio y hook de grafo extraído.
- Backend: controladores, servicios y repositorios por contexto.
- CORS seguro por ambiente, rate limiting, readiness, TLS obligatorio en PROD.
- `002_document_history.sql`: versiones históricas en transacción.
- SQL migrator con lock y checksum; soporta `MIGRATIONS_DATABASE_URL`.
- PostgreSQL Docker LOCAL y QA aisladas; tests; scripts Windows.
- Plan de despliegue concreto Cloudflare Pages + Render + Supabase DEV/PROD.

Limitaciones y pruebas pendientes documentadas en `ESTADO_Y_LIMITACIONES.md`.

## 4.2.1
- Ejecución/depuración centralizadas en npm scripts y utilidades Node multiplataforma.
- Eliminados BAT del paquete; arranque con `npm run dev:all`.
- Bootstrap interactivo con contraseña oculta y sin credenciales por defecto.
