# Protocolo de aceptación de seguridad ATLAS V4.2

## A. Administración e inicio de sesión

1. Ejecuta `npm run dev:all`, verifica migración `003_access_control.sql`.
2. Crea el primer administrador con `npm run admin:setup` cuando lo indique el inicio. No existe password predefinido.
3. En Chrome abre `/` y verifica que el login no ofrece registro. Intenta llamar `POST /api/v1/workspaces` sin sesión: debe devolver **401** (si el CSRF global se ejecuta primero).
4. Inicia sesión con administrador, refresca: sesión restaurada.
5. Cierra sesión y prueba `/api/v1/auth/me`: **401**.
6. En Accesos → Cuentas crea `funcional@ejemplo.test` y `tecnico@ejemplo.test` con claves únicas, asigna ambos al workspace usando Miembros.

## B. Matriz funcional / técnico

- En Roles, inspecciona `functional`: debe tener `diagram.view.process`, `element.edit.activity`, pero NO `diagram.view.c3` ni `element.edit.endpoint` ni `artifact.export`.
- En Rol `technical`: debe tener `diagram.view.c3`, `element.edit.endpoint`, pero NO `element.edit.activity`.
- Accede con analista funcional: NO debe recibir C3 ni endpoints técnicos al abrir el proyecto. Verifica en Red → GET `/projects/:id/document` que no estén los datos restringidos.
- Intenta editar una actividad: debe guardar; intenta modificar C3 mediante PUT construido manualmente con token CSRF válido: debe devolver 403.
- Con arquitecto técnico verifica la situación inversa.

## C. Granularidad

1. Crea un rol personalizado llamado `QA C1` con SOLO `project.read`, `diagram.view.c1`, `element.view.system`, `element.view.actor`.
2. Asigna un usuario al rol: debe ver C1 y no C2, C3, C4. No debe poder mover cajas.
3. Configura rol especial con `diagram.layout.c2`, `element.view.container` pero sin `relation.create.technical`: debe poder mover cajas sin crear relaciones.
4. Prueba una persona con `artifact.import` pero no `artifact.export`: menú Exportar oculto y GET `/export` debe devolver **403**. Importar debe seguir requiriendo permisos sobre los datos concretos.
5. Suspende la cuenta desde admin: las sesiones activas quedan revocadas y cualquier solicitud siguiente debe recibir 401.

## D. Seguridad operativa

- NO guardar contraseñas, tokens de sesión ni secretos en Git.
- La API comprueba autorización cada vez, no confía en flags enviados desde React.
- Tras cambiar roles, refrescar el navegador para actualizar botones; la API aplica los permisos inmediatamente incluso sin recargar.
- Ejecutar `npm run test:policy` y `npm run test:integration` con DB QA aislada antes de habilitar despliegue.
- Probar restauración de backup y concurrencia (dos editores guardando misma versión → 409).
- Ejecución en producción requiere HTTPS, cookies Secure, red privada/acceso controlado para PostgreSQL, monitoreo, MFA y revisión independiente.
