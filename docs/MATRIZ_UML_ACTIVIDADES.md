# NOVZI 4.8.1 · Actividades UML · Auditoría 2

**Parche incremental; cierre condicionado.** Base reconstruida de los parches acumulados hasta Auditoría 1, no se recibió novzi(8).zip. No se ejecutó QA integral ni se alteraron umbrales o retiraron pruebas. Una Activity por diagrama, schema 1, sin migración SQL nueva. Los pendientes permanecen P0.

## Auditoría 001–008
| ID | Evidencia y cambio | Estado |
|---|---|---|
| 001 | `uml-activity-policy.ts` conformidad de excepciones y salidas del handler; negativo 14, pruebas AUD-ACT-001 preservadas. | Política pura aprobada; HTTP actual pendiente. |
| 002 | Unicidad parámetro/dirección, validación inout, parámetros en borde; negativo 15, AUD-ACT-002 y 007. | Política pura aprobada; manipulación completa pendiente. |
| 003 | Referencias de señal/evento, expresión externa y selector variante; negativo 16 y UI previa. | Pruebas dirigidas aprobadas. |
| 004 | Geometría única de pin, owner, resize/drag mediante comandos; negativo 17. | Política pura aprobada; drag real pendiente. |
| 005 | Parámetros y argumentos tipados, incompatibilidad bloqueada, incompletitud de borrador advertida; negativo 18, fixture borrador. | Pruebas dirigidas aprobadas. |
| 006A | `uml-activity-policy.ts`: propagación única de tipo efectivo con transformaciones sucesivas, estados visitados por origen/arista/tipo/capacidad, exclusión de auxiliar de rutas ordinarias. Firma de decisión consume todas las primarias y auxiliar separado. Pruebas reproducibles exactas Orden→Boolean: firma Orden rechazada, Boolean aceptada; otros casos control intermedio, mergeDecision, ciclo y expresión externa. Negativo 19. | Reproducciones corregidas, contratos/API pura aprobados. |
| 006B | `activityCombinedControl` deriva IDs de ambas fases y arista interna del ámbito local; `import-scope.ts` remapea parámetros raíz, pins y argumentos recursivos. Prueba IMP copia completa, preserva identidades externas y cambia fases internas; JSON roundtrip. No se duplican registros ni se ejecutan expresiones. | Pruebas dirigidas aprobadas; declaración sin efectos del comportamiento no certifica ejecución. |
| 007 | `activityExceptionRoute` compartida entre SVG, `NovziUmlEdge` y `useGraphView`; rayo de excepción dirigido al pin frente a interrupción de flujo por región. Etiqueta de tipos de excepción; prueba SVG y render. Chromium real aislado: 48 cajas + marco, 36 aristas, 0 errores JS; captura junto a SVG, PNG/PDF derivados del SVG con watermark. | Corrección de notación comprobada por pruebas y captura; diferencias de contraste, estilo de cajas/comentarios, etiqueta larga truncada en canvas y legibilidad a zoom. No se certifican descargas oficiales ni paridad exhaustiva. |
| 008 | `document-policy.ts` conserva procedencia de catálogo local de fichas retiradas, proyección ACL por Activity y tipo; `document-commands.ts` reutiliza en mismo ámbito y elimina explícitamente si no referenciada; bloquea retirar referencias auxiliares/pins. `ActivityDetailsEditor` exige rol de histórico ambiguo; conversión señal a enviar/aceptar conserva señal original. `import-scope.ts` remapea parámetros/argumentos locales, fases, pines, regiones/particiones y conserva externas; pruebas AUD-ACT-008 y UI dirigida; nuevo caso HTTP en `uml-scoped.integration.test.ts`. | Política pura/comandos aprobados; clonación mediante Importar diagrama a una Activity nueva (no botón adicional); falta verificar UI completa, restore/merge y ACL reales en HTTP/PostgreSQL. |

## ACT-01–09
| ID | Evidencia por criterio | Estado |
|---|---|---|
| ACT-01 | Contratos de variantes, UI de propiedades, histórico explícito AUD-ACT-008, negativos 10/16. | Dirigido aprobado; reparación en app real pendiente. |
| ACT-02 | Geometría y anclas, pin layout, grafo 9/9, marco/parametros, Chromium aislado. | Manipulación y resize completos pendientes. |
| ACT-03 | Matriz de extremos, comando, selección de relaciones, negativos 01/02/05/13. | Dirigido aprobado. |
| ACT-04 | Grados, auxiliares, fases combinadas y copia, negativos 03/04. | Dirigido aprobado. |
| ACT-05 | Tipos, peso/capacidad, firmas, transformaciones y argumentos, negativos 06/07/09/12/14/15/18/19. | Dirigido aprobado; externos no verificables se advierten. |
| ACT-06 | Eventos, excepciones, particiones/regiones, anotaciones; negativos 08/11/14/16; escena, render. | Dirigido aprobado; UX y legibilidad pendientes. |
| ACT-07 | Política y comandos, alcance de importación, IDs, catálogo y ACL, casos positivos/negativos. | HTTP/DB, restore/merge concurrentes y recorrido completo pendientes. |
| ACT-08 | Captura Chromium real de componentes aislados y escena SVG real; PNG/PDF convertidos, sin handles, marca preservada. | No paridad completa ni prueba de descarga por aplicación. |
| ACT-09 | 159 regresiones unitarias y 16 render dirigido compartido; 9 grafo. | Dirigido aprobado; no se ejecutó QA global. |

## Resultados recientes y reproducibilidad
- Node 22 ESM loader diagnóstico que transpila TypeScript real: 74/74 (64 actividades y 10 importación), 159/159 clases/casos de uso, 1/1 smoke dirigido. Los 19 negativos están incluidos en las pruebas de actividades; no se suman como tests independientes. Sin PostgreSQL.
- TypeScript `node node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json` y `apps/api/tsconfig.json`: ambos exit 0.
- React/jsdom diagnóstico: 8/8 UI dedicada y 16/16 render dirigido (primitivas de React Flow simuladas en test); no Vitest oficial.
- `node --test --test-name-pattern='UML actividades|JSON QA UML actividades|actividad' scripts/graph-regression.cjs`: 9/9. Fixture histórico reconstruido en entrega anterior, no original del 14.
- Fixture positivo: 62 fichas, 57 ocurrencias, 38 aristas, 5 actividades, shape true, issues [], owner autorizada/proyectada. El nuevo comportamiento Convertir tiene apariciones de entrada/salida. Se mantuvieron las mutaciones de los 18 negativos anteriores sobre la base positiva nueva y se añadió negativo 19. `validate-activity.mjs` valida owner y los 19 rechazos de alta; suite API pura comprueba negativos de modificación también.
- SVG real generado por `renderDiagramSVG(doc,d,true)` para las cinco vistas; principal 3185×2312. PNG/PDF derivados con CairoSVG; se inspeccionó principal y PDF renderizado. Captura Chromium con React/ReactFlow reales, `useGraphView`, `NovziNode`, `NovziUmlEdge` y CSS reales; montaje diagnóstico de producción por empaquetador CommonJS local, no sesión de la aplicación ni endpoints. Log y fuentes del montaje en evidencia. No se evaluó interacción de arrastre/edición en Chromium.
- `npm run qa:uml:actividades`: exit 1. Grafo OK; binarios esbuild/tsx de Windows, Rollup Linux ausente, `spawnSync docker ENOENT`. No se certifican Vitest oficial ni HTTP/PostgreSQL, restauración o merge concurrentes de la versión actual. Ejecutar en instalación local del usuario. No se atribuyen resultados de versiones anteriores.
