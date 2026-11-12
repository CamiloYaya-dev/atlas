# ATLAS Academy — Tutorial interactivo (V4.8.1)

## Objetivo

Enseñar **dentro de ATLAS**, paso a paso, a perfiles de negocio y perfiles técnicos qué es un espacio de trabajo, un proyecto, un diagrama y un elemento reutilizable, y cómo conectar las vistas funcionales con la arquitectura técnica. El aprendizaje debe ser seguro: **el tutorial no crea, modifica, importa, borra ni guarda información del proyecto**.

## Cómo iniciar

1. Inicia sesión en ATLAS.
2. Pulsa **Aprender ATLAS** en la parte inferior del menú lateral o el botón con el icono de libro en la barra superior (útil cuando la barra lateral está oculta o en móvil).
3. Sigue el recorrido con **Siguiente / Anterior** o abre **Temario** para saltar a un tema.
4. Los controles de ATLAS se resaltan cuando están disponibles. Permanecen utilizables; los cambios reales dependen de los permisos de la cuenta.
5. Prueba los ejercicios simulados cuando aparezcan. Estos ejercicios solo alteran el estado visual local del tutorial.
6. **Cerrar** pausa el recorrido y conserva el último paso sin marcarlo como completado. **Finalizar** marca la guía como completada en el almacenamiento local del navegador; puede repetirse cuantas veces se desee.

## Contenido (18 pasos)

- Bienvenida y propósito.
- Organización / espacio de trabajo, proyecto, diagramas.
- Arquitectura C1–C4 (ejercicio).
- Lienzo, tipos de caja, reutilización (ejercicio), relaciones (ejercicio), inspector y fichas.
- Vincular un diagrama hijo para profundizar (ejercicio).
- Perspectivas funcional, mixta y técnica (ejercicio), filtros y matriz de trazabilidad.
- Importación, exportación, historial, colaboración y seguridad.
- Cierre y ruta de práctica en un proyecto de QA.

## Identidad independiente de clientes

La academia es una funcionalidad de **ATLAS**, producto independiente. Las 18 lecciones y los ejercicios utilizan ejemplos de la propia plataforma: espacios de prueba, editor de diagramas, API de proyectos, guardado, navegación C1–C4 y trazabilidad. **No presentan ningún proyecto real de un cliente como propietario de ATLAS** y no cambian los nombres ni los datos de espacios existentes.

## Casos especiales

- **Sin proyecto, sin permiso o control oculto:** la lección sigue visible y aclara que el control no está disponible. No se fuerza acceso y no se oculta el motivo.
- **Modales del editor:** cuando el usuario abre un modal durante el tour, se oculta temporalmente la tarjeta del tutorial para no competir con el formulario; al cerrar el modal se recupera la misma lección.
- **Pantalla completa:** el tutorial se proyecta dentro del lienzo cuando ese elemento ocupa la capa fullscreen del navegador.
- **Responsive y posicionamiento:** en escritorio, la tarjeta se coloca junto al control destacado cuando hay espacio y se ajusta a la altura real disponible; en tablet y móvil se centra como panel inferior. El contenido y el temario tienen desplazamiento interno, mientras los botones de navegación permanecen visibles, incluso con lecciones largas, pantallas bajas o el temario abierto.
- **Atajos:** Escape cierra la guía; Alt+Flecha derecha / Alt+Flecha izquierda cambian de lección.
- **Seguridad y privacidad:** progreso y finalización en `localStorage` (`atlas.tutorial.progress.v1` y `atlas.tutorial.complete.v1`), nunca en el proyecto ni en la base de datos. No se usan `alert`, `confirm` ni `prompt`.

## Archivos añadidos

- `apps/web/src/features/tutorial/tutorial-content.ts`: contenido editable y orden de lecciones.
- `apps/web/src/features/tutorial/GuidedTutorial.tsx`: guiado contextual y navegación accesible.
- `apps/web/src/features/tutorial/TutorialExercises.tsx`: ejercicios simulados sin API.
- `apps/web/src/features/tutorial/tutorial.css`: estilos de la Academia, responsive y foco.
- `apps/web/src/features/tutorial/GuidedTutorial.browser.test.tsx`: pruebas Vitest.
- `scripts/tutorial-smoke.cjs`: validación React/jsdom sin depender de Rollup (solo para laboratorio).
- `apps/web/src/features/editor/AtlasEditor.tsx`: integración de launcher, anclajes y pausa ante modales.

## QA y límites de verificación

- TypeScript frontend y API: ejecutar `npm run typecheck`.
- Pruebas del componente: `npm run test:ui -w @atlas/web -- src/features/tutorial/GuidedTutorial.browser.test.tsx`.
- Pruebas integradas: `npm run test:ui`.
- Prueba sin Rollup para laboratorios Linux con dependencias del ZIP instaladas para Windows: `node scripts/tutorial-smoke.cjs`.
- Verificación visual manual recomendada: en 1920, 1650, 1366, 1024, 820, 768, 390 y 320 px, con sidebar abierto/cerrado, proyecto vacío y lector; comprobar que el tutorial no roba la edición y que los modales permanecen accesibles.

**Nota:** este parche no agrega un motor de onboarding persistido por usuario, ejercicios que verifiquen acciones reales en el backend, rutas personalizadas por rol ni analítica de aprendizaje. Son posibles extensiones posteriores. No confundas ejercicios simulados con operaciones reales.
