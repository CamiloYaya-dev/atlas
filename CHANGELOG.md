## V4.8.1 — Ajustes de área de trabajo y creación en fullscreen (2026-11-12)

- «Ampliar área de trabajo» oculta la cabecera completa (título, descripción, exportar/importar) y la barra de filtros; conserva la barra global del proyecto.
- «Restaurar distribución» aparece dentro del lienzo cuando está ampliado, para que nunca quede oculto el control para volver.
- «Agregar caja» pasa a estar dentro del lienzo, junto al control de pantalla completa, con los mismos permisos de edición.
- El diálogo de creación se muestra dentro del elemento fullscreen mediante React Portal, tanto en pantalla completa nativa como en alternativa CSS.
- Pruebas React y Playwright agregadas; TypeScript API/web y 5 pruebas Chromium de distribución aprobaron. Falta ejecutar la suite React/Vitest completa en Windows: el runner no inicia aquí por un módulo nativo Linux de Rollup ausente.
- Sin cambios de API, migraciones, base de datos ni modelo de permisos.

## V4.8.1 — Hotfix del layout del editor (2026-11-12)

- Reparado CSS Grid al ocultar sidebar: el `main` pasaba a columna de 0px y se mostraba pantalla gris.
- Botones de menú y ampliación con restauración coherente y estados accesibles.
- Nuevas pruebas React y 3 pruebas Chromium de layout desktop/móvil; el CSS original falló y el corregido pasó en Chromium.
- Sin migraciones, sin cambios de API ni de permisos. TypeScript verificado; QA completa en Windows pendiente.

## 4.8.1 — Restauración revisable, presencia y ergonomía del lienzo

- Restauración íntegra para propietario; ramas de recuperación con resolución de conflictos por campo.
- Protecciones contra restauraciones destructivas con colaboradores conectados.
- Sidebar/minimapa configurables, pantalla completa nativa con fallback.
- Protección contra traducción automática del DOM React y mejoras en diagnóstico.
- Migración aditiva 005_restore_branches.sql; sin dependencias nuevas.

## ATLAS V4.8.0 — Hallazgos de la prueba funcional (12/11/2026)

- Presencia por usuario único, no por pestaña/conexión; caducidad de sesiones SSE.
- Restauración de versiones con modal propio y confirmación explícita, sin ventanas nativas.
- Actividad y auditoría en tabla con filtros parametrizados y paginación por cursor.
- Tipos de visualización con nombres y explicaciones de uso.
- Categorías dinámicas por diagrama para combinar varios contextos en C1/C2/C3/C4 y procesos.
- Compatibilidad de lectura con diagramas anteriores, sin nuevas migraciones.
- Ver [GUIA_V4_8_PRESENCIA_FILTROS_HISTORIAL.md](GUIA_V4_8_PRESENCIA_FILTROS_HISTORIAL.md).

---

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

### V4.8.1 — ATLAS Academy (tutorial interactivo)
- Botón «Aprender ATLAS» en barra superior y barra lateral; guía de 18 pasos orientada a negocio y tecnología.
- Resaltado contextual de controles reales, navegación por temario, ejercicios simulados, cierre y progreso local.
- Tutorial no destructivo y disponible para lectores, proyectos vacíos y móviles; pausa ante modales, soporte fullscreen.
- Pruebas de comportamiento y manual de uso: `docs/TUTORIAL_INTERACTIVO_V4_8_1.md`.

### V4.8.1 — ATLAS Academy: identidad y responsive (2026-11-12)
- Se retiran todos los ejemplos y referencias a un cliente específico de las 18 lecciones y ejercicios; ATLAS se explica mediante su propio ecosistema y casos de uso. No se renombran espacios ni proyectos persistidos.
- Cálculo de posición del panel a partir de su altura real y del control señalado; se mantiene dentro del viewport en pantallas de escritorio.
- Vista inferior centrada para tablet y móvil; cabecera y botones de navegación siempre visibles, y contenido/temario desplazables por separado.
- Pruebas de regresión de identidad y posicionamiento, más verificación en nueve tamaños de Chromium.
- Sin migraciones, sin API adicional y sin modificaciones de ACL o documentos de proyectos.
