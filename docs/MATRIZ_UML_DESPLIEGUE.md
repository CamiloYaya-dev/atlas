# ATLAS 4.8.1 — UML de despliegue · auditoría 2

Base verificada: `atlas(20261117-004757).zip` (59/59 hashes del manifiesto de la iteración 1 antes de editar). Referencias: especificación `ATLAS_Refactor_Integral_UML_Despliegue.pdf`, auditorías 1 y 2. El alcance original sigue siendo P0. Entrega incremental y fuente de auditoría, no certificación global. No se ejecutó QA integral ni cobertura del 90 %.

## Hallazgos

| Hallazgo | Evidencia de esta iteración | Estado |
|---|---|---|
| AUD-DEP-001 | Se conservan pruebas de dominios Natural/UnlimitedNatural, Integer negativo y valor `"*"`. | Sin regresión detectada. |
| AUD-DEP-002 | Se conservan cardinalidad, tipos, referencias y advertencias; unicidad completada en AUD-DEP-007. | Reproducciones anteriores y nuevas aprobadas por contrato y política pura. |
| AUD-DEP-003 | Validación de referencias a UML Type. | Sin regresión detectada. |
| AUD-DEP-004 | Validaciones de metatipo sin discriminante y reparación explícita de legado. | Sin regresión detectada. |
| AUD-DEP-005 | IDs, orden, proyección, inversión y ramas de CommunicationPath. | Sin regresión detectada. |
| AUD-DEP-006 | Se añaden pruebas de ACL de slots tipados, fusión de cambios válidos que juntos son inválidos, conflicto de colección, destino Artifact-instance y configuración de instancia de ExecutionEnvironment. Se revisa SVG y se separan cajas del fixture nuevo. | Avance verificado; pendientes funcionales/visuales y recorridos de integración que figuran abajo. No se declara cierre exhaustivo. |
| AUD-DEP-007 | `deploymentSlotAtomKey` en `uml-deployment-policy.ts`: claves por discriminante, ID del elemento, tipo/literal o tipo/valor. Rechazo `slot-multiplicity` y HTTP 400 de política pura. Cuatro JSON negativos (27–30), controles positivos, rollback, UI con mensaje y reintento, merge. | Corregido en las capas verificadas. HTTP real pendiente. |

## Matriz de alcance DEP-01–09

| Grupo | Evidencias y comportamiento | Pendiente o limitación |
|---|---|---|
| DEP-01 Catálogo | Pruebas AUD-DEP-001–004/007: dominios, multiplicidades, unicidad semántica, referencias por ID, preservación de escalares históricos. Inspector muestra error semántico y no llama al guardado si el candidato es inválido. Valores tipados muestran cadenas entre comillas, diferenciándolas de números. Las advertencias de tipo/dominio desconocido permanecen; no se infieren tipos de usuario. | Alta/edición interactiva de todas las variantes y características avanzadas no acreditada exhaustivamente; dominios de usuario no descritos permanecen inconclusos. |
| DEP-02 Notación | Se conserva geometría compartida de contorno cubo, anclajes y prueba específica de cuatro lados. Se amplían dos cajas en el nuevo fixture y separan de sus vecinas; no se alteran los JSON anteriores. | Texto largo, iconos tecnológicos opcionales, resize/zoom, capas y recortes requieren revisión funcional/visual en canvas; no se declara resuelto el comportamiento exhaustivo de etiquetas. |
| DEP-03 Matriz | Se conservan pruebas de tipos/nivel, paths binarios/n-arios, inversión, anotación y hotfix 400/403, legado. | Recorridos UI/HTTP de todas las parejas y reparación desde canvas pendientes de certificación. |
| DEP-04 Deployment | Regresión de múltiples artefactos/destinos, anidación y eliminación de aparición. Prueba nueva de destino Artifact-instance y persistencia/importación por política pura. | Varias apariciones, drag/drop y rollback real pendientes de recorridos interactivos. La evidencia de política no equivale a E2E. |
| DEP-05 Configuración | Prueba nueva de configuración de instancia de especificación en instancia de ExecutionEnvironment, y rechazo al intentar asociarla con destino Artifact-instance. Se conservan cardinalidad y restricción de Component por location. | Comprobación UI completa de configuración instance-level y advertencia/representación de borrador no acreditada. |
| DEP-06 Manifestación/topología | Se conservan derivación explícita, composición de tipos/instancias, ciclos, n-arios, multiplicidades, paralelas. Sin inferir asignación por proximidad visual. | Escenarios avanzados en navegador y HTTP pendientes; no se ha hecho un nuevo refactor. |
| DEP-07 Identidad/ACL | Prueba ACL: DataType no visible, redacción del tipo y slot dependiente; guardado conserva elementos, registros, aristas y nodos por identidad; escritura de detalle oculto devuelve 403. El merge puro detecta conflicto concurrente y la política bloquea candidatos que combinan cambios válidos en duplicados. Conservación de instantáneas en memoria; se conservan remapeo, importación y edición detached. | La rutina compartida puede reordenar nodos ocultos al reconstruir la lista (no se pierden IDs ni datos); no se cambió en esta iteración. Historial/restauración y ramas reales, duplicación y borrado en navegador no se ejecutaron. |
| DEP-08 Exportación | SVG generado por `renderDiagramSVG` y parseado como XML; PNG diagnóstico CairoSVG del fixture nuevo, 19 elementos/nodos, 18 aristas, 15 registros. Cambios de separación y algunos handles en el fixture. | Aún puede haber cruces de rutas/rótulos; no se certifica paridad de canvas ni descargas autenticadas SVG/PNG/PDF/JSON oficiales. |
| DEP-09 QA | 104/104 específicas; 109/109 componentes; 3/3 grafo; 1/1 smoke; 7/7 UI aislada React/jsdom; typecheck API y Web exit 0; lista exit 0. 30 fixtures negativos incluidos en las específicas. | Runner oficial incompleto por entorno (ver tabla). No se ejecutó HTTP/PostgreSQL ni E2E posterior a este incremento. |

## Decisiones de implementación

- Unicidad por tuplas de átomos validados: `['literal', value]`, `['reference', elementId]`, `['typed', typeId, value]` y `['enumeration', typeId, literalId]`. El JSON de la tupla no depende del orden de claves del objeto original. Los literales de distinto tipo JSON y los discriminantes distintos no se equiparan. La identidad por ID no se confunde con nombre. No se modifica la colección original ni se reordenan sus valores; `unique=false` conserva repeticiones permitidas. Se mantiene cardinalidad y tipo validados independientemente.
- No se modifica esquema de documento, DB, permisos, límites de seguridad, reglas de otros diagramas, ni los 26 negativos y dos positivos anteriores. No migraciones nuevas. Se agrega un tercer JSON positivo autocontenido y cuatro negativos. No se reduce ningún criterio.
- La prueba UI dedicada usa la política compartida y conserva el borrador en caso inválido. La integración HTTP específica conserva sus comprobaciones y añade el mensaje esperado a los cuatro nuevos negativos; **no fue ejecutada con PostgreSQL** en esta entrega.
- Evidencias por separado; se conserva `/qa/uml-*-evidence/` en `.gitignore`. ZIP completo es para auditar, no para reemplazar instalaciones con dependencias y credenciales.

## Ejecuciones de esta iteración

| Comando / mecanismo | Resultado real |
|---|---|
| `npm run typecheck` | exit 0 API y Web (dependencias JS existentes; links locales de workspace restaurados). |
| `npm run qa:uml:despliegue -- --list` | exit 0; detecta las suites. |
| Loader diagnóstico TS `node --loader <loader> --test packages/contracts/src/uml-deployment-policy.unit.test.ts apps/api/src/domain/uml-deployment-persistence.unit.test.ts` | 104/104, Node 22.16.0; configuración ficticia sin red ni DB. Incluye 30 negativos. |
| Loader diagnóstico TS de las dos suites de componentes | 109/109; sin conexión a DB. |
| `node --test --test-name-pattern='despliegue|Despliegue' scripts/graph-regression.cjs` | 3/3. |
| Loader diagnóstico TS, `uml-scoped.unit.test.ts` filtro `[uml-deployment]` | 1/1. |
| React/jsdom y Testing Library, script diagnóstico incluido en paquete de QA | 7/7; no es Vitest oficial ni E2E. |
| `npm run qa:uml:despliegue` | exit 1: contratos/smoke y reglas dedicadas no arrancan por binarios esbuild Windows en Linux; grafo OK; ambas fases UI no arrancan por Rollup; HTTP/DB no arranca por Docker ENOENT. |
| Exportador SVG de aplicación (llamada directa), XML y CairoSVG | SVG/PNG diagnóstico generado; no es descarga oficial. |

Total diagnóstico específico + regresión + UI aislada: 224/224. La auditoría previa documenta 87/87 específicas; las 17 adicionales incluyen 8 pruebas por los 4 fixtures (política y contrato), controles de igualdad, rollback, ACL/merge, configuración/instancias y fixture manual. No se vuelve a sumar el grafo del runner oficial. El fallo histórico de actividades (`uml-quality.unit.test.ts`, action→object-node control-flow) permanece registrado, no se reejecutó ni se modificó en esta iteración. No se atribuye a despliegue.

## Instalación y transición

Aplicar el ZIP incremental sobre la raíz de la base indicada; reemplazar archivos. Ejecutar `node scripts/verify-deployment.mjs`, `npm run typecheck`, `npm run qa:uml:despliegue`. Para auditar, usar directamente el ZIP de fuente completa verificado. Los logs diagnósticos, SVG y PNG se entregan en el paquete QA, no en código. Antes de iniciar certificación conjunta, cerrar los pendientes funcionales originales y ejecutar QA específico local Windows/Docker (incluye 30 negativos, 400 exacto y rollback de versión). No ejecutar QA integral ni gate global durante esta auditoría.
