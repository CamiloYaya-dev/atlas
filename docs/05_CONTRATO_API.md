# API ATLAS V4.2 — Resumen de endpoints

Todas las rutas llevan prefijo `/api/v1`. API JSON; escrituras autenticadas requieren `X-CSRF-Token` salvo `/auth/login`. Cookies `credentials:'include'`.

| Método | Ruta | Política |
|---|---|---|
| GET | `/health`, `/ready` | Pública, sin secretos |
| POST | `/auth/login` | Pública; rate limit e inicio con credenciales aprovisionadas |
| GET | `/auth/me` | Sesión activa; devuelve perfil y token CSRF derivado |
| POST | `/auth/logout` | Sesión y CSRF; revoca cookie |
| GET | `/admin/users` | Administrador principal |
| POST | `/admin/users` | Administrador principal; crea cuenta local |
| PATCH | `/admin/users/:userId` | Administrador principal; suspende/reactiva o cambia contraseña |
| GET | `/workspaces` | Sesión activa; solo membresías propias |
| POST | `/workspaces` | Administrador principal |
| GET | `/workspaces/:id/access` | Miembro: rol y permisos efectivos |
| GET/POST | `/workspaces/:id/roles` | `workspace.roles.manage` |
| PUT | `/workspaces/:id/roles/:roleId` | `workspace.roles.manage`, propietario inmutable |
| GET/POST | `/workspaces/:id/members` | `workspace.members.manage` |
| DELETE | `/workspaces/:id/members/:userId` | `workspace.members.manage`, propietario protegido |
| GET | `/workspaces/:id/projects` | `project.read` |
| POST | `/workspaces/:id/projects` | `project.create` |
| GET | `/projects/:id/document` | `project.read` + filtros `diagram.view.*` y `element.view.*` |
| PUT | `/projects/:id/document` | Diff autorizado por permisos de elemento, diagramas y relaciones |
| GET | `/projects/:id/export` | `project.read` + `artifact.export` |
| POST | `/projects/:id/import` | `artifact.import` + diff autorizado |
| GET | `/projects/:id/versions` | `project.read` |

El endpoint de registro público y la redención de invitación de V4.1 están **deshabilitados**. No añadirlos al router sin rediseño de las políticas.
