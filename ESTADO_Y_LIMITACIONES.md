# Entrega verificable — qué está y qué no está

## Incluido en el código

- Copia funcional del editor React/C4 V3/V4, grafo React Flow, vistas, inspector, campos y links, JSON import/export.
- Monorepo: `apps/web`, `apps/api`, `packages/contracts` y `packages/fixtures`.
- Backend por dominio y capas Controller/Service/Repository; PostgreSQL Docker LOCAL.
- APIs workspace, proyectos, documentos versionados, invitaciones; JWT Supabase para nube.
- Validación mínima del documento y versión de concurrencia; errores HTTP controlados.
- SQL inicial + migración de historial + auditoría; checksum y lock de migración.
- Infra Docker DEV y QA, tests y GitHub Actions, scripts Windows, smoke test.
- Variables y receta exacta para Cloudflare Pages, Render, Supabase DEV y PROD.

## No comprobado dentro de este entorno de entrega

No hay acceso funcional a Docker Desktop ni a una instancia Supabase tuya. Si `npm install` no puede contactar el registro externo tampoco es posible afirmar que el bundle pasó. El paquete **debe probarse en tu Windows** con `npm run check` y `npm run db:test` antes de declarar un release. No se han aprovisionado DNS ni servicios en nube.

## Pendiente (NO implementado)

- Aislamiento de red total entre Render y Supabase (enrutamiento TLS público, no VPC privada).
- Login y colaboración reales validados con usuarios de tu organización (requiere crear proyectos Supabase).
- Pagos/planes/cuotas, integraciones Jira/Azure, backups automatizados de producción, monitoreo real, alta disponibilidad avanzada.
- Refactor completo del editor visual en componentes atómicos; todavía hay un módulo de edición grande.
- Migración normalizada a tablas por elemento/relación. Actual snapshot versionado funciona para MVP pero no es el esquema final para gran escala.
