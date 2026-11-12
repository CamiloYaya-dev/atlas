# Historial ATLAS

## V4.3.0 — Calidad automatizada

- Suite unitaria para editor, diagramas C1-C4, relaciones, fichas, campos, permisos, contraseñas y HTTP.
- Matriz automática por 9 tipos de diagrama, 14 tipos de elemento y 3 tipos de relación.
- Corrección de referencias mutables en documentos filtrados por roles.
- Rechazo de relaciones duplicadas por par origen/destino y de autoconexiones al guardar.
- Extractores puros `document-commands.ts` y `graph-selection.ts` utilizados por el editor React.
- Construcción Fastify separada en `app.ts` para pruebas de API por inyección.
- Pruebas de integración con PostgreSQL QA exclusivo (no BD de desarrollo).
- Playwright para recorridos de login, navegación, edición, políticas y lector.
- Scripts de npm `test:unit`, `test:db`, `test:e2e:local`, `test:full`.
- CI GitHub Actions con dos trabajos: API/BD + navegador.

**Validación:** 84 pruebas unitarias aprobadas localmente con transpilador de evaluación; suite Docker/Chromium no ejecutada todavía. No se declara 100% de cobertura.

---
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

## V4.2.2 — Corrección de crypto.scrypt

- Corrige TS2554 en `apps/api/src/security/password.ts`, sin alterar formato ni parámetros de hashes existentes.
- La promesa utiliza la API callback de Node.js con opciones explícitas.


## 4.3.1 — Reparación de integración y coverage verificable

- Regresión 403 en primer guardado: proyección completa de campos para rol con `field.configure`.
- Test de integración actualizado al esquema de roles con `role_id`.
- Playwright Windows: evita ejecutar `node.exe` mediante cmd.exe.
- c8, reporte agregado HTML/LCOV/JSON y umbral 95 % por archivo en cuatro métricas.
- CI ejecuta la verificación de coverage y conserva los informes.
- No se declara cobertura 95 % alcanzada; requiere ejecutar y ampliar pruebas.

## 4.6.0 — Candidato de cierre V1 funcional (2026-11-12)
- Histórico de diagramas en SVG, diferencias de revisiones y restauración documentada como NUEVA versión con comprobación de concurrencia y permiso de propietario.
- Consulta paginada de `audit_events` con ACL `workspace.audit.view`, interfaz Actividad y metadatos filtrados.
- Renombrado de proyectos con permiso `project.rename` y registro de auditoría.
- Pruebas de tres perfiles QA, sesiones independientes, colaboración SSE y control de información de presencia.
- Restauración `pg_dump -Fc` en bases nuevas, con checksum, validación y recuperación paralela, sin tocar la base activa.
- Control original de cobertura sin modificación; ver `CIERRE_V1_FUNCIONAL.md` para certificación pendiente.

## 4.7.0 — Accesos independientes por espacio y proyecto (piloto)
- Migración incremental `004_project_access.sql` con miembros por proyecto y conservación de accesos previos.
- Proyectos nuevos privados por defecto, roles independientes por proyecto, revocación y ACL en todas las rutas.
- Editar y eliminar proyectos con permisos atómicos; administrar nombre y eliminar espacios vacíos.
- Pantallas de administración, permisos y pruebas de escenarios multiusuario con tres proyectos.
- Endurecimiento de SSE y auditoría ante revocaciones y cambios de roles.

**Candidato a validación**: no declarar QA completo hasta ejecutar `typecheck`, pruebas unitarias, React, PostgreSQL y E2E en Windows.
