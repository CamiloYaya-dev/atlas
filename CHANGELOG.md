## 2026-11-13 · UML componentes, estructura compuesta, despliegue y paquetes
- Ensamblaje de interfaces con bola encajada en socket; etiquetas desplazadas para no tapar el símbolo.
- En estructura compuesta: clasificador estructurado, parte, rol de referencia, colaboración y puerto acoplado a borde; conectores cuadrados entre partes.
- En despliegue: cuatro clases de elemento, nodos/entornos anidados, iconos de dispositivo y solo comunicación o despliegue para conexiones nuevas.
- En paquetes: únicamente paquetes y subpaquetes reales; jerarquías anidadas con validación de ciclos y posiciones relativas.
- Reglas de extremos por semántica UML protegidas en frontend y backend, con compatibilidad de lectura de diagramas antiguos.
- 47 regresiones específicas del grafo y JSON de QA vinculado con cuatro vistas; sin migraciones ni cambios de licencia.
- Suite UI completa y cobertura ≥90% pendientes de ejecución con dependencias nativas compatibles.

## 2026-11-13 · UML estructural: clases, objetos y componentes (parche)
- Paquetes reales con pertenencia de nodos por vista, drag & drop y cambio en Inspector; coordenadas relativas, validación backend y permisos.
- Atributos y operaciones UML tipadas (visibilidad, longitud, multiplicidad, parámetros y retorno), slots de objetos con clase y valor, componente con símbolo UML.
- Líneas estructurales específicas: asociación, agregación, composición, generalización, realización, dependencia, interfaces proporcionadas/requeridas y ensamblaje; multiplicidad y roles en extremos.
- Fichas de exportación avanzadas incluyen estructura UML (se mantiene la autorización premium).
- Contrato/validación compatibles con documentos anteriores, sin migraciones; 35 pruebas de grafo específicas y ejemplo importable de tres vistas UML más trazabilidad.

## ATLAS V4.8.1 — Editor de relaciones y navegación precisa (13 noviembre 2026)

- Corregida validación de conexiones del laboratorio técnico C2 para reconocer relaciones correctas independientemente del sentido de dibujo.
- Modal de relación: edición de flechas, tipos de trazo y recorrido; eliminación con confirmación, separación de permisos ACL y persistencia en historial.
- Ocho puntos de conexión por caja, con tres superiores y tres inferiores, usando conexión flexible.
- Profundización a una caja exacta de una vista vinculada, centrado de cámara y navegación hacia atrás.
- Academia: indicación visual de dónde crear los campos personalizados desde el Inspector y ayuda contextual para C2.
- Compatibilidad retroactiva con JSON existentes y 15 pruebas de regresión sin dependencias nativas, además de las pruebas browser añadidas.

## V4.8.1 — Asistencia contextual de misiones e Inspector (2026-11-12)

- El laboratorio orienta al alumno tras 1, 2 o 3 minutos configurables de inactividad (o desactivado, por defecto 2). La preferencia es local; no hay seguimiento en el backend.
- Borde animado para el primer criterio pendiente; pie persistente «Sube/Baja» cuando la acción está fuera del área visible; nunca hay scroll automático por inactividad.
- Cuatro comprobaciones acreditables adicionales: Inspector de HU, campo de lista funcional, Inspector de endpoint y campo técnico de texto. Las insignias se basan en el documento guardado.
- Acciones contextuales para abrir formularios y fichas reales, sin creación ni guardados automáticos.
- Pausa de ayuda durante modales, guardados, errores y actividad; soporte de movimiento reducido.
- Sin migraciones, cambios API o dependencias nuevas. TypeScript y pruebas aisladas React/jsdom verificadas; Vitest general pendiente en Windows.

## V4.8.1 — ATLAS Academy: laboratorio con insignias (2026-11-12)

- Nuevo acceso «Misiones» sin eliminar el recorrido explicativo de 18 lecciones.
- Creación explícita de workspace de formación y proyecto de práctica mediante APIs existentes; sin tocar proyectos personales o clientes.
- 3 insignias ligadas a comprobaciones del documento guardado: funcional (C1, procesos, HU/RF y casos de uso), técnico (C2/C3/C4 y trazabilidad), e integración (la misma matriz en perspectiva mixta).
- Seis diagramas sugeridos, cajas preconfiguradas en formularios reales, guía para relacionar y reutilizar elementos, y enlaces de profundización.
- Interfaz responsive; soporte en pantalla completa; no utiliza ventanas nativas; mantiene permisos del backend.
- Pruebas de lógica, jsdom y TypeScript añadidas. Sin migraciones ni dependencias nuevas. Vitest completo pendiente en entorno Windows.
- Documentación: docs/ACADEMIA_MISIONES_PRACTICAS.md.

## V4.8.1 — Ajustes de área de trabajo y creación en fullscreen (2026-11-12)

- «Ampliar área de trabajo» oculta la cabecera completa (título, descripción, exportar/importar) y la barra de filtros; conserva la barra global del proyecto.
- «Restaurar distribución» aparece dentro del lienzo cuando está ampliado, para que nunca quede oculto el control para volver.
- «Agregar caja» pasa a estar dentro del lienzo, junto al control de pantalla completa, con los mismos permisos de edición.
- El diálogo de creación se muestra dentro del elemento fullscreen mediante React Portal, tanto en pantalla completa nativa como en alternativa CSS.
- Pruebas React y Playwright agregadas; TypeScript API/web y 5 pruebas Chromium de distribución aprobaron. Falta ejecutar la suite React/Vitest completa en Windows: el runner no inicia aquí por un módulo nativo Linux de Rollup ausente.
- Sin cambios de API, migraciones, base de datos ni modelo de permisos.

## V4.8.1 — Hotfix del layout del editor (2026-11-12)

- Reparado CSS Grid al ocultar sidebar: el `main` pasaba a columna de 0px y se mostraba pantalla gris.
- Botones de menú y ampliación con restauración coherente y estados accesibles.
- Nuevas pruebas React y 3 pruebas Chromium de layout desktop/móvil; el CSS original falló y el corregido pasó en Chromium.
- Sin migraciones, sin cambios de API ni de permisos. TypeScript verificado; QA completa en Windows pendiente.

## 4.8.1 — Restauración revisable, presencia y ergonomía del lienzo

- Restauración íntegra para propietario; ramas de recuperación con resolución de conflictos por campo.
- Protecciones contra restauraciones destructivas con colaboradores conectados.
- Sidebar/minimapa configurables, pantalla completa nativa con fallback.
- Protección contra traducción automática del DOM React y mejoras en diagnóstico.
- Migración aditiva 005_restore_branches.sql; sin dependencias nuevas.

## ATLAS V4.8.0 — Hallazgos de la prueba funcional (12/11/2026)

- Presencia por usuario único, no por pestaña/conexión; caducidad de sesiones SSE.
- Restauración de versiones con modal propio y confirmación explícita, sin ventanas nativas.
- Actividad y auditoría en tabla con filtros parametrizados y paginación por cursor.
- Tipos de visualización con nombres y explicaciones de uso.
- Categorías dinámicas por diagrama para combinar varios contextos en C1/C2/C3/C4 y procesos.
- Compatibilidad de lectura con diagramas anteriores, sin nuevas migraciones.
- Ver [GUIA_V4_8_PRESENCIA_FILTROS_HISTORIAL.md](GUIA_V4_8_PRESENCIA_FILTROS_HISTORIAL.md).

---

# Historial ATLAS

## V4.3.0 — Calidad automatizada

- Suite unitaria para editor, diagramas C1-C4, relaciones, fichas, campos, permisos, contraseñas y HTTP.
- Matriz automática por 9 tipos de diagrama, 14 tipos de elemento y 3 tipos de relación.
- Corrección de referencias mutables en documentos filtrados por roles.
- Rechazo de relaciones duplicadas por par origen/destino y de autoconexiones al guardar.
- Extractores puros `document-commands.ts` y `graph-selection.ts` utilizados por el editor React.
- Construcción Fastify separada en `app.ts` para pruebas de API por inyección.
- Pruebas de integración con PostgreSQL QA exclusivo (no BD de desarrollo).
- Playwright para recorridos de login, navegación, edición, políticas y lector.
- Scripts de npm `test:unit`, `test:db`, `test:e2e:local`, `test:full`.
- CI GitHub Actions con dos trabajos: API/BD + navegador.

**Validación:** 84 pruebas unitarias aprobadas localmente con transpilador de evaluación; suite Docker/Chromium no ejecutada todavía. No se declara 100% de cobertura.

---
# Historial de entregas

## Hotfix — typecheck de Fastify (11/11/2026)
- Corrige `TS18046` en `apps/api/src/server.ts` (errores recibidos como `unknown`).
- Conserva status HTTP y mensajes seguros sin exponer errores internos.
- No modifica migraciones ni datos de PostgreSQL.
- Prueba pendiente: typecheck de todo el monorepo con `node_modules` instalados en Windows.

## 4.1.0 — estructura y ambientes
- Conserva editor navegable V3 y V4.
- Frontend: módulos de API por dominio y hook de grafo extraído.
- Backend: controladores, servicios y repositorios por contexto.
- CORS seguro por ambiente, rate limiting, readiness, TLS obligatorio en PROD.
- `002_document_history.sql`: versiones históricas en transacción.
- SQL migrator con lock y checksum; soporta `MIGRATIONS_DATABASE_URL`.
- PostgreSQL Docker LOCAL y QA aisladas; tests; scripts Windows.
- Plan de despliegue concreto Cloudflare Pages + Render + Supabase DEV/PROD.

Limitaciones y pruebas pendientes documentadas en `ESTADO_Y_LIMITACIONES.md`.

## 4.2.1
- Ejecución/depuración centralizadas en npm scripts y utilidades Node multiplataforma.
- Eliminados BAT del paquete; arranque con `npm run dev:all`.
- Bootstrap interactivo con contraseña oculta y sin credenciales por defecto.

## V4.2.2 — Corrección de crypto.scrypt

- Corrige TS2554 en `apps/api/src/security/password.ts`, sin alterar formato ni parámetros de hashes existentes.
- La promesa utiliza la API callback de Node.js con opciones explícitas.


## 4.3.1 — Reparación de integración y coverage verificable

- Regresión 403 en primer guardado: proyección completa de campos para rol con `field.configure`.
- Test de integración actualizado al esquema de roles con `role_id`.
- Playwright Windows: evita ejecutar `node.exe` mediante cmd.exe.
- c8, reporte agregado HTML/LCOV/JSON y umbral 95 % por archivo en cuatro métricas.
- CI ejecuta la verificación de coverage y conserva los informes.
- No se declara cobertura 95 % alcanzada; requiere ejecutar y ampliar pruebas.

## 4.6.0 — Candidato de cierre V1 funcional (2026-11-12)
- Histórico de diagramas en SVG, diferencias de revisiones y restauración documentada como NUEVA versión con comprobación de concurrencia y permiso de propietario.
- Consulta paginada de `audit_events` con ACL `workspace.audit.view`, interfaz Actividad y metadatos filtrados.
- Renombrado de proyectos con permiso `project.rename` y registro de auditoría.
- Pruebas de tres perfiles QA, sesiones independientes, colaboración SSE y control de información de presencia.
- Restauración `pg_dump -Fc` en bases nuevas, con checksum, validación y recuperación paralela, sin tocar la base activa.
- Control original de cobertura sin modificación; ver `CIERRE_V1_FUNCIONAL.md` para certificación pendiente.

## 4.7.0 — Accesos independientes por espacio y proyecto (piloto)
- Migración incremental `004_project_access.sql` con miembros por proyecto y conservación de accesos previos.
- Proyectos nuevos privados por defecto, roles independientes por proyecto, revocación y ACL en todas las rutas.
- Editar y eliminar proyectos con permisos atómicos; administrar nombre y eliminar espacios vacíos.
- Pantallas de administración, permisos y pruebas de escenarios multiusuario con tres proyectos.
- Endurecimiento de SSE y auditoría ante revocaciones y cambios de roles.

**Candidato a validación**: no declarar QA completo hasta ejecutar `typecheck`, pruebas unitarias, React, PostgreSQL y E2E en Windows.

### V4.8.1 — ATLAS Academy (tutorial interactivo)
- Botón «Aprender ATLAS» en barra superior y barra lateral; guía de 18 pasos orientada a negocio y tecnología.
- Resaltado contextual de controles reales, navegación por temario, ejercicios simulados, cierre y progreso local.
- Tutorial no destructivo y disponible para lectores, proyectos vacíos y móviles; pausa ante modales, soporte fullscreen.
- Pruebas de comportamiento y manual de uso: `docs/TUTORIAL_INTERACTIVO_V4_8_1.md`.

### V4.8.1 — ATLAS Academy: identidad y responsive (2026-11-12)
- Se retiran todos los ejemplos y referencias a un cliente específico de las 18 lecciones y ejercicios; ATLAS se explica mediante su propio ecosistema y casos de uso. No se renombran espacios ni proyectos persistidos.
- Cálculo de posición del panel a partir de su altura real y del control señalado; se mantiene dentro del viewport en pantallas de escritorio.
- Vista inferior centrada para tablet y móvil; cabecera y botones de navegación siempre visibles, y contenido/temario desplazables por separado.
- Pruebas de regresión de identidad y posicionamiento, más verificación en nueve tamaños de Chromium.
- Sin migraciones, sin API adicional y sin modificaciones de ACL o documentos de proyectos.

## ATLAS V4.8.1 — Relaciones paralelas y guía C1–C4 (2026-11-13)

- Corrige el bloqueo en frontend, comandos de dominio y backend que impedía varias relaciones entre las mismas cajas.
- Añade representación de carriles independientes (rectos, curvos y ortogonales), sin perder dirección, flechas, etiquetas ni edición individual.
- Habilita los ocho puertos como entrada/salida mediante ConnectionMode.Loose.
- Identifica C1/C2/C3/C4 en la barra lateral y en las cajas que vinculan otra vista.
- La Academia explica los niveles y guía la selección de Sistema C1 → Servicio C2 → Componente C3, resaltando la configuración de vista vinculada en el Inspector.
- Añade pruebas para conexiones múltiples, rutas y render, salvaguardando permisos y compatibilidad.
- No altera el esquema PostgreSQL ni requiere migraciones.

### 4.8.1 — Exportación de imágenes y licenciamiento (piloto de funciones comerciales)
- Exportación por diagrama PNG/JPG desde backend con marca de agua obligatoria sin licencia comercial.
- Entitlements por organización y catálogo de features extensible; emisión/revocación exclusiva de administración.
- Procedencia HMAC-SHA256 embebida en metadatos y auditoría append-only; endpoint de verificación de integridad.
- Nuevo modal Exportar mantiene JSON y añade PNG/JPG, consulta derechos y bloquea exportaciones con cambios no guardados.
- Migración aditiva 006. Dependencia `sharp` para Windows/Linux. Véase docs/LICENCIAS_EXPORTACION_IMAGEN_V4_8_1.md.

## ATLAS V4.8.1 — exportación fiel, control de licencias y corrección QA (13/11/2026)
- Captura visual directa del viewport real de React Flow para exportar PNG/JPG; conserva conexiones y estilos visuales en vez de dibujar rutas aproximadas. El backend nunca acepta el estado de licencia desde el navegador: watermark, codificación, firma y auditoría siguen siendo tareas del servidor.
- Pantalla «Licencia y suscripción ATLAS» por organización: FREE/PRO y operaciones administrativas de activación o revocación de prueba. Utiliza los endpoints existentes GET /workspaces/:id/license y PUT /admin/workspaces/:id/license y requiere platformAdmin para cambios.
- Corrige 68 regresiones encadenadas de UI por mocks de React Flow sin useReactFlow, además de actualizar aserciones obsoletas sobre relaciones paralelas.
- Añade pruebas unitarias de captura procesada PNG/JPG, exclusión de marca con licencia y rechazo de payloads; pruebas UI del panel de licencias.
- Mantiene las puertas QA 90%+ global y por capa y 95% por archivo, sin exclusiones artificiosas. La cobertura completa debe re-medida en Windows con PostgreSQL QA aislado; no se afirma haberla alcanzado en esta entrega.

### Hotfix QA: `test:ui` y `test:coverage` (2026-11-12)
- Se añaden al mock de React Flow los símbolos `ConnectionMode` en los dos conjuntos de pruebas del editor, y `useReactFlow` en el mock de autenticación, que ya utiliza `AppInner`.
- El test operativo de cobertura genera una credencial temporal independiente del editor de QA al poblar exclusivamente `atlas_test`, evitando el fallo «Faltan credenciales editor QA».
- Se mantienen todas las pruebas, las métricas y el umbral >=90% sin exclusiones nuevas; el estado del umbral se debe verificar con la ejecución completa en Windows.

## V4.8.1 — Parche exportación avanzada premium y conectores (13/11/2026)

- Flechas de relaciones paralelas con tramo terminal perpendicular a los puertos superiores/inferiores y horizontal en laterales.
- Eliminar duplicados «Misiones» y «Renombrar» de barra superior (se conservan accesos laterales).
- Capacidad `diagram.export.advanced` en backend con control de licencia por organización.
- Selección por caja y campo: imagen, diccionario o excluir. Incluye relaciones/vínculos y personalizados.
- Exportación HTML autónoma de diccionario en ZIP junto con PNG/JPG firmados. Sin migraciones ni nuevas dependencias.
- Nuevas pruebas unitarias, de UI y regresión independientes de binarios nativos.

## 2026-11-13 · ATLAS V4.8.1 — UML y fichas exportables
- Corrección de fichas de Inspector fuera de la geometría del grafo en imágenes; rutas, nodos y puertos conservan su render real.
- Nueva elección de PDF, Word (.docx) o HTML para fichas documentales de exportación PRO; «Diccionario» pasa a «Fichas de elementos».
- Retirado acceso superior redundante «Aprender ATLAS»; sigue en menú lateral.
- Catálogo agrupado de 14 vistas UML con paletas y tipos de relaciones específicos; diagrama de casos de uso con actor representado como persona y óvalo; elementos reutilizables y navegación a caja concreta desde trazabilidad.
- Validaciones de compatibilidad y permisos en backend, sin migraciones.
- Véase `docs/ATLAS_UML_Y_EXPORTACION_FICHAS_2026-11-13.md` para alcance y limitaciones del soporte UML.

### 13/11/2026 · UML 2.5.1, conectores normativos y QA tutorial
- Registro único de relaciones UML de las 14 vistas con dirección, trazo y terminales SVG según tipo.
- Control de notación en frontend/API, renderizado compatible con relaciones históricas sin mutarlas.
- Rombos blanco/negro, triángulos, bola/socket, orientados por puertos; nuevas asociaciones navegables por tipo.
- Mejoras visuales para decisiones, bifurcaciones, pseudostates y líneas de vida.
- Test UI de tutorial navega por Temario para evitar seis actualizaciones pesadas bajo cobertura.
- Documentación en `docs/UML_2_5_1_NOTACION_Y_QA_2026_11_13.md`. Conformidad normativa total no declarada.

## Hotfix — ensamblaje UML y redimensionado por vista (13/11/2026)

- Ensamblaje orientado a la tangente del recorrido SVG real, con máscara localizada para evitar trazos cruzando la bola/socket.
- Ocultar delegación de nuevos conectores en estructura compuesta, conservando visualización histórica.
- Ancho/alto opcional por aparición de caja, resize desde esquinas e Inspector, validación de servidor, reanclaje de puertos y límites para contenedores.
- 5 nuevas pruebas enfocadas y actualización de mocks React Flow (`NodeResizer`).
