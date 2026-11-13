# ATLAS Academy — Misiones reales e insignias (V4.8.1)

## Objetivo de producto

Conservar el recorrido explicativo de 18 pasos de «Aprender ATLAS» y añadir una ruta de **aprendizaje por ejecución**. El alumno crea una organización propia de formación, un proyecto asociado y un modelo real de un sistema de gestión de solicitudes. El curso evita nombres y datos de clientes. ATLAS no está vinculado comercialmente a Zercano.

Las **tres insignias** se derivan del documento real después de que el editor indique «Guardado», no de pulsar «Siguiente», ni de información inventada por el frontend. El usuario puede corregir un error y comprobar de nuevo su avance. No se persiste una certificación irrevocable; el reconocimiento depende del modelo actual.

## Primeros pasos (obligatorios para las misiones)

1. Iniciar sesión con una cuenta autorizada.
2. Abrir **Misiones** desde la barra superior, o **Misiones e insignias** en el menú lateral.
3. Elegir el nombre de la organización y pulsar **Crear mi organización de práctica**. Se utiliza la ruta normal `POST /workspaces` y el usuario controla cuándo se crea. No se crean organizaciones de manera silenciosa.
4. Crear explícitamente un proyecto con **Crear mi proyecto de práctica**. Se usa `POST /workspaces/:id/projects` con un documento vacío válido.
5. El laboratorio queda vinculado por IDs a la cuenta en `localStorage` (`atlas.academy.lab.v1.<accountId>`). El progreso real es el contenido del proyecto en PostgreSQL. En esta versión la asociación local es por navegador y no se sincroniza con otras instalaciones; los diagramas sí persisten en el servidor.

**Aislamiento**: es una organización/workspace independiente dentro del mismo despliegue y base de datos, protegida por los controles multitenant y ACL existentes. No es un servidor ni una base PostgreSQL aparte. Se impide evaluar otros proyectos cuando la Academia está abierta. No se ejecuta ninguna importación, reemplazo o borrado automático.

## Curso 1 · Analista funcional — Insignia 1

Crear tres diagramas:

- `01 · Contexto de solicitudes` (C1), con **Actor** «Persona solicitante», **Sistema** «Plataforma de solicitudes» y **Proceso** «Gestionar solicitud». Dos relaciones, incluida Actor → Sistema.
- `02 · Flujo de solicitudes` (Proceso), con **Actividad** «Registrar solicitud» → **Actividad** «Revisar solicitud».
- `03 · Requisitos y casos de uso` (Matriz de trazabilidad), con **Requerimiento** «HU-01 · Como usuario quiero registrar solicitudes», **Requerimiento** «RF-01 · Validar campos obligatorios» y **Caso de uso** «CU-01 · Registrar solicitud»; relacionar al menos un Requerimiento → Caso de uso.

Conectar las vistas a través de la ficha del elemento **Proceso** de C1 mediante «Vista vinculada (doble clic)» → vista de procesos. Reutilizar el **mismo ID de requerimiento** de la matriz en el proceso usando «Agregar caja → Reutilizar existente». Esta comprobación evita conceder la insignia si se han creado dos copias sin relación. Las 7 comprobaciones deben estar completas y guardadas.

### Nuevos ejercicios de Inspector y campos funcionales

Además de modelar y vincular los diagramas, la insignia **Analista funcional** exige:

- Seleccionar la HU-01 en la Matriz de trazabilidad y completar **Resumen**, **Descripción** y **Responsable** desde el **Inspector**. Los valores deben quedar persistidos en la ficha compartida de la HU.
- Abrir **Configurar campo** y crear una definición **«Canal de solicitud»**, tipo **Lista**, aplicable a **Requerimiento**, con las opciones `Web`, `Móvil`, `API`. Es obligatorio seleccionar una opción en la HU-01 desde el Inspector. Crear solo la definición no acredita el ejercicio.

Las nuevas definiciones son distintas de las que el documento vacío de ATLAS ya trae como valores iniciales. El laboratorio **no las crea automáticamente**.

## Curso 2 · Arquitecto técnico — Insignia 2

Se desbloquea al terminar el curso funcional y continúa implementando **la misma necesidad**:

- `04 · Contenedores de solicitudes` (C2): **Contenedor** «Aplicación web», **Servicio** «API de solicitudes», **Base de datos** «Base de datos de solicitudes» y dos relaciones.
- `05 · Componentes de la API` (C3): **Componente** «Gestor de solicitudes» → **Endpoint** «POST /solicitudes», con descripción técnica en la ficha.
- `06 · Código de solicitudes` (C4): **Componente** «SolicitudController» → **Componente** «SolicitudService», con detalle técnico en su ficha.

Conectar explícitamente C1: **Sistema → C2**, C2: **Servicio → C3**, C3: **Componente → C4** mediante campos `childDiagramId` reales. Reutilizar el **Componente** de C3 en la matriz de trazabilidad y conectarlo con una HU o RF (Requerimiento → Componente). El editor mantiene un solo elemento por proyecto, así que la ficha funcional y técnica está compartida.

### Nuevos ejercicios de Inspector y campos técnicos

- Seleccionar el Endpoint **POST /solicitudes** de C3 y completar **Resumen**, **Descripción**, **Responsable** y **Detalle técnico** desde el Inspector.
- Crear **«Protocolo de integración»**, tipo **Texto**, aplicable a **Endpoint**, y asignar el valor `HTTPS` al endpoint desde su ficha. Una definición vacía no concede el avance.

La insignia técnica exige todas las 7 comprobaciones y guardado completo.

## Curso 3 · Arquitectura conectada — Insignia 3

**No se repite el trabajo anterior.** La vista «Mixta» no fusiona mágicamente todos los diagramas: muestra las fichas funcionales y técnicas de los nodos que pertenecen a la vista activa. La matriz del curso incluye requisitos y componentes reutilizados, con relación semántica entre ellos. Para la última insignia, abrir la **Matriz de trazabilidad** y cambiar la perspectiva a **Mixta**. La insignia exige que los dos cursos anteriores se mantengan completados y guardados.

## Comportamiento de la interfaz

- El panel permanece abierto al usar formularios propios de ATLAS; los modales tienen mayor z-index, y el panel conserva la sección desplegada.
- Si el usuario cambia de organización o proyecto, el curso deja de acreditar ese documento y ofrece regresar al laboratorio. No modifica ni reemplaza la información del otro proyecto.
- En pantalla completa nativa el panel se muestra mediante el portal existente al lienzo; en móviles usa un panel inferior con scroll.
- Las cajas sugeridas abren el formulario **real** con nombre y tipo precargados. **No las crean sin confirmar**. El alumno construye las relaciones arrastrando puertos y los enlaces desde el inspector.
- Las acciones de crear espacio o proyecto se bloquean si hay cambios pendientes o errores de guardado.
- El lector que no tenga permisos no puede ejecutar acciones para las que la API no lo haya autorizado. Los controles de creación de diagramas y cajas siguen la ACL existente.
- No se utilizan `alert()`, `confirm()` ni `prompt()` nativos.

## Recordatorios inteligentes de inactividad

- Control permanente del panel: **«Recordarme el paso tras»** con opciones **1, 2, 3 minutos o Desactivado** (por defecto 2). Preferencia guardada únicamente en el navegador; sin telemetría ni llamadas API.
- Cuando ATLAS permanece inactivo, el primer criterio incompleto del curso expandido recibe un **borde animado**, con una indicación hacia la acción del paso. Se respeta `prefers-reduced-motion`.
- Solo si el **botón de acción** de ese paso está fuera del área realmente visible del panel, aparece en el pie fijo **«Sube para continuar»** o **«Baja para continuar»**. Si el usuario lo pulsa, la interfaz desplaza suavemente **solo el panel del laboratorio** hacia esa acción. **Nunca se hace scroll automático por inactividad.**
- Si el alumno desplaza el panel hasta ver la acción, el botón direccional se oculta; si continúa desplazándose y deja la acción fuera de vista, vuelve a aparecer sin exigir otro periodo de espera. La animación no impide usar la aplicación.
- Mientras hay un modal del editor, confirmación, creación ocupada, error o guardado pendiente, se pausa la asistencia. Un progreso nuevo resuelve el paso destacado y la próxima orientación corresponde al siguiente criterio incompleto.
- Se evita el uso de `alert()`, `prompt()` y `confirm()` nativos.

## Criterios de aceptación / pruebas

1. Sin organización no puede iniciarse la práctica; el usuario la crea mediante un clic explícito.
2. No hay proyecto de formación hasta crear explícitamente uno.
3. C1, Proceso y Trazabilidad vacíos **no** conceden la insignia funcional.
4. La repetición del nombre de una HU no sustituye reutilizar su `elementId`.
5. C1→C2→C3→C4 son vínculos reales y no solo nombres/relaciones dibujadas.
6. La Matriz vincula Requerimiento → Componente reutilizado de C3.
7. Las insignias no se conceden mientras `saveStatus != 'saved'`.
8. La insignia mixta solo se concede en la matriz con modo Mixto y ambas rutas completas.
9. No se evalúan proyectos ajenos al laboratorio guardado.
10. No se pierden las secciones abiertas al crear un diagrama/caja y cerrar un formulario.
11. Los perfiles sin permisos no pueden editar por interacción directa; el backend mantiene el control final.
12. La HU y el endpoint necesitan metadatos del Inspector guardados, no solo estar presentes como cajas.
13. Ambas rutas exigen crear una definición de campo nueva y usarla en el elemento adecuado.
14. Tras el tiempo configurado el siguiente paso pendiente se destaca sin desplazar ni enfocar nada automáticamente.
15. Las ayudas «Sube»/«Baja» aparecen exclusivamente si la acción está fuera de vista; desaparecen al quedar visible y reaparecen al perder visibilidad.
16. El usuario puede desactivar las sugerencias sin afectar sus insignias ni datos.

**Validación de esta entrega:** TypeScript API/web y 7 pruebas de comportamiento con React/jsdom ejecutadas mediante runner aislado; nuevas pruebas Vitest incorporadas para campos, inspector y temporizador, pero la suite Vitest continúa bloqueada por Rollup Linux en este entorno. **Versión previa:** `npm run typecheck` completo y las pruebas directas de la lógica y renderizado básico en jsdom pasaron. `npm run test:qa-tools` pasó. La suite completa de Vitest requiere resolver antes la dependencia nativa de Rollup Linux en este entorno; debe ejecutarse en Windows. No se afirma que la ruta E2E ni cobertura por archivo hayan pasado aquí.

## Limitaciones conocidas para futuras versiones

- La inscripción del laboratorio se guarda en el navegador, no en una tabla central de usuarios. Para progreso multi-dispositivo, añadir en backend una entidad `academy_enrollments` con IDs de workspace/proyecto y hitos verificados. Nunca confiar en un ID que llegue de cliente sin validar pertenencia y permisos.
- Las insignias son reconocimientos de aprendizaje del producto, **no certificaciones profesionales**.
- No se guarda un historial inmutable de insignias; si borras cajas o relaciones, las acreditaciones se recalculan.
- No hay deshacer automatizado del proyecto de prácticas. Borrar la organización y proyecto debe respetar las confirmaciones y permisos actuales.
- El tutorial de 18 pasos sigue siendo informativo y voluntario; la creación de organización/proyecto solo es obligatoria para la ruta de misiones.
