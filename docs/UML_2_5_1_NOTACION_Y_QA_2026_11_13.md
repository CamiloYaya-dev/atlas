# ATLAS V4.8.1 — Notación UML 2.5.1 y correcciones de QA

Referencia normativa: documento OMG `formal/2017-12-05`, UML 2.5.1, aportado por el propietario de ATLAS. Secciones 7.7, 9, 10.4, 11.5–11.6, 12, 14–19 y anexo B (UML Diagram Interchange).

## Alcance real de esta entrega

1. Los **14 tipos UML** consultan una misma tabla de estilos semánticos (`packages/contracts/src/uml-notation.ts`). Cada tipo de relación especifica su dirección, trazo y signos de extremo; ya no dependen de los campos visuales genéricos de ATLAS.
2. El editor UML **oculta dirección y trazo arbitrarios** y conserva el control de recorrido (recto, ortogonal o curvo), que no modifica el significado UML. Se añaden asociaciones navegables explícitas en clases.
3. En diagramas UML el renderer usa **terminaciones SVG propias**, no flechas genéricas de React Flow: rombos blanco y negro en el extremo del agregado/todo, triángulo hueco para generalización/realización, punta abierta para dependencia, punta llena para mensaje síncrono y bola/encaje orientados según el puerto. El recorrido admite líneas paralelas sin confundir relaciones.
4. La API rechaza relaciones **nuevas o editadas** con trazo o dirección contrarios al tipo UML; el editor normaliza antes de guardar. Los documentos históricos con opciones obsoletas **no se reescriben al leer** y se dibujan con la notación apropiada.
5. Mejoras visuales puntuales: nodo de decisión UML con rombo, barra de bifurcación, inicio/fin con círculo y línea de vida con cabecera y línea discontinua. Se conservan clases con atributos/operaciones, objetos con slots, paquetes con contención y componentes con símbolo.
6. El test del tutorial usa navegación por el Temario, comprobando la misma interacción sin encadenar seis renderizados del editor bajo cobertura.

## Leyenda de relaciones implementadas

- Agregación: línea continua y rombo **blanco en el todo** (origen de la relación).
- Composición: línea continua y rombo **negro en el todo** (origen).
- Generalización: continua y triángulo hueco en la clase general (destino).
- Realización: discontinua y triángulo hueco en el destino.
- Asociación no navegable: continua sin puntas; asociación navegable simple y doble se eligen por su **tipo**, no por una flecha manual libre.
- Dependencia, include, extend, import, merge, deploy, manifest: discontinuas con punta abierta y estereotipo cuando corresponde.
- Componentes: interfaz proporcionada con bola; requerida con socket; ensamblaje muestra acople de bola y semicírculo sobre el conector. La orientación geométrica sale del puerto.
- Actividades, estados e interacciones: tipos de flujo/transición/mensaje con puntas y trazos definidos en la tabla; respuestas discontinuas, mensajes síncronos sólidos, asíncronos con punta abierta.

## Compatibilidad y límites

El esquema JSON sigue en versión 1. No hay migraciones SQL ni cambios de roles. Se mantiene la fuente única de verdad de los permisos en el backend. **No se declara conformidad UML 2.5.1 completa**: especialmente faltan metamodelos semánticos completos de secuencia, timing, regiones, perfiles, estados y estructura compuesta, trazabilidad XMI/DI, validación de multiplicidades/roles exhaustiva y todas las variantes de notación del anexo B. La tabla y el renderer son una base de notación para extender esos casos sin volver a mezclar el editor libre con UML.

La importación de un JSON anterior puede conservar estilos antiguos para asegurar compatibilidad. Cuando se edite una relación, ATLAS la normaliza. Si los conectores de un diagrama histórico tienen semántica incorrecta, revisar manualmente el **tipo de relación y los extremos origen/destino**, porque intercambiar ambos cambia la semántica de UML.

## Verificación

Ejecutar en PowerShell, dentro de la carpeta `atlas`:

```powershell
npm run typecheck
npm run test:graph
npm run test:ui
npm run test:unit
npm run test:coverage
npm run coverage:check:90
```

La prueba del grafo cubre las 14 vistas, la correspondencia de todos los tipos de relación con su notación, dirección y trazo, los símbolos de rombo/triángulo/bola/socket, la orientación por puerto, la autorización del servidor y compatibilidad de documentos antiguos. La suite UI y cobertura global necesitan validación Windows en el entorno original.

### Comprobaciones visuales manuales prioritarias

1. En UML Clases, unir dos clases, cambiar relación a Agregación: rombo blanco en la caja que representa el todo. Cambiar a Composición: rombo negro. Cambiar a Herencia: triángulo blanco en la clase padre.
2. Confirmar que la ficha de relación UML **no** ofrece editar trazo ni dirección como parámetros libres; sí permite cambiar el tipo y el recorrido geométrico.
3. Conectar por puertos superior/inferior: la terminación queda vertical. Conectar por puertos laterales: queda horizontal.
4. En UML Componentes, crear una relación de interfaz proporcionada, requerida y ensamblaje; comprobar la mitad del semicírculo según el lado del puerto (incluido extremo izquierdo).
5. Importar un JSON anterior y verificar que sus datos no cambian al abrirlo. Al editar una relación histórica, guardar y revisar la notación canónica.
6. En Academia, abrir Aprender ATLAS, usar Temario para seleccionar «6. Agrega elementos de distintos tipos», abrir «Agregar caja», cancelar y comprobar que el tutorial se reanuda.
