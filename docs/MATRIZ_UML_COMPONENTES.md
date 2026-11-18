# NOVZI v4.8.1 — Matriz UML componentes · Auditoría 4 — reentrega verificada

Base exacta: `novzi(20261116-235431).zip` (idéntica byte por byte a `novzi(20261116-233953).zip`, SHA-256 `77ab8852ca74047329b1074ee636b5e4498fd0d5665219c1f0fc8e8b48e3d456`). Se integró el parche de auditoría 3 (31 archivos, SHA-256 `4f2b02bfeb00bc4ba2c26f3c9335d8746284ec18780b6c78c44c5f36fd864c13`) en una nueva extracción, sin modificar los demás archivos fuente de la base. Se repitieron las pruebas desde esa raíz. Referencias: `NOVZI_Refactor_Integral_UML_Componentes.pdf` (CMP-01–09/T01–09) y tercera auditoría. Todos los requisitos funcionales originales siguen siendo P0. No se ejecutó QA integral ni cobertura global.

## Hallazgos

| Hallazgo | Corrección y evidencia | Estado |
|---|---|---|
| AUD-CMP-001–006 | Pruebas y negativos originales conservados; política API pura y contratos verdes. | Sin regresiones detectadas |
| AUD-CMP-008 | Tipo, multiplicidad, contrato efectivo/conjugación y ascendencia de puertos redefinidos; selector y rollback conservados. | Corregido en capas comprobadas |
| AUD-CMP-009 | Valor inicial discriminado literal/referencia/expresión, texto histórico y avisos, revalidación y remapeo conservados. | Corregido en capas comprobadas |
| AUD-CMP-010 | `componentConnectorAssociationIssues` obtiene tipo del `roleId`; `partWithPortId` sigue limitado al contexto/propiedad. Validación ordenada por memberEnd, conformidad transitiva por ID, multiplicidades explícitas y default 1, incluidas las propiedades binarias que respaldan los extremos n-arios. Rechaza discrepancias de orden/tipo/multiplicidad de las apariciones de asociación; advierte si el tipo de un puerto todavía no está definido. Reutiliza `classEndProperties`. | Corregido en capas comprobadas |
| AUD-CMP-007 | Camino verificado de reutilización y edición estructural de registro sin apariciones: seleccionar extremos, reutilizar registro existente, guardar aparición, editar asociación o multiplicidad sin cambiar IDs. El diálogo conserva orden de extremos adicionales, propone coincidencias inequívocas y exige selección explícita si faltan o son ambiguas. Reparación de relación histórica mediante selección explícita probada. | Avance funcional; no certificación exhaustiva |

## Reproducciones exactas de AUD-CMP-010

- A: negativo `qa/uml-component-negative/24-aud-cmp-010-tipo-de-parte.json`: asociación entre Api y Repo, conector entre puertos IRepo. Antes de tipificar, el documento pasa alta y actualización por política. Con `associationTypeId`, se rechaza con `connector-association` / `Número o tipos de extremos no coinciden con la asociación`, tanto alta, actualización e importación completa por política.
- B: positivo `qa/NOVZI_QA_UML_COMPONENTES_ASOCIACION.json`: asociación reflexiva IRepo–IRepo en vista de clases. Alta, modificación e importación completa por política aceptadas, forma y semántica válidas.
- Controles: asociación directa de partes de tipos Api y Repo válida; invertir sus extremos semánticos incompatibles invalida el conector. Prueba previa de multiplicidad preservada, ahora con memberEnd del tipo del puerto correcto. Caso n-ario con tres memberEnd, multiplicidad de tercer extremo y compatibilidad de campos binarios. Especialización transitiva por ID; cambio indirecto de tipo de puerto y rollback. Tipo no declarado produce advertencia, no una confirmación de conformidad. Importación aislada sin dependencia externa se rechaza (importar proyecto completo), sin inventar ni borrar asociación.
- UI: aviso en borrador via política compartida, rechazo al guardar sin perder borrador; reutilizar conector n-ario sin aparición y editar tercer extremo conserva todos sus IDs. No se modifican permisos, límites API ni BD.

## Matriz original P0

| CMP / grupo | Implementación / evidencia ejecutada | Límites de alcance o verificación |
|---|---|---|
| CMP-01 / T01–02 | Catálogo común, inicialización discriminada, redefiniciones por tipo/multiplicidad/conjugación, contratos heredados y procedencia. Pruebas anteriores conservadas. | No se crea ProtocolStateMachine ni catálogo nuevo; el modelo actual no tiene entidad de protocolo diferenciada. Recepciones específicas no acreditadas en el modelo; no afirmar cobertura. Probar variantes del inspector en instalación real. |
| CMP-02 / T03 | Cableado externo con cliente y contratos explícitos, derivación simple e inversión visual independiente; UI de dirección y rollback verde. | Variantes complejas de cadenas heredadas y exportación oficial no certificadas exhaustivamente. |
| CMP-03 / T02–04 | Conformidad transitiva por IDs, firma, multiplicidad, conjugación, redefinición y procedencia; advertencias si faltan datos verificables. | No acreditadas todas las combinaciones de realizadores múltiples y redefiniciones de features. No se introduce evaluador ni se inventan características. |
| CMP-04 / T04 | Conectores internos con contexto heredado, owner, roles/puertos, identidad de extremos, n-arios y asociación tipificadora ordenada por tipo de roleId. A/B, partes directas, n-ario, multiplicidad, especialización y rollback verdes. | Paridad canvas interactivo y variantes de rutas, ACL y pruebas reales aún pendientes. Variantes adicionales no evaluadas exhaustivamente. |
| CMP-05 / T05–07 | Catálogo global, metadatos y eliminación explícita sin aparición; flujo comprobado de alta de aparición reutilizando registro y edición estructural posterior (asociación y multiplicidad). Selección ordenada, conflictos y confirmaciones conservadas. Reparación puntual de legacy mediante reutilización autorizada. | La edición estructural requiere una aparición compatible, no un segundo editor. Reparación de todas las variantes históricas ambiguas no certificada; no migrar por nombre ni resolver automáticamente. |
| CMP-06 / T07–08 | Alta, PUT, importación por política, preservación de IDs y rollback. Se conserva política ACL, remapeo, versiones y ramas. Importación completa del fixture de asociación aceptada; aislada sin vista/ficha externa autorizada rechazada, sin modificación parcial. | HTTP/PostgreSQL real, ACL por campo, restore/merge y concurrencia de esta entrega no ejecutados; el log anterior aprobó HTTP/DB de auditoría 1 y no se extrapola. No acreditado importar de forma aislada toda variante de asociación externa presente en destino. |
| CMP-07 / T05 | UI de diálogo de asociación muestra diagnósticos por política compartida; controla el orden de adicionales y reutiliza extremos por rol+parte; 8 comprobaciones React/jsdom aisladas. Geometría previa conservada. | Puntero/teclado, resize, autosave/recarga, undo y paridad real aún requieren QA local. |
| CMP-08 / T09 | Etiquetas SVG con halo blanco y texto oscuro separado (para rasterizadores sin soporte de paint-order). Seis SVG generados desde exportador, analizados como XML; cuatro PNG diagnósticos. Inspección visual del autocontenido; contraste mejorado, algunos rótulos pequeños o próximos a elementos por geometría del fixture. | No certifica descargas oficiales PNG/PDF/SVG/JSON ni paridad real de los formatos y permisos. |
| CMP-09 / T01–09 | 109/109 específicas, 3/3 grafo, 1/1 smoke y 8/8 UI aisladas. TypeScript API/Web y listado del runner exit 0. 3 positivos, 24 negativos. Regresión ampliada 364/365. | Runner oficial bloqueado en Linux por esbuild Windows/Linux, Rollup Linux ausente y Docker ENOENT. Conservar fallo preexistente de actividades. |

## Evidencia real y comandos

Ruta `qa/uml-component-evidence/auditoria-4/` (ejecución nueva; se conserva también el historial de auditoría 3). Ejecución diagnóstica en Node 22.16.0, mediante `transpileModule` y dependencias JavaScript de la copia auditada; enlaces locales de workspaces reconstruidos para Linux. Variables ficticias de configuración API (`NODE_ENV=test`, `DATABASE_URL=postgresql://qa:qa@127.0.0.1:5432/novzi_test`, `NOVZI_CSRF_SECRET=diagnostic-only-not-production-1234567890`); sin conexión a DB. No incluir configuración ni dependencias en entrega.

| Comando o prueba | Resultado | Evidencia |
|---|---:|---|
| `npm run typecheck` | exit 0 | `typecheck.txt` |
| `npm run qa:uml:componentes -- --list` | exit 0 | `runner-list.txt` |
| `npm run qa:uml:componentes` | exit 1, entorno; grafo OK | `runner-oficial.txt` |
| `node --experimental-loader ./qa/uml-component-evidence/auditoria-4/diagnostic-loader.mjs --test packages/contracts/src/uml-component-policy.unit.test.ts apps/api/src/domain/uml-component-persistence.unit.test.ts` | 109/109 | `contratos-api-pura.tap` |
| `node --test --test-name-pattern='UML componentes\|UML clases, objetos\|ensamblaje UML' scripts/graph-regression.cjs` | 3/3 | `grafo.tap` |
| Node test + loader, `--test-name-pattern='\[uml-component\]' apps/api/src/domain/uml-scoped.unit.test.ts` | 1/1 | `smoke.tap` |
| Node test + loader, regresiones de clases, actividades, casos de uso, secuencia, calidad e importación | 364/365 | `regresion-dirigida.tap` |
| Node + loader, script `diagnostic-ui.mjs` | 8/8 | `ui-aislada.txt` |
| Node + loader, `diagnostic-export.mjs` y análisis XML/CairoSVG | 3 fixtures positivos, 6 SVG, 4 PNG diagnósticos | `fixtures-export.txt` |

Total focalizado Node 113/113; con React/jsdom aislado 121/121. No sumar individualmente los 24 JSON negativos incluidos en las 109 pruebas. El positivo nuevo se verifica adicionalmente, sin contabilizar un segundo conjunto de tests. Regresión histórica `uml-activity/control-flow/uml-action/uml-object-node` (true !== false) permanece sin cambios; registrar para certificación final.

El JSON manual de una sola vista se mantiene intacto (30 fichas, 32 nodos, 20 aristas). El caso tipificado requiere otra vista de clases, por eso se entrega como fixture multivista separado y no como fixture manual autocontenido. El positivo original multivista se conserva (28 fichas, 2 vistas); nuevo positivo (29 fichas, 3 vistas). Todos pasan forma, semántica y alta pura. Se conservan 23 negativos y se agrega un negativo exacto.

## Instalación y verificación

Descomprimir el ZIP incremental sobre la raíz real de NOVZI (la que contiene `package.json`, `apps/` y `packages/`), sin carpeta contenedora adicional. No contiene dependencias ni migraciones. Ejecutar `node scripts/verify-component-audit4.mjs` para comprobar los hashes de los archivos de la entrega e identificar una instalación antigua antes de comprimirla. El ZIP de fuente completa alternativo contiene la carpeta `novzi/` y está destinado a auditoría o a una instalación limpia; excluye dependencias, configuración privada, respaldos, historial Git y artefactos generados de cobertura/compilación. No sustituir la instalación local completa ni sus datos por este ZIP. Ejecutar `npm run typecheck`, `npm run qa:uml:componentes -- --list`, `npm run qa:uml:componentes`. Importar el JSON manual como diagrama, y el fixture de asociación como proyecto de QA independiente (incluye vista de clases; reemplazar únicamente un proyecto de prueba).

**Dictamen:** AUD-CMP-010 corregido en las capas ejecutadas, AUD-CMP-001–006/008–009 sin regresiones detectadas. AUD-CMP-007: flujo de reutilización estructural y reparación puntual acreditados; permanecen límites de funcionalidad/probatorio descritos en la matriz. No declarar cierre integral ni QA local real verde sin ejecutar. No exigir cobertura 90 % ni QA integral durante esta etapa.


## Auditoría 4: evidencia de integración y reproducción independiente de fixtures nuevos

- Se ejecutó `reproduccion-aud-cmp-010.mjs` sobre una copia fresca del JSON base, aplicando literalmente las mutaciones A/B de la auditoría 3 (sin cargar los fixtures A/B ya generados). A: estructura válida; `connector-association` en el registro `rel-internal-assembly`; alta, actualización e importación de proyecto rechazadas por la razón esperada. B: estructura válida, cero issues; las tres operaciones aceptadas. Log: `qa/uml-component-evidence/auditoria-4/reproduccion-aud-cmp-010.txt`, exit 0. No contabilizado dentro de las 121 pruebas.
- El nuevo ZIP de fuente y el incremental deben contener `componentConnectorAssociationIssues`, que usa `doc.elements[end.roleId]`. Se verifica la presencia de los cambios y ausencia del acceso incorrecto al resolver tipos, además de los hashes por archivo.
- Nueva ejecución: 109/109 contratos/API pura, grafo 3/3, smoke 1/1, UI aislada 8/8, typecheck exit 0, lista exit 0. Regresión 364/365 (mismo defecto histórico). Runner oficial exit 1 por binarios nativos y Docker ausente. Tres fixtures positivos sin issues, seis SVG XML válidos, cuatro PNG diagnósticos; no se certifica UI real, HTTP/PostgreSQL ni descargas oficiales de esta versión.
- AUD-CMP-007 se mantiene abierto en los aspectos funcionales y de verificación que la matriz detalla. No declarar cierre integral ni comenzar despliegue por el resultado de esta reentrega.
