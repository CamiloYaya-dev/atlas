# ATLAS V4 — Alcance congelado y criterios de cierre (piloto cerrado local)

**Decisión:** Posponer PostgreSQL administrado, despliegue DEV y monetización. El piloto corre en una máquina local con PostgreSQL en Docker y túnel HTTP temporal ngrok, sin registro público.

## Funciones obligatorias antes de aprobar V4

| Dominio | Escenarios obligatorios | Nivel mínimo |
|---|---|---|
| Autenticación | Login correcto/incorrecto, logout, sesiones revocadas, bloqueo, sin registro público | Unidad + API + navegador |
| Usuarios | Alta, validaciones, duplicados, suspender/reactivar, no elevar privilegios | API/BD + navegador |
| Espacios | Alta, miembros, cambio de rol, aislamiento multi-tenant | API/BD + navegador |
| Roles y ACL | Acciones atómicas por C1–C4, proceso, componente, relación funcional/técnica/mixta, importación/exportación, ataques directos a API | Unidad + API/BD + navegador |
| Editor | Crear/renombrar/borrar diagrama, nodo, relación, campos, enlaces; recuperar datos después de recargar | Unidad + API/BD + navegador |
| Navegación | C1→C2→C3→C4, procesos, secuencias, datos, trazabilidad; filtros y dependencias | Unidad + navegador |
| Persistencia | Autoguardado, conflicto de versión 409, historial, importación/exportación, recuperación | API/BD + navegador |
| Seguridad del piloto | Cookie, CSRF, CORS, rate limiting, no exponer PostgreSQL ni API aparte, HTTPS en túnel, logs sin contraseñas | API + revisión manual |

## Puerta de aprobación

1. `npm run typecheck` = exit 0.
2. `npm run test:unit` = 100% de pruebas **aprobadas**.
3. `npm run test:ui` = 100% de pruebas **aprobadas**.
4. `npm run test:db` = 100% de pruebas **aprobadas** con PostgreSQL QA aislado.
5. `npm run test:e2e:local` = 100% de escenarios **aprobados**.
6. `npm run test:coverage` genera reportes de backend y frontend separados y consolidados.
7. `npm run coverage:check` exige >=95% en líneas, sentencias, ramas y funciones **globalmente y por archivo**.
8. `npm run build` compila API y web.
9. Revisión manual de permisos con dos usuarios en navegadores/perfiles diferentes; prueba del túnel con usuarios de confianza.

No ocultar líneas sin ejecutar ni excluir módulos para elevar artificialmente el porcentaje. El 95% es una meta, NO un hecho confirmado. 100% de suites aprobadas no implica software libre de defectos.

## Hallazgos del reporte 2026-11-11

- Líneas: 64% (875/1367).
- Sentencias: 64% (875/1367).
- Funciones: 78,33% (94/120).
- Ramas: 81,51% (494/606).
- `apps/web/src/features/editor`, `apps/web/src/features/security`, `apps/web/src/features/editor/hooks` y varios componentes visuales aparecen en 0% porque la medición original solo ejercitaba la parte Node.
- `apps/api/src/db` marca 10,93% de líneas; faltan pruebas de migraciones, seeds, recuperación y manejo de errores.

La medición frontend V4.4 usa Vitest/V8 y el backend usa C8; los resultados se unen y se preservan los informes detallados.

## Estado de aprobación

**Pendiente.** El código de esta entrega agrega infraestructura y pruebas, pero no ha sido ejecutado con las dependencias npm y PostgreSQL de Windows. No declarar la versión lista hasta que `npm run qa:local` concluya en exit 0 y se revise la seguridad del piloto.
