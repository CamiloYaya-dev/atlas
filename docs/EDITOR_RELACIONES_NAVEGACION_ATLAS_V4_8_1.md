# ATLAS V4.8.1 — Relaciones configurables, navegación precisa y Academia

## Objetivo

Corregir el flujo de acreditación C2 del laboratorio técnico y permitir trabajar con relaciones reales entre cajas, múltiples puertos y navegación hasta una caja concreta de otro diagrama. Todas las operaciones conservan la persistencia JSONB (`schema: 1`) y el control optimista de versiones.

## Cambios del editor

1. **Editar y eliminar relaciones**: clic sobre una línea → *Configurar relación*. Se ofrece nombre, **Dirección** (`Origen → destino`, `Destino → origen`, `Bidireccional ↔`, `Sin flechas`), **Trazo** (`Continua`, `Discontinua`, `Punteada`) y **Recorrido** (`Ortogonal redondeada`, `Ortogonal`, `Recta`, `Curva`). Quien tenga `relation.delete.<scope>` puede pulsar **Eliminar relación**, con confirmación propia de ATLAS. Quitar una relación NO elimina cajas ni elementos. `relation.edit.<scope>` y `relation.delete.<scope>` son independientes.
2. **8 puertos por caja**: izquierdo, derecho, tres superiores y tres inferiores; el modo de conexión flexible permite empezar y terminar líneas en los lados deseados. Se almacenan `sourceHandle` y `targetHandle` de forma opcional. Las relaciones antiguas siguen unidas a la derecha del origen y a la izquierda del destino.
3. **Estilos por vista**: C1/C2/C3 tienen recorrido ortogonal redondeado inicial; procesos usan ortogonal, secuencias recta, C4 curva y trazabilidad recta. Cada relación puede personalizarse posteriormente.
4. **Vista vinculada a una caja**: en Inspector, asigna el diagrama y luego «Caja de destino (opcional)». Al hacer doble clic sobre el elemento de origen, ATLAS navega a ese diagrama, selecciona la caja y ajusta el zoom para localizarla. Sin caja seleccionada, abre la vista completa como antes. **Volver** permite regresar al diagrama anterior, incluso desde pantalla completa. También las entradas de «Relaciones en el modelo» centran su caja concreta cuando se navega entre diagramas.
5. **Enlaces no válidos**: el backend rechaza `childNodeId` inexistentes, y si se retira la caja de destino el comando limpia solamente la referencia a esa caja, manteniendo la vista vinculada como vista general.

## Academia: acreditación técnica y guía de campos

- **C2** valida que las relaciones conecten *Aplicación web ↔ API de solicitudes* y *API de solicitudes ↔ Base de datos*, sin exigir el sentido en que se trazó la línea. En general, los ejercicios de relación evalúan conectividad entre los tipos correspondientes; la dirección visible se configura aparte.
- Si C2 sigue incompleto, se muestra una explicación de las dos conexiones necesarias. Una relación solo acredita cuando el guardado está confirmado por el backend.
- En ejercicios de campos personalizados, el botón **Muéstrame dónde** selecciona el elemento requerido y resalta **Campos personalizados → Configurar** en el Inspector, en lugar de crear el campo automáticamente. Tras pulsar Configurar, se ofrecen sugerencias iniciales que deben ser revisadas y guardadas por el usuario. No se modifica el proyecto en segundo plano.

## Seguridad, contratos y compatibilidad

- Se mantienen `schema: 1`, IDs de los nodos, versiones y controles ACL del backend.
- `ModelElement.childNodeId` es opcional y exige `childDiagramId` válido; el backend valida el destino. `DiagramEdge.sourceHandle/targetHandle/direction/lineStyle/pathStyle` son opcionales; documentos anteriores funcionan sin migración.
- Guardado colaborativo y restauración usan el merge de tres vías existente; una edición simultánea de la misma propiedad puede requerir resolver un conflicto.
- No hay nuevas migraciones, nuevas tablas o cambios de identidad de elementos; los ejemplos de Academia siguen en su organización de laboratorio.

## Guía de prueba manual (Windows)

1. Antes de instalar, **exporta JSON y haz backup del proyecto/BD**. Cierra el servidor local y aplica el parche sobre una copia del código.
2. Abre C2 del laboratorio. Conecta Aplicación web con API y API con Base de datos. Prueba ambos sentidos. Espera a **Guardado** y revisa el primer paso de Arquitecto técnico. Debe marcarse como completado. Luego utiliza **Crear C3**.
3. Clic en una línea → configura doble flecha, discontinua y curva → guarda. Recarga la página y verifica que persiste. Prueba la opción Eliminar relación, primero Cancelar y luego confirmar, verificando que las cajas continúan.
4. En C3 o procesos crea líneas desde tres puntos superiores e inferiores diferentes y observa que no se muevan al recargar.
5. Crea un diagrama de trazabilidad con muchas cajas. Desde un elemento del flujo de procesos, en Inspector elige **Vista vinculada** y una **Caja de destino**. Haz doble clic, comprueba que ATLAS selecciona esa caja, pulsa Volver y confirma que vuelves al flujo. Repite con pantalla completa y con «Abrir vista general».
6. En la Academia, ve a la tarea **Crea y utiliza un campo personalizado**. Pulsa **Muéstrame dónde**, busca el resaltado en el Inspector y usa **Configurar** para crear un campo. Dale un valor en la ficha, guarda y valida la tarea.
7. Comprueba permisos: un rol sin `relation.delete` no debe mostrar la acción de eliminación; un rol sin `relation.edit` no puede modificar nombre/flechas. Prueba recargar, exportar/importar y colaborar con otra sesión.

## Comprobaciones ejecutadas en esta entrega

- `npm run typecheck`: aprobado en API y web.
- `npm run test:graph`: 15 pruebas de compatibilidad, dominio, render de líneas y puertos, ACL y Academia, aprobadas con TypeScript transpile (no depende de esbuild/Rollup).
- `npm run test:qa-tools`: 4/4 aprobadas.
- `npm run test:unit`, `npm run test:ui`, `npm run build`: requieren completar pruebas en Windows. En este entorno los módulos nativos de esbuild/Rollup proceden de otro sistema y bloquean esas suites, independientemente de los cambios.

## Instalación

Parche: extraer su contenido directamente en el directorio `atlas/` conservando `.env`, `node_modules`, PostgreSQL y Docker. El ZIP completo contiene una carpeta raíz `atlas/`. Evitar instalar ambos a la vez. Ejecutar por separado `npm run typecheck`, `npm run test:graph`, `npm run test:ui`, `npm run test:unit`, `npm run build`. Si hay errores, volver a la copia de seguridad del código, **sin borrar la BD**.
