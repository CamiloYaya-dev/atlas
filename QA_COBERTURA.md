# ATLAS 4.3 — Matriz de calidad por comportamiento

## Regla de entrega

Cada historia, error corregido y regla de autorización requiere:
1. Prueba unitaria del comportamiento (incluidos límites y fallos).
2. Prueba HTTP o de base de datos cuando existe persistencia, sesión o permisos.
3. Prueba E2E para el flujo crítico que recorre la interfaz.
4. Evidencia de ejecución en CI (los archivos de prueba por sí solos **no** certifican el producto).
5. Regresión al corregir cualquier error detectado.

## Estado por funcionalidad

| Comportamiento | Unit | API/BD | E2E | Estado |
|---|---|---|---|---|
| Contratos y tipos C1/C2/C3/C4/procesos/otros | ✅ | Parcial: persistencia | Navegación C1/C2 | Cobertura parcial |
| Crear y renombrar diagramas | ✅ | Guardado documento | Crear diagrama | Implementado; requiere CI |
| Borrar diagramas | ✅ | Política y documento versionado | Pendiente específico | Parcial |
| Crear y reutilizar cajas | ✅ | Documento + ACL | Crear caja | Implementado; requiere CI |
| Editar fichas, enlaces, estados y metadatos | ✅ | Documento + ACL | Resumen | Parcial |
| Crear, editar, eliminar relaciones | ✅ | Política con tipos | Pendiente arrastrar conexiones UI | Parcial |
| Mover y quitar cajas | ✅ | ACL de layout | Pendiente interacción drag E2E | Parcial |
| Campos personalizados por tipo | ✅ | Política ACL | Pendiente panel completo E2E | Parcial |
| Vistas funcional/mixta/técnica + grupos | ✅ filtros | Redacción por permisos | Pendiente combinaciones UI | Parcial |
| Login cerrado y logout | Hash + controles | ✅ sesiones, 401, logout | ✅ login válido/inválido | Implementado; requiere CI |
| Crear, bloquear, reactivar usuarios | ✅ contraseñas | ✅ operaciones HTTP | Pendiente panel cuentas | Parcial |
| Roles y permisos atómicos | ✅ matriz por tipo | ✅ CRUD básico y denegación | ✅ apertura panel | Parcial |
| Aislamiento de workspaces/tenants | ✅ redacción | ✅ 2 tenants y lecturas | No aplica directamente | Implementado; requiere CI |
| Importar/exportar | ✅ permisos | ✅ permitido/prohibido | Pendiente archivo UI | Parcial |
| Control de versiones y conflictos | ✅ reglas de modelo | ✅ 409 e historial | Guardado básico | Parcial |
| CSRF/CORS | ✅ cliente HTTP | ✅ 403 HTTP | No aplica | Implementado; requiere CI |
| Contrato completo de Swagger/API | No implementado | No implementado | No implementado | Pendiente del producto |
| Pago y suscripciones | No implementado | No implementado | No implementado | Pendiente del producto |

✅ = existe una prueba que cubre al menos el comportamiento indicado, **no** cobertura exhaustiva de todos sus escenarios.

## Resultados de ejecución

- Pruebas unitarias del motor de documentos, comandos del editor, validadores, claves, filtros, cliente HTTP y permisos: ejecutadas localmente en un entorno auxiliar de evaluación con transpilación TypeScript. **Se verificaron 84 pruebas exitosas tras corregir defectos detectados.**
- Pruebas HTTP/BD con PostgreSQL: el usuario ejecutó 14 pruebas (10 aprobadas y 4 fallidas). V4.3.1 contiene correcciones que deben verificarse.
- Pruebas Playwright con Chromium: descarga completada pero la ejecución falló al invocar Node en ruta Windows con espacios. V4.3.1 incluye corrección pendiente de verificar.
- Typecheck y compilación integrales npm: **pendientes** de ejecución contra dependencias instaladas.
- Cobertura porcentual global: **no medida aún**. V4.3.1 permite generar reportes agregados con c8, ver `QA_COVERAGE_95.md`.

## Objetivos de cobertura

- Regla de negocio y permisos: objetivo >=95% líneas, ramas, funciones y sentencias por archivo.
- Código de producción: objetivo >=95% en las cuatro métricas, con una puerta automatizada.
- Todos los casos de uso críticos: al menos una prueba E2E exitosa, con negativos para autorización.

No convertir estos objetivos en una afirmación de cumplimiento sin un reporte generado por `npm run test:coverage`, CI e integración reales.

## Entornos y datos

- `npm run test:unit`: sin base de datos ni Docker.
- `npm run test:db`: SOLO `atlas_test` en `127.0.0.1:5433`, aislada del volumen de desarrollo; incluye migraciones.
- `npm run test:e2e:local`: levanta QA separada, inyecta credenciales temporales y usa Chromium.
- `npm run test:full`: typecheck, unidades, integración, build y E2E.
- Nunca ejecutar sobre datos de clientes o producción.

## Incidencias detectadas por pruebas

1. La proyección de un documento autorizado compartía referencias mutables con el documento original. Se añadió una clonación profunda al devolver vistas filtradas.
2. El motor no rechazaba pares de relaciones duplicadas dentro de una misma vista. Ahora impide duplicidad y autoconexiones al guardar.
