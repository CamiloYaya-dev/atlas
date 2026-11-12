# ATLAS 4.7 — Espacios, proyectos y permisos independientes

## Qué cambia

- **Espacio de trabajo**: agrupación de proyectos y miembros. Los permisos de espacio controlan `project.create`, `workspace.rename`, `workspace.delete`, `workspace.members.manage`, `workspace.roles.manage`, `workspace.audit.view`.
- **Proyecto**: recurso privado, asociado a **un** espacio. Una persona solo lo ve si fue asignada como miembro a **ese proyecto**, **salvo el propietario del espacio**, que conserva acceso completo a todos sus proyectos.
- **Rol por proyecto**: cada usuario asignado puede tener un rol distinto en cada proyecto, incluyendo roles personalizados definidos en el espacio; el rol determina `project.read`, `project.rename`, `project.delete`, `project.members.manage` y capacidades de diagramas, cajas y relaciones.
- **Propietario del proyecto**: quien lo crea recibe el rol de propietario del proyecto (independiente del rol que tenga en el espacio). No es posible retirarle el rol de propietario desde el gestor de miembros.
- **Seguridad API**: comprobación en el backend para listado, documentos, versiones, exportación/importación, guardado colaborativo, SSE y presencia. Adivinar la URL de otro proyecto devuelve 404.
- **Administración**: nuevo botón «Administrar espacio» junto al selector de espacios y «Administrar proyecto» debajo del listado de proyectos. El primero permite cambiar nombre y eliminar un espacio vacío; el segundo permite renombrar, eliminar y asignar o retirar miembros.

## Ejemplo requerido

Con tres proyectos (P1, P2, P3) y tres usuarios (U1, U2, U3):

| Usuario | P1 | P2 | P3 |
|---|---|---|---|
| U1 | Editor | Lector | Sin acceso |
| U2 | Sin acceso | Editor | Sin acceso |
| U3 | Sin acceso | Sin acceso | Lector |

Un mismo usuario puede pertenecer a varios espacios y desempeñar roles diferentes en sus proyectos. Los usuarios deben ser miembros del espacio primero, pero **esa membresía no da lectura automática a todos sus proyectos**.

### Cómo asignar

1. El administrador principal crea las cuentas (no existe registro público).
2. En **Accesos → Miembros**, el responsable del espacio añade las personas al espacio con su rol general.
3. En **Administrar proyecto**, asigna únicamente a las personas que deben tener acceso y selecciona su rol para ese proyecto.
4. Puedes crear roles personalizados en **Accesos → Roles**. Los permisos asociados al rol son una plantilla compartida: si modificas ese rol, cambian los permisos de **todos los proyectos** en los que se haya asignado.
5. Para revocar solo el acceso a P2, retira a la persona de P2; los demás proyectos siguen intactos. Si la retiras **del espacio**, PostgreSQL revoca automáticamente sus membresías en todos los proyectos de ese espacio.

## Migración SIN perder progreso

La migración `004_project_access.sql` es incremental. Añade la tabla `project_members`, conserva proyectos, diagramas, historial y cuentas existentes, y **copia los accesos que ya tenían los miembros de los espacios en los proyectos existentes** para no bloquear a nadie inesperadamente. Cuando un proyecto ya existente tenga permisos demasiado amplios, entra en «Administrar proyecto» y quita los accesos innecesarios. Todos los proyectos **nuevos** empiezan privados, asignados solo a su creador y al propietario del espacio.

Antes de instalar, crea una copia de PostgreSQL. La eliminación de un proyecto es **definitiva** (incluye su historial), y exige escribir exactamente su nombre en una confirmación. La eliminación de un espacio está bloqueada cuando contiene al menos un proyecto; no hay borrado en cascada de proyectos a través de ese botón.

## Instalación en Windows durante el piloto

1. Detén con `Ctrl+C` tanto ngrok como `npm run pilot:start`. Deja Docker y su volumen funcionando.
2. En `C:\Users\MSI1\Desktop\atlas` ejecuta `npm run db:backup`. Guarda fuera del equipo una copia adicional si el piloto tiene datos importantes.
3. Extrae **únicamente el parche** V4.7 sobre la raíz del proyecto, aceptando reemplazar archivos. No borres `.env`, `node_modules`, `package-lock.json`, `backups` ni volúmenes Docker.
4. Ejecuta **`npm run db:migrate`** (debe aparecer `004_project_access.sql` como aplicada). Nunca ejecutes una versión anterior del código contra la base ya migrada sin analizar compatibilidad.
5. Ejecuta los comandos de validación siguientes. `test:db`/`test:e2e:local` utilizan exclusivamente `atlas_test` en el puerto **5433**, no la base activa.

```powershell
npm run typecheck
npm run test:unit
npm run test:ui
npm run test:db
npm run test:e2e:local
npm run build
npm run pilot:check
```

6. Solo cuando estas validaciones pasen, reinicia `npm run pilot:start` y, en otra consola, `ngrok http 4173 --url https://airedale-summary-especially.ngrok-free.app`.

## Verificación manual imprescindible

- Crea U1/U2/U3 como cuentas de prueba y hazlos miembros del espacio.
- Crea P1/P2/P3. Antes de asignarles proyectos, inicia sesión como cada usuario: el listado de proyectos debe estar vacío.
- Asigna los accesos según el ejemplo de arriba; comprueba con tres navegadores que solo aparecen los proyectos autorizados.
- Como U3, prueba pegar directamente el enlace de API de P2: debe responder 404. Como U2, intenta guardar P1 por API: también debe rechazarse.
- Prueba roles diferentes en P1 y P2 para U1: la edición debe habilitarse solo donde se concedió permiso.
- Revoca U2 de P2: ya no debe poder leerlo ni mantener SSE de ese proyecto; comprueba que U1 conserva su acceso a P2.
- Renombra un proyecto y el espacio; confirma que el resto de nombres y datos se conservan. Prueba eliminar un **proyecto de prueba**, no uno con datos valiosos; confirma que no afecta a los demás.
- Intenta eliminar un espacio con proyectos: ATLAS debe bloquearlo; crea y elimina un espacio vacío.
- Repite la comprobación de guardado colaborativo entre dos usuarios asignados a P2 con permisos de edición.

## Límites actuales

- No hay invitación por enlace ni alta pública de cuentas. Las cuentas son aprovisionadas por el administrador principal.
- El espacio determina quién puede crear proyectos y manejar las membresías generales; los proyectos controlan sus propios miembros y diagramas.
- La colaboración es por guardados y eventos SSE, no coedición carácter por carácter.
- No se añadieron dependencias nuevas. La cobertura objetivo del 95 % permanece pendiente por decisión anterior; **esta entrega no está certificada todavía en Windows hasta ejecutar las suites completas**.
