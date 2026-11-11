# ATLAS V3 — SaaS base

ATLAS conecta arquitectura **C4**, diagramas de procesos, secuencias, datos y trazabilidad entre requerimientos, APIs, componentes y casos de uso.

Esta entrega es **código fuente V3**, con **modo demo local** automático y **modo Supabase real** cuando se configura el proyecto. No es un servicio desplegado ni una integración con Jira/Azure DevOps.

## Funcionalidades

- React 19 + TypeScript + Vite + React Flow.
- Navegación entre diagramas C1/C2/C3/C4, procesos, secuencia, datos, trazabilidad y vistas nuevas.
- Editor: crear diagramas, crear y reutilizar elementos, conectar cajas, arrastrar, quitar y renombrar relaciones.
- Perspectivas funcional, mixta y técnica; filtro de procesos y dependencias.
- Catálogo compartido de elementos; doble clic para profundizar, y selección para inspeccionar relaciones.
- Ficha por elemento: resumen, descripción, implementación técnica, autor, responsable, estado, fechas y links (Jira, DevOps, diagramas externos, etc.).
- Campos personalizados específicos por tipo de elemento.
- Varias organizaciones (`workspaces`), proyectos y roles `owner/admin/editor/viewer`.
- Login/registro por Supabase Auth, aislamiento de proyectos por RLS.
- Guardado automático del documento con **versionado optimista por proyecto**, exportación e importación JSON.
- Invitaciones con enlace de un solo uso, válidas por siete días, cuando hay Supabase.

## A. Probar en modo DEMO (sin claves)

1. Instala Node.js 22 o superior.
2. Abre terminal en la carpeta del proyecto.
3. Ejecuta:

```bash
npm install
npm run dev
```

4. Abre `http://localhost:5173`. Sin variables de entorno, la app entra en **Demo local**.
5. La cuenta de muestra **no es un usuario autenticado**: toda la información está en `localStorage`, por dispositivo y navegador.
6. Para compartir o respaldar los diagramas de la demo, usa **Exportar JSON**.

La carpeta adicional `ATLAS_V3_Demo_Local.html` (fuera de este proyecto ZIP) permite explorar el flujo visual anterior de V2 con dos espacios locales; no sustituye la aplicación React V3 ni autentica usuarios reales.

## B. Activar cuentas reales y nube con Supabase

1. Crea un proyecto en https://supabase.com/ .
2. En **SQL Editor**, ejecuta el contenido de `supabase/001_atlas.sql` una sola vez.
3. En **Authentication → Providers**, habilita correo y contraseña. Configura la URL del sitio y confirmación de emails según el entorno.
4. Copia `.env.example` a `.env.local` y completa:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICA
```

5. Reinicia `npm run dev`, crea cuenta y verifica el correo si está activada la confirmación.
6. Crea un espacio, un proyecto, un diagrama y prueba el guardado.
7. Para invitar a otra cuenta, entra como Propietario o Administrador, haz clic en **Invitar** y comparte el enlace.

**Seguridad:** introduce solo la clave pública/publishable en `VITE_`. **Nunca** pongas la clave `service_role` o secret en variables `VITE_` ni en el código fuente. La seguridad de los datos depende de las políticas SQL, no de ocultar acciones en el frontend.

## C. Publicar en Cloudflare Pages

1. Sube el código a un repositorio GitHub o GitLab privado.
2. En Cloudflare, crea un proyecto Pages e importa el repositorio.
3. Configura `Build command` = `npm run build`, `Output directory` = `dist`.
4. Añade las dos variables `VITE_SUPABASE_*` en la configuración de producción y de Preview si corresponde.
5. Publica y registra la URL pública dentro de **Supabase → Authentication → URL Configuration**, junto con las URLs de retorno autorizadas.
6. Crea entornos de Supabase separados para desarrollo y producción antes de publicar con datos reales.

La interfaz está diseñada como SPA estática. Para el despliegue cloud no necesitas mantener un servidor Node.js funcionando permanentemente: Node se utiliza para compilar el frontend.

## Estructura

```
src/
  App.tsx           Interfaz y editor React Flow
  demo.ts           Datos ficticios y diagramas iniciales
  lib.ts            Cliente Supabase y adaptador local
  types.ts          Modelo de elementos, diagramas y campos
  styles.css        Estilos
  main.tsx          Punto de entrada
supabase/
  001_atlas.sql     Workspaces, miembros, proyectos, documentos, RLS e invitaciones
.github/workflows/
  build.yml         Verificación de compilación en GitHub Actions
```

## Modelo de persistencia

Los elementos están almacenados **una sola vez por proyecto** en el campo `document.elements`. Cada diagrama tiene su propia lista de nodos, posiciones y conexiones y apunta a esos mismos elementos mediante `elementId`. Un elemento puede aparecer en varios diagramas sin duplicar su ficha.

El documento completo se guarda como `JSONB` en `project_documents`, con `version` monotónica. La función `atlas_save_document` realiza un `UPDATE ... WHERE version = expected` y rechaza una escritura desactualizada con `ATLAS_VERSION_CONFLICT`.

Para simplificar V3 se guarda el documento entero; esto funciona bien para proyectos pequeños y medianos. **Para colaboración simultánea a gran escala**, convendrá evolucionar hacia cambios parciales/CRDT, audit log y límites de tamaño.

## Límites actuales y siguientes hitos

- **Sin pagos ni cuotas comerciales**, no hay aún Stripe/Paddle/Mercado Pago.
- **Sin colaboración en vivo**; el conflicto de versión se detecta y evita una sobrescritura, pero no ofrece fusión automática.
- **Sin edición BPMN/UML formal**; las vistas de procesos y secuencias son nodos/relaciones conceptuales. Para conformidad BPMN 2.0 incorporar `bpmn-js`.
- **Sin sincronización automática Jira/Azure DevOps**, por ahora links configurables.
- Sin permisos por diagrama individual: los roles rigen a nivel de espacio de trabajo.
- No incluye adjuntos binarios; se gestionan enlaces externos y JSON.
- Las fechas/autor se pueden editar como metadatos; para auditoría legal real se requiere un registro inmutable del backend.
- No se han implementado límites de tarifas, protección contra abuso por volumen, rate limits, observabilidad, backups operativos ni pruebas E2E en despliegue real.
- El frontend y la lógica se han preparado para funcionar con Supabase, pero **las rutas de autenticación y SQL deben probarse en tu instancia real** después de configurarla.

## Checklist antes de abrir registro público

- [ ] Ejecutar migraciones SQL en staging, probar RLS con dos usuarios de espacios distintos.
- [ ] Revisar privilegios, funciones SECURITY DEFINER, tokens de invitación y expiración.
- [ ] Habilitar SMTP transaccional con rate limits, verificación de email, protección anti-bots y alertas.
- [ ] Establecer backups, retención, política de privacidad, términos y límites de uso.
- [ ] Hacer pruebas de carga, monitoreo, presupuestos y cuotas desde backend.
- [ ] Ensayar registros, accesos, concurrencia y restauración de datos.

## Licencias y atribuciones

React Flow / `@xyflow/react` se distribuye bajo MIT; la aplicación conserva la atribución de React Flow en el lienzo. Revisa las licencias de dependencias antes de distribuir comercialmente.
