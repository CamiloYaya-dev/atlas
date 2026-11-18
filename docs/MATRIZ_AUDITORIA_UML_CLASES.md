# NOVZI 4.8.1 — Tercera auditoría local UML de clases

Estado: correcciones AUD-CL-012/013 implementadas; validación local oficial **no certificada** por bloqueo del entorno. El QA integral y la cobertura global se reservan, por instrucción de la tercera auditoría, para el cierre de todos los diagramas. No se cambian los gates.

Base: reconstrucción de la última entrega NOVZI con parche de auditoría iteración 2. No se recibió `novzi(2).zip` sin espacio con el hash de la auditoría; se conserva la base reconstruida y se proporcionan únicamente diferencias incrementales. Comparar modificaciones locales antes de sobrescribir.

## Decisiones y reglas

- Una sola familia Importación en la UI, misma punta abierta y línea discontinua. `elementImport` / `elementAccess`: importar el nombre de un elemento (también paquete/modelo), alias opcional, público/privado. `packageImport` / `packageAccess`: importar miembros públicos de namespace paquete, sin alias, público/privado. `import` y `access` legados se conservan. `access` con alias se interpreta inequívocamente como ElementImport privado. `import`/`access` sin alias hacia paquete no se clasifican silenciosamente: se conserva la instantánea; al editar se exige resolver el subtipo o, para access, declarar alias explícito. Los fixtures QA antiguos se actualizaron explícitamente, no los documentos del usuario.
- Resolución por IDs de catálogo y namespace, no por IDs de nodo, ni texto libre de etiqueta. Clausura de reexportación pública mediante cola finita de triples namespace/elemento/nombre. Los imports privados no alimentan esa clausura. ElementImport tiene precedencia frente a PackageImport; los nombres locales tienen precedencia. NOVZI aplica política estricta adicional: si existen candidatos distintos para un nombre, se identifica el conflicto aunque uno tenga precedencia y **no se devuelve un memberId inequívoco**. Se exige un alias diferente o resolver referencia mediante su namespace (ID); no se inventa un nuevo formato de alias calificado. No se declara que UML prohíba universalmente las colisiones. En modelos históricos con conflictos, las posibles referencias importadas se analizan conservadoramente, sin mutar snapshots.
- La descripción de una asociación vinculada a una clase de asociación es semántica y compartida. Cambiar una sola aparición dejando otra distinta se rechaza; el comando multivista existente propaga los cambios sobre el documento, conserva IDs, puertos, coordenadas y recorridos locales. El servidor compara el documento completo, con la autorización existente. Una clase de asociación huérfana sigue siendo borrador diagnosticable, no un modelo final certificado.
- El fingerprint de una colisión contiene namespace, nombre e IDs exclusivamente para distinguir conflictos históricos/nuevos en validación; el error de API continúa siendo genérico (no expone dichos IDs). La comparación de conflictos de fusión considera también ese fingerprint.

## Matriz de hallazgos (local)

| ID | Estado y evidencia |
|---|---|
| AUD-CL-001 | Se conservan validación de referencias de tipos y casos de rechazo, contratos y política API ejecutados. |
| AUD-CL-002 | Se conserva compatibilidad de propiedades por relación y extremos, con pruebas de clases aprobadas. |
| AUD-CL-003 | Se conservan allowlists de tipos y miembros; pruebas de contratos y política ejecutadas. |
| AUD-CL-004 | Se conserva identidad compartida y diagnóstico de huérfana. La edición multivista existe desde iteración 2 y se refuerza con AUD-CL-013. |
| AUD-CL-005 | Compatibilidad formal/argumentos y representación de binding conservadas; pruebas unitarias y modal ejecutadas. |
| AUD-CL-006 | Etiquetas reservadas derivadas del subtipo. Nuevos tipos privados reutilizan el renderer. Se comprobó texto de SVG y modal, no paridad visual integral en navegador. |
| AUD-CL-007 | Cálculos compartidos de geometría y notación conservados. Grafo dirigido aprobado; PNG/JPG reales no ejecutados aquí. |
| AUD-CL-008 | Política API unitaria y autorización conservadas. Se amplían pruebas HTTP de importación/PUT/versiones; no se ejecutaron sin PostgreSQL. |
| AUD-CL-009 | Conservada la visibilidad efectiva de los miembros y validación de alias directos. Extendida a transitividad mediante 012. |
| AUD-CL-010 | Allowlist de extremos n-arios y sustituciones preservada; pruebas previas aprobadas. |
| AUD-CL-011 | Comando multivista existente preservado, pruebas anteriores y fixture nuevo de dos vistas aprobados en política. |
| AUD-CL-012 | Implementadas las cuatro variantes explícitas, alias privado, importación del nombre de paquete, resolución transitiva, precedencia con diagnóstico estricto y ciclos finitos. Pruebas de contratos/API, UI diagnóstica y fixture con colisión reproducible aprobados. Se escribieron pruebas HTTP adicionales, pendientes de ejecución real. |
| AUD-CL-013 | Descripción incluida en firma semántica; API bloquea divergencia, sincronización existente conserva geometría y IDs. Pruebas positivos/negativos y fixture de dos vistas aprobados. HTTP/historial añadido, pendiente de ejecución real. |

## Evidencia de esta entrega

- 113/113 pruebas específicas de contratos y política API (104 anteriores + 9 nuevas), mediante Node test con loader TypeScript. No equivale a HTTP/BD.
- 2/2 pruebas dirigidas `uml-scoped` con loader alternativo, incluidas exportación y roundtrip de fixture.
- 8/8 grafo dirigido por el comando oficial de clases.
- 43/43 ejecuciones diagnósticas React/jsdom de componentes e inspector/grafo compartidos, incluidas 4 nuevas del modal de importación. No equivalen a Vitest oficial ni Chromium real. Se ejecutaron las suites de componentes compartidas, sin QA integral.
- TypeScript API y web: código de salida 0, mediante `node node_modules/typescript/bin/tsc --noEmit -p apps/{api,web}/tsconfig.json`.
- Fixture principal: 49 elementos, 52 cajas, 38 relaciones, 24 variantes, 1 vista UML de clases; validaciones de contrato, política owner y SVG; alias Y conflictivo rechazado; alias privado SoloQ no reexportado.
- Fixture específico multivista: 3 elementos, dos vistas UML de clases, dos apariciones de la misma asociación; política owner acepta importación, rechaza descripción unilateral, y acepta sincronización conservando geometría.
- `npm run qa:uml:clases`: código de salida 1 por esbuild y Rollup con binarios Windows y Docker ausente. La etapa de grafo sí aprueba. La evidencia distingue claramente diagnóstico de ejecución oficial. No se ejecuta `qa:integral`, ni se mide o modifica cobertura global en esta etapa. No se reutilizan métricas globales históricas.

## T01–T11

Se preservan T01–T11 anteriores. El subconjunto local relacionado con contratos, reglas, grafo, modal, visualización SVG y roundtrip se ejercitó con los resultados indicados. No se certifica T01–T11 de extremo a extremo ni la aprobación local oficial mientras falten las etapas reales de UI y PostgreSQL. Las pruebas E2E/coverage global se reservan para el cierre de todos los diagramas, conforme a la auditoría 3. Los nuevos HTTP de AUD-CL-012/013 están incluidos en `uml-scoped.integration.test.ts` y se ejecutan con el comando específico de clases.

## Aplicar

Respaldar el código y conservar archivos locales, configuración y BD. Copiar únicamente `archivos/` sobre NOVZI después de iteración 2. No instalar el monorepo de nuevo ni ejecutar migraciones adicionales. Importar los fixtures en proyectos de QA vacíos. Para revertir, restaurar los archivos reemplazados desde el respaldo. Ejecutar `npm run typecheck` y `npm run qa:uml:clases`.
