# Operación local y resolución de errores — ATLAS V4.2

**Arranque** `npm run dev:all`: npm install → Docker/PostgreSQL → migraciones 001/002/003 → datos ficticios → bootstrap admin, si falta → typecheck → dev API+web.

## Diagnóstico

| Síntoma | Verificación |
|---|---|
| Error en `db:migrate` | Docker Desktop, puerto 5432, `apps/api/.env`, checksum de migración |
| Error 401 | Login ausente, cuenta suspendida o sesión de 12 horas expirada |
| Error 403 | Permiso granular o CSRF inválido (revisa `X-CSRF-Token`) |
| Error 409 | Versión del documento cambiada; recarga antes de guardar |
| Login rechaza credenciales | Confirma email y clave, administra cuentas desde panel; **no hay usuario default** |
| Error CORS | Configura origen exacto en `CORS_ORIGINS` y `VITE_API_BASE_URL` |
| Error Vite/TypeScript | Ejecuta `npm run check` y remite primer error; no borres datos Docker |

## Backups

`npm run db:backup` solo para desarrollo. Producción requiere copias automáticas, retención, cifrado, pruebas de restauración y controles de acceso al backup.

## Pruebas de autorización

Ejecuta `npm run test:policy` y el protocolo de `docs/06_VALIDACION_SEGURIDAD.md`. Aislamiento de DB QA: usar servicio separado del compose.
