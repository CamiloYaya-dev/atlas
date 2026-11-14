# ATLAS V4.8.1 — UML y exportación de fichas

## Cambios incluidos

1. **Captura visual**: los campos del inspector no se dibujan debajo de cada caja. La imagen reserva una columna lateral **Fichas de elementos** al margen derecho. El lienzo y sus trayectorias SVG no se redibujan. La captura considera además los `getBBox()` de las rutas para evitar colocar fichas sobre conexiones que sobresalgan del borde de las cajas. Cada ficha muestra el nombre de su caja de origen.
2. **Exportación avanzada PRO**: mismo selector por cada campo de cada caja para escoger `Omitir`, `En imagen` o `En fichas`. Si hay fichas documentales, el usuario elige **PDF**, **Word (.docx)** o **HTML**. La respuesta contiene un ZIP con imagen PNG/JPG firmada y un documento independiente. No requiere librerías, dependencias ni migraciones nuevas.
3. **Tutorial**: eliminado el acceso superior redundante; se mantiene el acceso **Aprender ATLAS** en el menú lateral, con su `data-tour` de guía contextual.
4. **UML**: 14 tipos agrupados en **Estructura (7)**, **Comportamiento (3)** e **Interacción (4)**. El catálogo compartido ofrece elementos válidos y clases de relación por vista. El backend impide guardar combinaciones fuera del catálogo; sigue respetando las mismas ACL de la organización y proyecto. Se conservan los diagramas C4, de procesos, secuencia previa, datos, trazabilidad y personalizados.
5. **Casos de uso**: `UML · Casos de uso` ofrece actor representado como persona y caso de uso ovalado, con relaciones asociación, include, extend y generalización. El catálogo de modelos es compartido; un caso de uso se reutiliza en trazabilidad y el Inspector puede enlazar una caja del diagrama de trazabilidad a una caja específica del diagrama UML. El doble clic mantiene la navegación y el regreso existentes.

## Los 14 diagramas incorporados

| Familia | Diagrama | Elementos característicos | Conexiones disponibles |
|---|---|---|---|
| Estructura | Clases | Clase, interfaz, enumeración, paquete | asociación, generalización, agregación, composición, dependencia, realización |
| Estructura | Objetos | Objeto, clase, paquete | enlace, dependencia |
| Estructura | Componentes | Componente, interfaz, puerto, artefacto | ensamblaje, interfaz proporcionada/requerida, dependencia, realización |
| Estructura | Estructura compuesta | Clase, parte, puerto, interfaz | conector, delegación, composición |
| Estructura | Despliegue | Nodo, dispositivo, entorno, artefacto, BD | comunicación, despliegue, manifestación, dependencia |
| Estructura | Paquetes | Paquete, clase, interfaz, componente | dependencia, importación, fusión, contención |
| Estructura | Perfiles | Perfil, estereotipo, clase, restricción | extensión, aplicación estereotipo, dependencia |
| Comportamiento | Casos de uso | Actor, caso de uso, sistema, requisito | asociación, include, extend, generalización |
| Comportamiento | Actividades | Inicio, acción, decisión, bifurcación, final, señal | flujo de control, flujo de objetos, fork/join, excepción |
| Comportamiento | Máquina de estados | Inicio, estado, transición, final, región | transición, disparador, finalización, generalización |
| Interacción | Secuencia | Actor, línea de vida, mensaje, marco, interacción | mensaje, respuesta, asíncrono, creación, destrucción |
| Interacción | Comunicación | Actor, objeto, línea de vida, mensaje | mensaje, respuesta, asíncrono, vínculo |
| Interacción | Interacción general | Inicio, interacción, decisión, final, marco | flujo, referencia, decisión |
| Interacción | Tiempo | Línea de vida, estado, tiempo, restricción | transición temporal, duración, restricción |

**Alcance técnico**: se incluye el catálogo visual editable, las restricciones por tipo, los campos semánticos de relación, el enlace a fichas compartidas y algunas formas representativas (actor, óvalo, clase, paquete, etc.). **No es todavía un editor con conformidad UML formal completa**: no incluye todas las variantes gráficas ni reglas semánticas de OMG, validación de multiplicidad, XMI ni simulación de estados. Los tipos que no tienen notación específica terminada se visualizan como cajas ATLAS con su tipo UML, no como una conformidad ficticia.

## Usar la exportación avanzada

1. Abrir un diagrama guardado → Exportar → PNG o JPG.
2. Con licencia PRO activar `Campos embebidos`, `Fichas de elementos` o `Imagen + fichas`.
3. Elegir campo por caja y destino. Si eliges fichas, selecciona PDF, Word o HTML.
4. Descargar el ZIP y comprobar que la imagen no se altera y que las fichas aparecen al margen o en el documento según elección.
5. El servidor decide licencia, marca de agua, permisos y firma de imagen. El documento complementario se genera desde el modelo guardado y **no lleva actualmente una firma documental independiente**.

## Validación

- TypeScript frontend/API: aprobado.
- Regresiones de grafo, puertos y catálogo UML: 25/25.
- Exportación avanzada, licencias y formatos: 6/6 pruebas instrumentadas sin binarios nativos.
- Herramientas QA: 4/4.
- Captura visual con Chromium: inspección de rutas y columna de fichas.
- Validación de PDF con PyMuPDF y DOCX con python-docx/LibreOffice: ambos legibles.
- Pruebas completas `test:ui`, `test:coverage`, puerta >=90%: **pendientes en Windows**; la dependencia `node_modules` entregada anteriormente contiene binarios esbuild/Rollup para otra plataforma y no fue usada para certificar la suite.

## Instalación

No hace falta migrar PostgreSQL. Aplicar el parche sobre la última V4.8.1, conservando `.env`, base de datos y volúmenes Docker. Ejecutar `npm run typecheck`, `npm run test:graph`, `npm run test:advanced-export`, `npm run test:ui`, `npm run test:coverage`, `npm run coverage:check:90`, `npm run build`.

**Importar** reemplaza el documento del proyecto seleccionado: usar el ejemplo UML únicamente en un proyecto QA independiente.
