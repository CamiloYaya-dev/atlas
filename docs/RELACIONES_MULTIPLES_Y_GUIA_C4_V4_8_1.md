# ATLAS V4.8.1 — Relaciones paralelas y guía de navegación C1–C4

## Problema y diagnóstico

ATLAS impedía guardar dos conexiones entre el mismo par de cajas en dos sitios:
1. `apps/web/src/features/editor/AtlasEditor.tsx` detenía `onConnect` si `source/target` ya aparecían.
2. `apps/web/src/features/editor/domain/document-commands.ts` impedía crear pares duplicados y `apps/api/src/modules/projects/application/document-policy.ts` los rechazaba al validar el documento.
3. Al dibujar más de una relación con idénticos extremos/puertos, React Flow solaparía sus trayectorias y etiquetas, complicando el clic y la edición.

## Cambios

- **Modelo**: las relaciones comparten libremente cajas de origen y destino; cada una mantiene un `id` único, `sourceHandle`, `targetHandle`, nombre, dirección y estilo. Siguen prohibidas las autoconexiones a la misma caja y los IDs duplicados. El backend conserva los controles de permisos de creación, edición y eliminación de cada relación.
- **Vista**: `parallelOffsets` agrupa cada par de cajas sin importar el sentido y genera carriles independientes y deterministas. `AtlasParallelEdge` respeta curvas, flechas, discontinuidades y estilos; la etiqueta se desplaza con su carril y la zona seleccionable es más cómoda.
- **Puertos**: todos los ocho puertos de cada caja pueden funcionar como origen o destino en `ConnectionMode.Loose` (izquierda, derecha, 3 arriba y 3 abajo). Se agrandaron sus zonas visibles.
- **Niveles C4**: la lista de diagramas muestra badges `C1`, `C2`, `C3`, `C4` o una abreviatura de la vista. Una caja con vista C4 vinculada muestra el nivel de destino.
- **Academia**: el ejercicio «Vincula C1 → C2 → C3 → C4» incluye una explicación y un pequeño recorrido guiado:
  1. C1: selecciona la caja tipo **Sistema** «Plataforma de solicitudes» y, en el Inspector, selecciona como **Vista vinculada** el C2 «Contenedores de solicitudes».
  2. C2: selecciona la caja tipo **Servicio** «API de solicitudes» y enlázala al C3 «Componentes de la API».
  3. C3: selecciona la caja tipo **Componente** «Gestor de solicitudes» y enlázala al C4 «Código de solicitudes».
  4. Espera a **Guardado**, haz doble clic sobre una caja vinculada para entrar y utiliza **Volver** para regresar. Los niveles C1–C4 representan granularidad progresiva, no hay que dibujar líneas entre lienzos diferentes.

## Cómo validar manualmente

1. Exporta el JSON de un proyecto de prueba existente antes de instalar el parche.
2. En C3 crea dos cajas; conecta ambas desde `right` hacia `left`; crea una segunda relación desde `top-2` hacia `bottom-3` y una tercera usando los mismos puertos. Deben quedar **3 relaciones distintas** y el contador debe reflejarlas.
3. Haz clic en cada línea, asigna nombres diferentes (`HTTP`, `Evento`, `Auditoría`), configura una bidireccional y otra punteada. Guarda y recarga. Las tres deben permanecer y poder editarse individualmente.
4. Elimina la segunda desde el diálogo de relación, confirma y comprueba que **solo** se borra esa relación.
5. Prueba la misma operación en sentido inverso (B → A), desde puertos superiores e inferiores; no debe bloquearse.
6. En el laboratorio de la Academia, abre la misión técnica «Vincula C1 → C2 → C3 → C4», pulsa los accesos de cada paso y comprueba que el Inspector destaca «Vista vinculada (doble clic)».
7. Después de guardar cada vínculo, vuelve a la vista de origen y haz doble clic. El icono de la caja debe mostrar C2/C3/C4 y abrir la vista correcta.
8. Prueba con un usuario sin permiso `relation.create`, `relation.edit` o `relation.delete`: no debe poder ejecutar la acción correspondiente.

## Compatibilidad

- No se altera el esquema JSON (`schema: 1`) ni PostgreSQL. No hay migraciones.
- Se conservan documentos anteriores que solo tienen una conexión por par de cajas, así como los enlaces a vistas específicas.
- El parche **no importa ni reemplaza documentos**. Instálalo sobre el código de ATLAS V4.8.1 después de hacer una copia de seguridad y reinicia el servidor frontend/backend.

## QA

`npm run typecheck` y `npm run test:graph` son verificables en el entorno de trabajo. El test de regresión del grafo cubre casos de persistencia/ACL, rutas paralelas, sentido inverso, render del borde y badge C4. Las suites `test:ui`, `test:unit`, `test:db` y `test:e2e:local` deben ejecutarse en la instalación Windows con dependencias nativas compatibles y los servicios locales disponibles. No se declara cierre global de QA sin esas ejecuciones.
