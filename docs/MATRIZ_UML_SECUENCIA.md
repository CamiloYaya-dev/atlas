# NOVZI 4.8.1 — Secuencia, auditoría 3
Base: árbol acumulado hasta AUDITORÍA 2 HOTFIX. No se recibió el ZIP independiente `novzi(20261116-212819).zip`. Alcance: únicamente UML de secuencia; no nueva migración, catálogo ni QA integral. Todo pendiente funcional de SEQ-01–13 conserva prioridad P0. El dictamen no sustituye el QA en la instalación real.

## Hallazgos y evidencias
- AUD-SEQ-001–005 y 007–009: se mantienen las 25 fixtures negativas previas y los tests por causa específica. No se reescribe la política anterior.
- AUD-SEQ-006 / consider-ignore: `SequenceSignatureRef` discriminada (`{kind:'operation',ownerId,operationId}` o `{kind:'signal',ownerId}`); dos operaciones del mismo propietario conservan sus IDs. Propietario sin Operation concreta y miembro aislado no se aceptan para una modificación nueva. `signatureIds` histórica de Signal sigue funcionando; propietario histórico ambiguo se conserva como dato y requiere elección explícita (diagnóstico). Opciones y etiquetas por firma en canvas/SVG; `sequenceReferences`, ACL y `import-scope` incorporan dependencias, conservan miembro y remapean propietario. No se infiere operación arbitraria. Pruebas de contrato, UI, alta/actualización/importación y 26–30 negativos.
- Datos de mensaje/ref: `SequenceArgument.values?:string[]` (cuando se usa, `value:'-'` como marcador de compatibilidad), cardinalidad explícita contra multiplicidad UML/Interaction; expresión textual `value` sigue opaca, sin evaluación ni inferencia de cantidad. `assignment` solo en resultados de firma conocida; reply conserva parámetros out/inout/return; ref usa `arguments` para in/inout y `results` para out/inout/return. Ausencia o lista vacía mantiene comodines. UI de valores, retorno y multiplicidad de parámetros raíz; escena comparte etiqueta. Negativos 31–33 y pruebas positivas. No se verifica ejecución de expresiones ni tipo individual de cada expresión de colección, que sigue siendo texto.
- Selección de ocurrencias existentes y confirmación de cambio de MessageSort en formulario; se conservan IDs de ocurrencias elegidas y se validan extremos antes de guardar. Test React/jsdom de cancelación del cambio y conservación de identidad. Cambio de familia/alcance/firma todavía requiere revisión exhaustiva del UX de confirmación; no se amplía alcance a expresiones evaluables.
- Continuaciones: `continuationMatchId` recíproco, nombres y cobertura coincidentes, posiciones opuestas, mismo ámbito de Interaction; editor cambia ambas en el mismo candidato, importación remapea ambas. Sin pareja explícita se advierte. Test contrato/fixture manual. No se infiere pareja por nombre.
- Gate exterior de alt: `matchIds` lista recíproca de gates interiores definidos por `parentOperandId`, uno por operando; duplicado/correspondencia inválida rechazados; rama faltante advertida como borrador. Compatibilidad de sort/firma/dirección y campo histórico matchId preservados. Modificación y proyección ACL, copia por alcance y modalidad antigua probadas; ejemplo manual tres gates enlazados por tres mensajes. Pendiente validar todos los cruces de frontera y variantes de anidación de gates con geometría compleja.
- Adaptación histórica explícita: actor se convierte en lifeline local con referencia a actor compartido original, conserva nodeId y ficha original. Excepción estrecha de política para esa transición, no se habilita sustituir identidades arbitrariamente. Create/delete se convierten cuando inequívocos, Delete usa la ocurrencia de X existente; candidato inválido conserva edge histórico con diagnóstico. Test de snapshot, idempotencia y alta/actualización por política. Campos personalizados de actor permanecen en ficha original, no se copian indiscriminadamente a lifeline. No se inventan firmas/ámbitos ambiguos.
- Recorte por alternativa: `sequenceLifelineSegments` calcula segmento de línea por destrucción/creación en operando alt, preserva ramas restantes; test de X independiente en rama y evento en la otra. Sigue siendo geometría derivada, no simulación de tokens. No se certifican todas las combinaciones de alta/baja condicional anidada.

| SEQ | Implementación y prueba ejecutada | Pendiente concreto P0 o de entorno |
|---|---|---|
| T01 | 11 tipos, roles Property, cabeza actor, Action/Behavior; adaptación actor explícita con identidad preservada. | Variantes adicionales de cabeza según clasificador y reparación explícita de históricos ambiguos no exhaustivas. |
| T02 | Sort/kind, firmas y argumentos, valores estructurados, salida y asignación, elección de ocurrencia, confirmación de cambio de sort. UI 9/9 y unitarias. | Confirmación exhaustiva para cambio de familia/alcance/firma; tipos de expresiones no evaluados. |
| T03 | Orden parcial anterior, límites inclusivos, seq débil/critical, movimiento atómico, hotfix de borrador, recorte alt probado. | Drag/resize de barra resuelta sigue controlado por propiedades de ocurrencias; no se habilita resize geométrico indiscriminado. Reordenamiento avanzado de operandos con mensajes y recorte anidado completo pendientes. |
| T04 | Doce operadores, firmas concretas, gates alt por operando, protección de ámbitos existentes. | Cruces de fronteras arbitrarios y validación física exhaustiva de marcos superpuestos pendientes. |
| T05 | Ref con entradas/salidas/retorno, descomposición/navegación existente sobre DTO, continuaciones explícitas y gates correspondidos; UI y política pura. | Cobertura de las variantes avanzadas de notación temporal y matching de gates en todos los contextos no exhaustiva. |
| T06 | React/jsdom 9/9 dedicada, 5/5 comandos, 5/5 hooks; captura Chromium real aislada de componentes actuales. | Recorrido E2E conectado con puntero/teclado, undo, autosave, recarga y guards completo pendiente. |
| T07 | SVG del exportador real 2006×4160, captura aislada Chromium 39 nodos (38 cajas + marco), 39 aristas, cero errores JS; PNG/PDF auxiliares desde SVG. | No se certifica igualdad visual completa, aún existen diferencias de fondo/presentación, no se ejecutan descargas oficiales PNG/PDF en servidor local. |
| T08 | 102/102 específicas incluidas 33 negativas; alta/actualización/importación por política; remapeo de firmas, resultados, parejas y alt; fixture multivista adicional; adaptación no destructiva e idempotente. | Runner HTTP/PostgreSQL no ejecutable aquí; falta verificación real de rollback, historial, restore, ramas y merge en esta revisión. Caso histórico ambiguo permanece sin inferencia. |
| T09 | 233/233 regresiones de contratos/políticas; grafo 7/7 y smoke 1/1. | No ejecutar QA integral ni cobertura 90 % durante implementación diagramas. |

## Resultados actuales
- `npm run typecheck`: exit 0, ambos módulos. `npm run qa:uml:secuencia -- --list`: exit 0.
- `npm run qa:uml:secuencia`: exit 1. esbuild Windows (`@esbuild/win32-x64`), falta `@rollup/rollup-linux-x64-gnu`, Docker ENOENT. Grafo oficial 7/7. No se declaran aprobadas las otras fases oficiales.
- Diagnóstico con loader ESM TypeScript real y Node test runner: 102/102 específicas (33 negativos incluidos, no sumarlos otra vez), 233/233 regresión y 1/1 smoke. React/jsdom diagnóstico: 9/9 dedicada, 5/5 comandos, 5/5 adaptador de grafo. Sin conexión a DB, no Vitest oficial. Captura Chromium aislada sin backend; no E2E.
- Manual único: 45 fichas, 38 cajas, 39 aristas, 76 ocurrencias, 12 operadores, 11 tipos, 6 sorts, 7 relaciones, tres kinds. Importación individual real por política pura aprobada en secuencia vacía; clases incompatible rechazada. Sin errores semánticos; advertencias explícitas de ref externa, mapeo incompleto, mensajes no tipados. Mantener `qa/NOVZI_QA_UML_SECUENCIA.json` base automatizada; prueba adicional `qa/NOVZI_QA_UML_SECUENCIA_FIRMAS.json` multivista de firmas y resultados. No editar los 25 negativos previos.

## Instalación
Copiar `archivos/` sobre raíz NOVZI. `npm run typecheck`, `npm run qa:uml:secuencia -- --list`, `npm run qa:uml:secuencia`. No requiere migraciones nuevas. Para QA manual usar `Importar diagrama` y el JSON DIAGRAMA_UNICO. El fixture multivista se reserva para QA automatizado de referencias.

La corrección concreta de consider/ignore queda implementada y probada. AUD-SEQ-006 no se declara cerrado en todos los criterios: ver las brechas funcionales concretas y de entorno en tabla. No se rebajan validaciones, ni se elimina test, ni se ejecuta QA integral.


# Incremento — auditoría 4 (16/11/2026)

Base exacta: `novzi(20261116-215859).zip`; contiene hotfix 429 y los 33 negativos anteriores. Las secciones de auditoría 3 son histórico, no resultados de este incremento. Ninguna migración, dependencia ni modificación de producción.

## Cambios y evidencia
- AUD-SEQ-010: política común de geometría absoluta, dimensión de frames compartida con render, solapamiento con ámbito y cobertura común; encaje horizontal y vertical completo de anidación explícita. Coberturas independientes permitidas. Nuevo negativo `34-fragmentos-superpuestos.json` (34 negativos totales). Pruebas de alta, actualización, importación de proyecto, resize/move y rollback por política/contratos; el HTTP oficial consume automáticamente el nuevo fixture. No se desactiva rate limiter.
- AUD-SEQ-011: acción «Ajustar tiempo» sobre activación seleccionada; inicio/fin explícitos y confirmación propia de NOVZI; command atómico conserva IDs y extremos enlazados. Rechaza intervalo invertido, alteración de orden local compatible, movimiento de X, salida de operando, colisión semántica y edición obsoleta de límites. Permite ejecución atómica; no activa resize de la tarjeta. Prueba de merge independiente y conflicto en la misma ocurrencia. React/jsdom aislado valida cancelación y parámetros de acción. Permisos layout/edit/technical. Pendiente recorrido real puntero/teclado, undo/redo y persistencia.
- AUD-SEQ-006: reordenamiento explícito de operandos del mismo conjunto de IDs traslada ocurrencias y nodos por ámbito, con rollback de candidato inválido. No infiere jerarquía. Confirmaciones de cambio de familia/alcance/firma/emisor/receptor/operando en editor de mensajes cuando existen referencias; se conserva borrador al cancelar. Cabeza actor histórica o referenciada y cabeza rectangular, incluidas creaciones condicionales; identificador Lifeline discreto. No se inventan clasificadores ni referencias. Se conservan los 33 negativos previos y los tres JSON positivos sin alterar su contenido.

| Criterio | Estado de este incremento | Pendiente / límite |
|---|---|---|
| T01 | Cabezas actor y rectangular compartidas, identificador Lifeline; adaptación histórica anterior conservada. | Reparación exhaustiva de históricos ambiguos y variantes de clasificador no verificada. |
| T02 | Confirmaciones de familia, alcance, firma, extremos y operandos; cancelación de alcance probada en jsdom. | Confirmación de todos los cambios de ref y correlaciones, casos UI restantes no certificados. |
| T03 | Ajuste temporal explícito y reordenación de operandos con IDs; pruebas de conflicto y rollback. | Recorte de vida en alternativas anidadas complejas, undo/redo conectado y activaciones anidadas en recorrido real pendientes. |
| T04 | AUD-SEQ-010 corregido y probado por contrato y política, con negativo 34, anidación y coberturas independientes. | Cruces de frontera que requieran gates en todos los ámbitos no certificados. |
| T05 | Modelado y validadores previos conservados, regresiones verdes. | Variantes de notación temporal y matching avanzado, pendiente verificación exhaustiva. |
| T06 | Dos nuevas pruebas UI en suite oficial, ambas reproducidas en React/jsdom aislado. | Vitest oficial y QA conectado de puntero/teclado, autosave, undo y recarga pendientes. |
| T07 | Cabezas de participante comparten escena de canvas/SVG; grafo y smoke verdes. | Descargas PNG/PDF oficiales y comparación visual real no ejecutadas. |
| T08 | 109/109 específicas, 34 negativos incluidos, alta/actualización/importación por política. | HTTP/PostgreSQL real no ejecutado (Docker ausente); historial, restore y ramas/merge reales no certificados. |
| T09 | 233/233 regresiones focalizadas, 7/7 grafo y 1/1 smoke. | QA integral y cobertura 90% pospuestos por directriz. |

## Resultados ejecutados en Linux (Node 22.16.0)
- TypeScript directo de API y web: exit 0 ambos. `npm run qa:uml:secuencia -- --list`: exit 0.
- Runner oficial específico: exit 1; tsx/esbuild Windows, Rollup nativo Linux ausente y Docker ENOENT. Grafo oficial 7/7. No extrapolar a fallo de negocio ni declarar certificación.
- Loader diagnóstico TypeScript/transpileModule y Node test runner: 109/109 dedicadas + 233/233 regresión + 1/1 smoke. Sumado al grafo oficial 7/7 = 350 casos de diagnóstico automatizado (los 34 negativos ya incluidos). React/jsdom aislado 2/2 adicionales; no equivalen a Vitest, E2E ni API HTTP real.
- Los tres JSON positivos son válidos por contrato y política (sin errores). El JSON manual es de una sola vista y permanece idéntico al de la iteración 3. Se entrega también por separado.
- Evidencia en `docs/evidencia-secuencia-auditoria-4/`. Para reproducir en instalación Windows: `npm run typecheck`, `npm run qa:uml:secuencia -- --list`, `npm run qa:uml:secuencia`. Si falla únicamente DB, aislar con `npm run qa:uml:secuencia -- --db`.

**Dictamen de desarrollo:** AUD-SEQ-010 corregido en las capas probadas, AUD-SEQ-011 implementado y probado a nivel semántico/UI aislada; ambos pendientes de comprobación en la instalación local. AUD-SEQ-006 parcialmente abierto: no declarar certificación total hasta cerrar pendientes funcionales y realizar QA local. No se ejecutó QA integral ni cobertura global.

# Incremento — auditoría 5 (16/11/2026)

**Base exacta:** `novzi(20261116-222443).zip`, v4.8.1. Referencias: auditoría 5, PDF de refactor original y la matriz anterior. Se trabaja sobre los archivos de la entrega auditada, sin reconstrucción ni cambios de seguridad, migraciones o dependencias. El hotfix 429 de la suite HTTP se conserva. AUD-SEQ-001–005 y 007–011 no se reabren sin evidencia de regresión.

## Correcciones y pruebas nuevas

- **AUD-SEQ-012 — Gate/MessageEnd [0..1].** `sequenceDocumentIssues` cuenta mensajes distintos por aparición local de Gate, no por ID de ocurrencia; aplica para envío y recepción, incluido lost/found, y no cuenta anotaciones, GeneralOrdering ni correspondencias de gates. Se admiten borradores vacíos, un mensaje, edición del mismo ID, gates independientes y `alt` exterior con múltiples correspondencias (un mensaje por gate individual). Error estable `gate-message-count` con nodo y par de mensajes; las colisiones históricas se diagnostican sin borrar relaciones ni asignar automáticamente ocurrencias ambiguas. La comparación de problemas preexistentes permite reparación incremental sin admitir conflictos nuevos. Los comandos de relación y el diálogo usan la política compartida; backend alta, actualización e importación ya consumen la misma política. Se añadió `35-gate-dos-mensajes.json`, reproducción exacta del auditor, con forma válida y único error semántico. Pruebas unitarias de salientes/entrantes/mixtos, lost/found, anotación, reparación de histórico, reconexión, rollback, creación/PUT e importación de proyecto e individual por política. UI React/jsdom: error accesible, no persistencia del intento, borrador intacto y reintento con gate libre.
- **AUD-SEQ-006 / T02:** cambio de correlación `replyToId` e interacción `ref` exige confirmación si hay referencias o argumentos; el editor conserva borrador al cancelar, advierte de reinicio de campos y vuelve a validar las referencias antes de guardar. Confirmaciones propias de NOVZI, sin alert/confirm/prompt nativos. Dos pruebas UI nuevas, reproducidas localmente en React/jsdom aislado. Las confirmaciones de familia, sort, firma y ámbito de la auditoría 4 permanecen intactas.
- **AUD-SEQ-006 / T03:** prueba nueva de recorte y validación en `alt` anidado: destrucción de una rama interna, conservación de la otra rama interna y otra externa, rechazo de evento posterior en trayectoria compatible. Se verifica la escena compartida; no se altera la semántica de orden parcial ni se añade simulación.
- **AUD-SEQ-006 / T04–T05:** nueva prueba de correspondencias formal/actual, inner/outer y `alt` por rama sobre el fixture único, incluyendo nombre, dirección y sort incompatibles. Conservadas las reglas previas de cobertura, ámbitos, firmas y anidación. No se ha añadido una prohibición general de cruces geométricos.
- **AUD-SEQ-006 / T05:** se confirmó además un exceso de ocurrencias de instante/duración que antes se trataba como borrador. Se distingue borrador incompleto (advertencia) de exceso (error `temporal-count`); el editor muestra las referencias excedentes y permite desvincularlas explícitamente sin eliminarlas por un cambio de variante. Pruebas de las cuatro variantes, referencias inexistentes, límites invertidos/negativos y rechazo de exceso; `36-tiempo-exceso-ocurrencias.json` conserva forma válida y un único error semántico; alta/PUT/importación y rollback por política. UI aislada prueba cambiar duración a instante, preservar ambas referencias y corregir expresamente. No se evalúan expresiones arbitrarias ni se añade un motor de simulación.

## Matriz de aceptación T01–T09 de la entrega 5

| Criterio | Evidencia actual (alcance ejecutado) | Estado / pendiente |
|---|---|---|
| T01 | Catálogo de once tipos, cabezas actor/rectangular; pruebas existentes de actor histórico, roles tipados y adaptación. Nueva reproducción de Gate histórico múltiple: conserva IDs/relaciones, adapta independientes, diagnóstico y reparación explícita. | Comprobado por contratos y política para estos casos. No se ha comprobado exhaustivamente cada combinación histórica o forma de clasificador en UI conectada. |
| T02 | Se mantienen sorts, kinds, firmas concretas, argumentos, retornos, elección de ocurrencias y confirmaciones previas. Nuevas confirmaciones de `reply` y `ref` con cancelación (React/jsdom). | Implementación acotada comprobada; recorrido completo de edición/reconexión real y guardado pendiente local. |
| T03 | Ajuste temporal, reordenación de operandos, límites/IDs, merge independiente/conflicto por contrato y nuevo alt anidado; scene clipping en rama interna comprobado. | Casos específicos verdes. No se certifican todas las combinaciones de altas/bajas en alternativas complejas ni undo/redo y concurrencia conectada. |
| T04 | AUD-SEQ-010/011 conservados; overlaps, bounds, jerarquía, operadores; AUD-SEQ-012 cardinalidad; correspondencias alt por rama funcionales. | Verificados los casos nuevos y anteriores; no se certifica toda combinación de cruces de ámbito que exijan gate. No se bloquean simples cruces de rectángulos. |
| T05 | Referencias/ref, gates, continuaciones, coregión, cuatro formas temporales. Nuevas pruebas de matching por nombre, dirección, sort, límites/referencias y cardinalidad temporal. | Casos focalizados comprobados; no se afirma cobertura exhaustiva de toda combinación de firma, coincidencia y ámbito ni render en exportaciones oficiales. |
| T06 | Cuatro casos UI nuevos en suite dedicada: Gate ocupado/reintento, confirmación ref, confirmación reply, cambio temporal con referencia excedente. React/jsdom aislado 4/4. | Vitest oficial bloqueado; interacción real puntero/teclado, edición, undo/redo, autosave y recarga no ejecutados aquí. |
| T07 | Grafo oficial 7/7. Pruebas de escena SVG compartida incluidas en las específicas, incluido recorte anidado. Tres fixtures positivos siguen válidos. | Comparación editor conectado/SVG/PNG/PDF y descargas oficiales no ejecutadas aquí. |
| T08 | 123/123 contratos y persistencia por política; alta/actualización/importación, remapeo, proyección/ACL y rollback de comandos. Se mantienen pruebas de merge por contrato. Runner HTTP incluye automáticamente 36 JSON negativos; conserva reinicio Fastify cada 20 fixtures. | HTTP/PostgreSQL real, rollback de DB, historial, restore y ramas/merge conectado no ejecutados: Docker ausente. No equivalen a política pura. |
| T09 | 233/233 regresiones focalizadas; 7/7 grafo; 1/1 smoke. Se conservan todos los casos auditados en la iteración anterior. | QA integral y cobertura 90 % pospuestos, según directriz. |

## Ejecuciones reales y límites

Entorno Linux, Node v22.16.0. Logs y scripts en `docs/evidencia-secuencia-auditoria-5/`. El diagnóstico alternativo usa el loader ESM y transpileModule de TypeScript del repositorio; no sustituye Vitest ni PostgreSQL.

| Ejecución | Resultado |
|---|---|
| TypeScript directo, API (`tsc -p apps/api/tsconfig.json --noEmit`) | exit 0 |
| TypeScript directo, Web (`tsc -p apps/web/tsconfig.json --noEmit`) | exit 0 |
| `npm run qa:uml:secuencia -- --list` | exit 0 |
| Contratos secuencia y política de persistencia (incluye los 36 negativos) | 123/123 |
| Regresiones contratos/políticas de clases, casos de uso, actividades e importación | 233/233 |
| Grafo específico (runner oficial) | 7/7 |
| Smoke política/contratos dirigido UML secuencia | 1/1 |
| **Total diagnóstico anterior + grafo, sin sumar dos veces los negativos** | **364/364** |
| React/jsdom, 4 casos nuevos con arnés aislado (no Vitest oficial) | 4/4 |
| Validación de los tres fixtures positivos (`isProjectDocument`, `sequenceDocumentIssues`) | 3/3: sin errores |
| `npm run qa:uml:secuencia` | exit 1: esbuild de Windows en Linux, Rollup nativo Linux ausente, Docker ENOENT. Grafo sí aprobado. Las otras fases oficiales no se certifican. |

Los tres fixtures positivos son idénticos byte por byte a la base auditada: `NOVZI_QA_UML_SECUENCIA.json` (3 vistas, 33 fichas), `NOVZI_QA_UML_SECUENCIA_DIAGRAMA_UNICO.json` (1 vista, 45 fichas), `NOVZI_QA_UML_SECUENCIA_FIRMAS.json` (3 vistas, 33 fichas). El manual único ya contiene gates formal/actual, inner/outer, correspondencia alt y las cuatro variantes temporales; no necesita cambios. Los 34 negativos anteriores también se conservan sin modificación; se agregan solo 35 y 36. No se generaron ni sobrescribieron reportes de cobertura. No se ejecutó qa:integral.

## Instalación y QA local de cierre

Descomprimir el ZIP incremental sobre la raíz de NOVZI. No requiere migraciones ni reinstalación de dependencias para aplicar los cambios. Ejecutar `npm run typecheck`, `npm run qa:uml:secuencia -- --list`, `npm run qa:uml:secuencia`. Para aislar una falla HTTP/DB, `npm run qa:uml:secuencia -- --db`. No aceptar HTTP 429 como válido ni desactivar rate limit.

En QA manual importar como diagrama el JSON de una vista. Seleccionar un gate con mensaje e intentar crear otro (saliente, entrante, mixto); debe impedir guardado y conservar el original; crear otro gate y repetir. Editar mensaje original sin duplicar su ID. Comprobar correspondencias alt sin alterar sus mensajes. Cambiar ref y correlación reply, cancelar y revisar que no se pierdan campos. En DurationObservation cambiar a TimeObservation, intentar guardar con dos ocurrencias, comprobar error y retirar explícitamente la sobrante. Comprobar edición temporal, undo/redo, autosave y recarga. Descargar SVG/PNG/PDF por las rutas oficiales y verificar paridad semántica/visual; probar historial, restore y merge en entorno QA exclusivo.

**Dictamen de desarrollo:** AUD-SEQ-012 corregido en contratos, política de backend y comandos/UI aislada; pendiente HTTP real y recorrido UI local. Se implementan los incumplimientos residuales concretos aquí confirmados de AUD-SEQ-006 y se amplía evidencia de los escenarios indicados. AUD-SEQ-006 no se declara certificado al 100%: se distinguen las combinaciones funcionales no comprobadas de las capas bloqueadas por entorno, sin afirmar que exista otro defecto en ausencia de evidencia. El siguiente paso es QA local y auditoría de cierre, no otro refactor general.
