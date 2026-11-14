# ATLAS V4.8.1 · Actualización UML estructural

## Alcance

**UML · Componentes:** el ensamblaje (assembly) tiene una única representación bola–encaje en la zona de acople. El símbolo respeta la inclinación general de la conexión y deja libre el texto de la etiqueta. Entre partes/puertos del diagrama compuesto se muestran terminales cuadrados, sin convertirlos en flechas.

**UML · Estructura compuesta:** el `uml-class` representado en esta vista se llama **Clasificador estructurado**. Su contenedor visual es de 780×520 unidades de lienzo. Se pueden crear partes, roles de referencia, puertos (en tarjetas ATLAS acopladas al borde), colaboración y, opcionalmente, interfaces. Los puertos pueden pertenecer al clasificador o a una parte. `connector`, `delegation` y `assembly` son las relaciones nuevas. Los `composition` previamente guardados se siguen leyendo.

**UML · Despliegue:** el catálogo nuevo muestra solo Nodo, Dispositivo, Entorno de ejecución y Artefacto. Los dispositivos admiten iconos `server`, `desktop`, `android`, `mobile`, `network`, `storage` y `generic`. Los entornos incluyen Docker, JVM, Node.js y motor de datos. Los nodos/dispositivos pueden contener entornos, que a su vez contienen artefactos. Solo se ofrecen las relaciones nuevas `communication-path` y `deployment`: la primera entre nodos físicos/lógicos, la segunda desde un artefacto al destino de despliegue. Las relaciones antiguas `manifestation` y `dependency` se siguen leyendo sin modificar la historia.

**UML · Paquetes:** el único tipo del metamodelo visible al crear es `uml-package`. **Subpaquete** se modela como otro paquete anidado; el Inspector ofrece «Crear subpaquete». Se permiten dependencias, importaciones y fusiones entre paquetes. Los elementos históricos no válidos en el catálogo actual se pueden seguir leyendo. Evita anidar más de tres niveles visibles de paquetes por las dimensiones actuales del editor.

## Edición y protección

- Los datos estructurales siguen usando `schema:1`; la API valida jerarquías, ciclos y rangos relativos.
- `umlRelationEndpointValid` se aplica a relaciones nuevas en el backend, no solo en el navegador. Los modelos históricos son legibles para evitar pérdidas.
- El frontend solo propone tipos UML permitidos al crear. La conexión automática elige un tipo válido según los extremos.
- No se ha modificado ninguna migración SQL ni el sistema de licencias.
- La API conserva ACL de creación, edición y acceso técnico y valida iconos de dispositivo/entorno.

## QA

**Archivo de prueba:** `QA_EJEMPLO_UML_4_VISTAS.json` contiene cuatro vistas: Componentes, Estructura compuesta, Despliegue y Paquetes, con 21 elementos, 12 relaciones y vínculos entre cajas de distintas vistas. Debe importarse en un proyecto de prueba vacío porque la importación reemplaza el documento del proyecto.

**Ejecutar en Windows:**

```powershell
npm run typecheck
npm run test:graph
npm run test:ui
npm run test:coverage
npm run coverage:check:90
npm run build
```

**Validado en entorno de empaquetado:** `npm run typecheck -w @atlas/web` y `npm run test:graph` (47/47). Los tests de Vitest globales no pudieron ejecutarse aquí por falta del binario `@rollup/rollup-linux-x64-gnu`, ya que las dependencias de referencia provienen de una instalación Windows. La API no pudo completar TypeScript sin `sharp` instalado. No se declara aprobada la cobertura global ni conformidad UML completa.

## Límites intencionales

Esta es una mejora de **notación y relaciones para estas cuatro vistas**, no un motor UML 2.5.1 semánticamente completo. Las variantes avanzadas de ensamblaje n-ario, puertos tipados por interfaz con comprobación de compatibilidad, arquitectura de perfiles y XMI/DI conformante necesitan validación posterior. No se debe afirmar certificación OMG.

**Fuente:** OMG Unified Modeling Language 2.5.1 (`formal/2017-12-05`), especialmente estructura de clasificadores, puertos y conectores (§§11.2–11.6), paquetes (§12), despliegues (§19) y el anexo de notación UML DI (B.3).
