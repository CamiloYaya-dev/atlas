# ATLAS — Contexto maestro, diagnóstico y auditoría técnica de V4.8.1

**Fecha:** 12 de noviembre de 2026  
**Origen:** conversación «Diseñar plataforma de diagramas interactivos» del proyecto Cady + inspección del código entregado como `atlas.zip`.  
**Estado:** hotfix para distribución del editor; **NO** certificación integral del producto.

## 1. Visión de producto: qué es ATLAS y qué problema resuelve

ATLAS significa **Arquitectura conectada**. Su objetivo no es ser otro programa para dibujar cajas ni una carpeta de PNG/PDF: es **un modelo compartido, navegable y editable de la organización, sus procesos y sus soluciones tecnológicas**.

**Problema de origen:** cuando los flujos funcionales, historias, componentes, casos de uso y arquitectura se documentan en archivos aislados, se pierde el contexto y resulta difícil explicar el sistema tanto a negocio como a ingeniería. El usuario planteó la navegación desde una caja de alto nivel (ejemplo: «Zercano») hacia procesos concretos (por ejemplo, autenticación), sus subprocesos, elementos técnicos y documentación vinculada, pudiendo volver atrás sin abandonar el mismo espacio.

**Promesa de ATLAS:** una única fuente conceptual de elementos reutilizables, múltiples vistas del mismo sistema, profundización interactiva y relaciones rastreables entre la intención de negocio y la implementación. La experiencia debe servir tanto a directivos/analistas como a desarrolladores y arquitectos.

### Recorrido representativo

1. Entrar a un **espacio de trabajo** de una organización y elegir un **proyecto** autorizado.
2. Consultar un diagrama **C1** que representa el sistema y sus actores externos.
3. Entrar con doble clic en una caja vinculada a un diagrama hijo **C2/C3/C4** o en un proceso/subproceso, según el modelo que se haya diseñado.
4. Alternar entre perspectivas **funcional, mixta y técnica**, y filtrar contextos/dominios de un mismo diagrama.
5. Inspeccionar una caja: resumen, descripción, estado, autor, responsable, fechas, detalle técnico, enlaces a Jira/Azure DevOps/casos de uso y campos creados para ese tipo.
6. Investigar relaciones, dependencias, diagramas de secuencia, flujo de datos y matriz de trazabilidad sin duplicar fichas.
7. Proponer, editar y guardar cambios de forma controlada; visualizar colaboradores, consultar auditoría, examinar historial y resolver restauraciones mediante ramas cuando corresponde.

## 2. Decisiones acumuladas y vigentes

| Tema | Decisión vigente / implicación |
|---|---|
| Alcance | Piloto V4 **cerrado, local y con usuarios autorizados**; lanzamiento SaaS y monetización quedan para una fase posterior. |
| Tecnologías | Monorepo TypeScript; React 19/Vite/React Flow en web, Fastify en API, PostgreSQL con Docker local. |
| Capas | Separación de controladores, servicios y repositorios en backend; comandos de dominio de editor separados parcialmente. |
| Modelo | `ProjectDocument` contiene una sola colección `elements` por proyecto, `diagrams` que referencian los elementos y `fieldDefinitions`. |
| Diagramas | C4 C1/C2/C3/C4, procesos, secuencia, datos, trazabilidad y personalizados. |
| Vista | Funcional, mixta o técnica; filtros propios de diagramas; navegación jerárquica con vínculo de diagrama hijo. |
| Datos de caja | Propiedades de negocio y técnicas, autor, responsable, estado, fechas, enlaces externos y campos personalizados. |
| Autorización | Permisos atómicos para proyectos, tipos de diagramas, elementos, relaciones y operaciones. El backend debe hacer cumplir y filtrar las restricciones, no solo la UI. |
| Aislamiento | Membresía de un espacio no equivale a acceso universal a sus proyectos: cada proyecto tiene miembros y roles propios; el propietario de espacio conserva acceso. |
| Acceso | No hay alta pública; cuentas administradas mediante interfaz/CLI; sesiones revocables con cookies HttpOnly y protección CSRF. |
| Guardado | Autoguardado en JSONB versionado; compare-and-swap con 409, historial y control de cambios concurrentes. |
| Colaboración | SSE para cambios de versión y presencia; sincronización de documentos por API; fusión de ediciones independientes y rechazo de conflictos. |
| Restauración | No editar historial directamente: restaurar crea una **nueva revisión**; ramas permiten propuesta, previsualización, selección de campos en conflicto o reemplazo confirmado. |
| UX | Menú lateral ocultable, minimapa configurable y pantalla completa del diagrama; componentes modales/notificaciones propios. |
| UX prohibida | Nunca invocar `alert()`, `confirm()` o `prompt()` del navegador para flujos ATLAS. |
| QA | 100% de suites obligatorias aprobadas; cobertura aspirada >=95% en líneas, sentencias, ramas y funciones, global y por archivo. |
| Infraestructura piloto | PostgreSQL local Docker, backend y frontend separados; piloto vía ngrok HTTPS sin publicar DB ni API de forma independiente. |

**Importante:** documentaciones históricas V3 mencionan Supabase y un esquema de invitaciones diferente. Son antecedentes, **no** el contrato operativo de V4.8.1. Asimismo, el objetivo de una experiencia «tipo Git» se implementa actualmente para **ramas de restauración**, no como Git completo ni edición CRDT.

## 3. Arquitectura reconstruida del ZIP

```text
atlas/
├── apps/web/                  React / Vite / TypeScript / React Flow
│   └── src/
│       ├── features/editor/   AtlasEditor, comandos documentales, selección/grafo
│       ├── features/projects/ gestión de proyectos, versiones, ramas y diferencias
│       ├── features/workspaces/
│       ├── features/security/
│       ├── features/audit/
│       └── components/       componentes, overlays, nodos e inspector
├── apps/api/                  Fastify / acceso / datos
│   ├── migrations/            001 core, 002 historial, 003 ACL, 004 proyectos, 005 ramas
│   └── src/
│       ├── modules/projects/  controlador, servicio, repositorio, eventos SSE
│       ├── modules/workspaces/
│       ├── modules/access/
│       ├── modules/auth/
│       └── security/          identidad, sesiones, roles y permisos
├── packages/contracts/        modelo compartido y permisos, fusión colaborativa
├── packages/fixtures/         ejemplo de documentos
├── tests/e2e/                 escenarios Playwright
├── scripts/                   operación y QA por npm
└── docs/                      decisiones, despliegue y cierre local
```

### Persistencia y concurrencia

- Entidades compartidas: `ProjectDocument` (`schema:1`) con `elements`, `diagrams` y `fieldDefinitions`.
- Una caja visual (`DiagramNode`) apunta a un `elementId` del catálogo, por lo que una misma ficha puede aparecer en diagramas diferentes sin duplicar su información.
- Un diagrama contiene nodos, posiciones, relaciones (`DiagramEdge`) y categorías de filtro.
- El backend persiste el documento con versión monotónica y registra revisiones históricas; el guardado exige la versión base conocida. En V4.5 se añadió fusión colaborativa para cambios compatibles.
- Las ramas V4.8.1 se registran en `project_restore_branches` (migración `005_restore_branches.sql`), referencian versiones existentes y pueden marcarse `open`, `applied` o `discarded`.
- El servidor transmite por SSE números de versión y presencia; no envía documentos completos por ese canal. Los documentos se vuelven a consultar mediante API autorizada.

### Seguridad y alcance de controles que aparecen en el código

- Se comprueban roles por espacio y proyecto, con catálogo de capacidades de operación y visibilidad.
- La API dispone de CORS por origen, CSRF para mutaciones, sesiones basadas en cookies, rate limiting y ocultación de credenciales en logs.
- La API aplica proyecciones filtradas de documentos según permisos y comprueba permisos de escritura; los enlaces a proyectos ajenos no deben permitir fuga de datos.
- El bus SSE es **en memoria, de una instancia del API**, adecuado para el piloto local; no debe suponerse distribuido automáticamente entre múltiples instancias.
- Se examinaron las implementaciones, pero no se realizó una prueba de penetración ni una auditoría exhaustiva de todas las ramas de seguridad.

### Dónde se encuentran las principales interfaces

| Funcionalidad | Archivo o módulo principal |
|---|---|
| Shell, sidebar, barra, inspector, editor | `apps/web/src/features/editor/AtlasEditor.tsx` |
| CSS del editor | `apps/web/src/styles.css` |
| Render de cajas | `apps/web/src/components/organisms/AtlasNode.tsx` |
| Comandos para nodos, diagramas y relaciones | `apps/web/src/features/editor/domain/document-commands.ts` |
| Selector/filtros | `apps/web/src/features/editor/domain/graph-selection.ts` y `hooks/useGraphView.ts` |
| Historial, restauración y ramas | `apps/web/src/features/projects/VersionHistory.tsx` |
| Vista previa y diferencias | `VersionDiagramPreview.tsx`, `version-diff.ts` |
| Auditoría | `apps/web/src/features/audit/AuditPanel.tsx` |
| Backend de proyectos | `apps/api/src/modules/projects/` |
| Versionado/fusión | `packages/contracts/src/collaboration.ts` |
| Identidad y control de acceso | `apps/api/src/security/` y `modules/access/` |

## 4. Incidente: ambos botones dejan pantalla gris

### Hallazgo confirmado

Los controles «Ocultar menú lateral» y «Ampliar área de trabajo» hacían que la raíz React llevara la clase `.layout.expanded`. En la versión recibida, la regla era:

```css
.layout.expanded { grid-template-columns: 0 minmax(0, 1fr); }
.layout.expanded .sidebar { display: none; }
```

En CSS Grid, `display:none` **saca al sidebar del flujo**. Por colocación automática, `.main` pasa a la primera columna, que mide **0 px**. El usuario ve entonces el fondo gris vacío, aunque la aplicación no necesariamente ha lanzado una excepción de JavaScript. La segunda columna queda desocupada.

**Prueba de reproducción:** se ejecutó en Chromium una prueba usando el CSS original del ZIP. La anchura calculada de `.main` tras activar `.expanded` fue `0 px` tanto a 1440 como a 1024 px. Ambas pruebas fallaron como se esperaba.

**Arreglo:** la disposición expandida utiliza **una columna flexible** en lugar de una columna invisible + otra visible:

```css
.layout.expanded { grid-template-columns: minmax(0, 1fr); }
```

Además, el botón de la barra superior ahora determina si el sidebar *efectivamente* está oculto (`expanded || navigationCollapsed`) y permite recuperar la navegación en cualquiera de los estados. Los controles exponen estado accesible mediante `aria-expanded`/`aria-pressed` y no hacen guardados ni recrean el editor al alternar.

### Archivos modificados

- `apps/web/src/styles.css` — origen del bug corregido.
- `apps/web/src/features/editor/AtlasEditor.tsx` — coordinación coherente de los dos botones y estado accesible.
- `apps/web/src/features/editor/AtlasEditor.behavior.browser.test.tsx` — 3 pruebas de regresión a nivel componente: menú, ampliación y recuperación cruzada.
- `tests/e2e/layout.spec.ts` — 3 casos en Chromium real para 1440, 1024 y drawer móvil.
- `playwright.config.ts` — ruta opcional de Chromium del sistema para ejecutar tests en entornos de laboratorio; no altera el funcionamiento habitual en Windows.
- `README.md`, `CHANGELOG.md`, guía de V4.8.1 y este documento — contexto de entrega.

### Evidencia obtenida

| Comprobación | Resultado |
|---|---|
| Chromium + CSS original, 1440 px | **Falla reproducida:** `.main` = 0 px |
| Chromium + CSS original, 1024 px | **Falla reproducida:** `.main` = 0 px |
| Chromium + CSS corregido, 1440 px | **Pasa** |
| Chromium + CSS corregido, 1024 px | **Pasa** |
| Chromium + CSS corregido, móvil 760 px | **Pasa** (drawer) |
| TypeScript `npm run typecheck`, API y WEB | **Pasa** |
| Herramientas QA `npm run test:qa-tools` | **Pasa: 4/4** |
| Nuevas pruebas React / suite UI completa | **Pendiente de ejecutar en Windows** |
| `npm run test:unit` en laboratorio Linux | **Bloqueado por dependencias nativas de Windows incluidas en ZIP** |
| `npm run test:db`, E2E completo con PostgreSQL QA, cobertura, build | **No certificados en este laboratorio** |

**Sobre el límite de validación:** el ZIP cargado incluye `node_modules` para Windows (`rollup-win32` y `esbuild` Windows). El laboratorio Linux requiere sus dependencias nativas Linux para ejecutar Vitest/tsx; no hay acceso al registro npm para reponerlas. Se ejecutó TypeScript usando los enlaces locales de workspace restaurados y los casos Playwright mediante Chromium del sistema. No convertir esa limitación en un falso «100% de pruebas aprobadas».

## 5. Auditoría de producto: qué está y qué no debe confundirse

| Capacidad | Evidencia en V4.8.1 | Estado interpretado |
|---|---|---|
| Navegación multi-vista, tipos C4/procesos/secuencia/datos/trazabilidad | Contratos, editor, dominio y UI | Implementación presente; revisar recorridos reales |
| Reutilización de elementos y relaciones | `elements` compartidos + comandos y React Flow | Implementación presente |
| Metadatos, campos y enlaces | Contratos + inspector + personalización | Implementación presente |
| Usuarios, workspaces, proyectos y miembros | Controladores, roles, migraciones 001–004 | Implementación presente; QA multitenant obligatoria |
| ACL por operación/tipo/perspectiva | Paquete de permisos + backend | Implementación presente; pruebas adversariales necesarias |
| Colaboración y presencia SSE | `ProjectEvents`, API de presencia, cliente `EventSource` | Implementación para una instancia API |
| Autosave y control 409 | Servicio y repositorio de proyectos | Implementación presente; validar latencias/concurrencia |
| Historial, comparación y restauración | Backend + panel de historial | Implementación presente; QA con 2 usuarios obligatoria |
| Propuestas de restauración y resolución de conflictos | Migración 005, contrato de merge y panel de ramas | Implementación presente; **no** Git completo |
| BPMN 2.0 y UML formales/exportables | No hay motor formal dedicado | No confundir diagramas conceptuales con cumplimiento de estándar |
| Sincronización bidireccional Jira/ADO | Se permiten enlaces externos | Integración automática aún no evidenciada |
| Edición CRDT multi-instancia | Versiones/SSE/merge, hub local | No implementada a escala distribuida |
| SaaS público, facturación, cuotas | Piloto cerrado | Deliberadamente pospuestos |

## 6. Hallazgos adicionales y riesgos priorizados

1. **P0 — Pantallas grises (resuelto en este hotfix):** ambas rutas de control compartían una regla de CSS Grid defectuosa. Se reproduce y se valida en Chromium.
2. **P1 — Cierre de QA real (pendiente):** ejecutar en la máquina Windows con dependencias compatibles todas las suites, migraciones de QA, E2E, build y gate 95% por archivo. El éxito del TypeScript y de las 3 nuevas pruebas no sustituye el cierre completo.
3. **P1 — Colaboración/restauración (validación):** conservar escenarios con dos usuarios simultáneos, pérdida de red, restauración concurrente, permisos y fusión/rechazo 409; los cambios destructivos han de crear revisiones y no sobrescribir silenciosamente.
4. **P1 — Seguridad del piloto (verificación):** cookies, CSRF, CORS exacto, aislamiento de proyectos y restricción de ngrok; no exponer API/DB por separado. Las pruebas no autorizan registro público.
5. **P2 — Mantenibilidad:** `AtlasEditor.tsx` concentra la orquestación de editor, proyecto, usuarios y colaboraciones; `styles.css` agrupa numerosas reglas en líneas minificadas. Separarlos por funciones/composición facilitará regresiones y revisión de permisos, pero **no debe hacerse en el mismo parche correctivo**.
6. **P2 — Escalabilidad:** SSE en memoria + documento JSONB completo son compromisos razonables para el piloto; multi-instancia, límites/eficiencia de documentos y concurrencia a gran escala requieren diseño posterior.
7. **P2 — Documentación y onboarding:** README/CHANGELOG mezclan eras V3/V4; el ZIP recibido no incluía la guía V4.8.1 a la que apunta README. Se incorporó una guía de V4.8.1 y este documento para conservar la verdad vigente.
8. **P3 — Capacidades futuras:** motores de procesos BPMN/UML formales, sincronización Jira/ADO, adjuntos, auditoría/observabilidad avanzadas, monetización y despliegue SaaS son líneas posteriores al piloto, **no requisitos nuevos del hotfix**.

## 7. Orden de ejecución recomendado

**Ahora — estabilidad V4.8.1:** aplicar parche sin eliminar el proyecto original ni su volumen PostgreSQL; compilar y ejecutar pruebas; comprobar ambos controles con un proyecto real (incluyendo cambios no guardados, minimapa, inspector, fullscreen y vista de otro usuario).

**Después — cierre del piloto:** `npm run qa:local` y verificación manual multiusuario/ACL; corregir únicamente fallas demostradas; decidir si se cumple la meta de 95% por archivo. Realizar respaldo de PostgreSQL previo a operaciones que involucren migraciones.

**Posteriormente — producto:** refactorización dirigida por pruebas, instrumentación y observabilidad, formalización de notaciones, mejores herramientas de trazabilidad/colaboración y evaluación del SaaS, manteniendo el mapa funcional/técnico como núcleo del valor.

## 8. Instalación del parche en el proyecto existente

1. Detener el servidor frontend y, si hay piloto público, cerrar temporalmente el túnel. **No borrar ni recrear la base de datos.**
2. Conservar una copia del proyecto actual. Extraer el **ZIP de parche** en la raíz de `C:\Users\MSI1\Desktop\atlas` aceptando reemplazar solo los archivos listados.
3. No sustituir `.env`, `node_modules`, `backups`, volúmenes Docker ni variables secretas. **No se agregan migraciones para este hotfix de layout.**
4. Ejecutar por separado desde PowerShell:

```powershell
npm run typecheck
npm run test:ui
npm run test:unit
npm run test:db
npm run test:e2e:local
npm run build
```

5. Revisar especialmente los 3 tests React nuevos y los 3 tests Playwright de `layout.spec.ts`; validar a mano «Ocultar / Mostrar menú lateral» y «Ampliar / Restaurar distribución» en dos tamaños de navegador. Si se desea aprobar formalmente la V4, ejecutar además `npm run qa:local`, incluido el gate de cobertura.
6. Si alguna suite falla, conservar su primer error y el resultado completo, sin declarar release aprobada y **sin borrar datos para intentar corregirlo**.

**Paquete completo alternativo:** se entrega el código fuente completo sin dependencias instaladas ni secretos `.env`; para actualizar el piloto existente, es más seguro **aplicar el parche** sobre tu carpeta actual.


## Adenda 12/11/2026 — Expansión y crear cajas desde fullscreen

**Ocultar menú lateral** solamente controla navegación; **Ampliar área de trabajo** oculta la sección completa que contiene título, descripción y filtros, además de aprovechar el espacio lateral. La barra global queda visible. Para no perder el camino de vuelta, al ampliar aparece «Restaurar distribución» dentro del lienzo.

«Agregar caja» queda inmediatamente antes de «Pantalla completa del diagrama» dentro del lienzo, con las mismas comprobaciones de permisos. Su diálogo es un React Portal dentro de la sección fullscreen (nativa o alternativa CSS), porque los modales fuera de la jerarquía del elemento fullscreen no son visibles por encima de la capa fullscreen del navegador. El editor y las fichas no se desmontan al cambiar de distribución.

**Verificaciones realizadas:** compilación de tipos backend y frontend, cinco pruebas Chromium de layout y pruebas del script de QA. Las pruebas React agregadas todavía deben ejecutarse en Windows; no se declara cobertura ni aprobación total.
