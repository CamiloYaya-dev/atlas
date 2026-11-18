# NOVZI 4.8.1 — Auditoría local UML de casos de uso, iteración 2

**Estado: corrección de los dos defectos reproducidos, cierre local aún no certificado.** Base utilizada: árbol acumulado de los parches NOVZI hasta `PATCH_UML_CASOS_DE_USO_CATALOGO`, no el ZIP independiente `novzi(5).zip` citado por la auditoría. Delta incremental. Fecha de ejecución: 16/11/2026. Se conservan los seis diagramas de lanzamiento y el catálogo de cinco tipos creables en casos de uso.

| Hallazgo | Corrección y evidencia actual | Límite |
|---|---|---|
| AUD-UC-001 | Registro semántico `useCaseRelations`, persistencia sin aparición, eliminación explícita y reutilización. Regresión específica aprobada. | HTTP/BD de esta revisión no ejecutados. |
| AUD-UC-002 | Identidad obligatoria de nuevas relaciones, política de escritura, proyección ACL y ciclos sobre registros dormidos. Negativos previos rechazados. | Regresión de política aprobada; merge/restauración reales no ejecutados. |
| AUD-UC-003 | Geometría actor/óvalo, compartimentos, anclas, nota y estereotipo descriptivo. Render React/jsdom y SVG real generado. | No se certifican canvas, hitbox, arrastre/resize ni exportaciones PNG/PDF reales en Chromium. |
| AUD-UC-004 | Sustitución/eliminación de puntos referenciados; regresión de matriz, contratos y UI diagnóstica aprobada. | Falta ejecución local oficial. |
| AUD-UC-005 | Metadato opcional `ModelElement.useCaseCatalog=true` para fichas UML nativas aisladas. Se deriva con el documento completo en servidor al retirar la última aparición, incluso mediante PUT que no lo envía. Se conserva si se recarga y vuelve a reutilizar; se elimina si la ficha queda exclusivamente en otras vistas. UI: acción separada para eliminar definitivamente una ficha no utilizada, con confirmación NOVZI. Se mantienen el mismo elementId y nuevos nodeIds, ACL de vista/tipo, denegaciones de IDs ocultos y protección de referencias. | Reproducción del defecto, altas actor/caso/sujeto, retiro por nodo/selección/vista, recarga simulada por JSON+proyección, reuso, eliminación y ACL aprobados en pruebas. Se añadieron escenarios HTTP reales de importación/PUT/GET/versiones/restauración; pendientes de ejecución. |
| AUD-UC-006 | Para anotación de arista, `target` DEBE coincidir con `source` de la relación anotada. Rechaza nuevas inconsistencias y anclajes no accesibles. Modal bloquea edición auxiliar mientras está ligado a una arista; al retirar anclaje permite anotación de elemento. Adaptación de legado exclusivamente sobre copia almacenada confiable, conservando ID, texto y anclaje; no altera snapshots originales. Retirar tercero conserva nota; retirar relación elimina únicamente su arista de anotación. | Negativos nuevos, comandos, política, UI diagnóstica y fixture aprobados; HTTP PUT/import añadido, no ejecutado aquí. |

## Reglas de compatibilidad y seguridad

- `useCaseCatalog` es una marca de procedencia, no un permiso. Se concede únicamente a actor, caso, sujeto, comentario y restricción. El servidor no acepta el cambio arbitrario de procedencia sobre una ficha preexistente; lo deriva de ocurrencias en el documento completo. Una ficha presente exclusivamente en una vista oculta nunca se añade por esta marca. No se proyecta a quien no tenga permiso `diagram.view.uml-usecase` o `element.view.<tipo>`. No se modifica la ACL existente. La importación explícita de una ficha nueva con procedencia exige permisos de lectura/layout de casos de uso y creación/lectura de su tipo. No requiere migración SQL: JSONB existente.
- La eliminación de última ocurrencia no equivale a la eliminación semántica. El nuevo botón de catálogo solo aparece para fichas nativas aisladas sin referencias visibles y con permiso de eliminación. El backend vuelve a comprobar las referencias completas y rechaza la destrucción no autorizada. Si se retiran las referencias legítimamente, se puede eliminar la ficha después. No se revelan vistas ocultas en los errores.
- Fichas aisladas anteriores al parche, sin procedencia ni referencias semánticas, continúan preservadas en almacenamiento. No se inventa su pertenencia a casos de uso ni se amplía su visibilidad por deducción; recuperar una ocurrencia de una versión autorizada permite volver a establecerla. Las nuevas retiradas sí registran procedencia. Este es un límite explícito para datos históricos sin evidencia.
- Reparación de anotación antigua desalineada: si existe la arista anotada válida y su origen visual, se corrige solo el endpoint redundante y se descarta el handle obsoleto. Se conserva el contenido, ID y referencia a la arista. Se aplica sobre copia de lectura/escritura/restauración de estados almacenados, no a nuevas importaciones arbitrarias; un PUT con la arista histórica estrictamente intacta también se adapta sin sobrescribir la instantánea original. Si el anclaje histórico no existe no se fabrica uno. Merge de ramas adapta los estados históricos antes de fusionar y valida el resultado sin reparar silenciosamente inconsistencias nuevas.

## UC-01–11 / T01–09

| Requisito | Evidencia y estado |
|---|---|
| UC-01/02 · T01 | Catálogo, variantes, flags, datos funcionales y miembros: regresiones de contrato/UI. Estereotipo descriptivo; aplicación formal de perfiles no certificada. |
| UC-03 · T06 | Selector contextual, cancelación, etiquetas fijas y reutilización; nuevo anclaje de anotación con controles coherentes. Pruebas React/jsdom. |
| UC-04 · T02 | Matriz y multiplicidades, contextos, sujetos disjuntos: pruebas unitarias positivas/negativas. |
| UC-05 · T03 | Padre final, identidad, autorrelación y ciclos de proyecto incluso sin aristas: pruebas unitarias. |
| UC-06/07 · T04 | Puntos estables, sustitución, eliminación explícita, nota y condición: pruebas unidad/UI. |
| UC-08 · T05 | Aplicabilidad independiente del layout, preservar sujeto al salir, múltiples ocurrencias: pruebas comandos. Drag/resize real pendiente. |
| UC-09 · T05 | Registro semántico de relación, fichas aisladas con procedencia y reuso, eliminación explícita: nuevas pruebas de política y UI; recarga real HTTP no ejecutada. |
| UC-10 · T07 | Política central, ACL, adaptación legacy y merge simulado. Se agregaron PUT/import/GET/versión/restauración HTTP al test existente; no ejecutados en PostgreSQL aquí. |
| UC-11 · T08 | Exportador SVG ejecutado sobre fixture actualizado; geometría/unidad y render diagnóstico. PNG derivado del SVG para inspección, no exportación PNG/PDF de NOVZI. Sin captura de canvas real. |
| T09 | Regresión dirigida clases 113/113, grafo específico 3/3, componentes y editor. No QA integral ni gate de cobertura global. |

## Resultados ejecutados para esta versión

| Comprobación | Resultado |
|---|---|
| Contratos y política API de casos de uso (dos archivos, Node test runner y cargador TS alternativo) | 46/46, 11 nuevos |
| Smoke dirigido `[uml-usecase]` de `uml-scoped.unit.test.ts` (mismo cargador) | 1/1 |
| Regresión contratos/API clases (tres archivos, mismo cargador) | 113/113 |
| Componentes React/jsdom, archivos reales de prueba del modal, detalles, clase y hook de grafo | 54/54 |
| Comportamiento NovziEditor React/jsdom con simulador XYFlow existente | 7/7 |
| Render UML dirigido React/jsdom | 6/6 |
| Grafo (fase oficial del comando QA) | 3/3 |
| TypeScript web/API | ambos código 0 |
| JSON positivo / política de propietario / proyección / SVG | válido: 20 fichas, 19 nodos, 13 aristas, 12 registros, SVG 1970×2660 |
| Negativos independientes | 8/8 rechazados |
| `npm run qa:uml:casos-de-uso` | código 1: esbuild de Windows, Rollup Linux ausente, Docker ENOENT. Grafo OK. |

Ejecuciones diagnósticas NO equivalen a Vitest oficial, canvas real o PostgreSQL. Registros de ejecución actuales en `EVIDENCIA/`, incluidos cargadores diagnósticos en `EVIDENCIA/herramientas/` (no forman parte del código productivo). Se conservaron las pruebas anteriores. Ningún umbral, gate, script QA integral ni lista de diagramas habilitados fue alterado. No afirmar aprobación hasta completar las fases locales de casos de uso en un entorno compatible.
