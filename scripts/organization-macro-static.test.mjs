import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const source=(path)=>readFileSync(resolve(root,path),'utf8')
test('019 preserva datos y asignaciones históricas, sin borrado de tablas ni migraciones',()=>{
 const sql=source('apps/api/migrations/019_organization_access_scopes.sql')
 assert.match(sql,/DEFAULT 'all'/)
 assert.match(sql,/CREATE TABLE IF NOT EXISTS project_diagram_grants/)
 assert.doesNotMatch(sql,/\b(TRUNCATE|DROP TABLE|DELETE FROM project_members)\b/i)
})
test('la consola organizacional es el único punto de alta expuesto desde el editor',()=>{
 const editor=source('apps/web/src/features/editor/NovziEditor.tsx')
 assert.match(editor,/OrganizationPanel/)
 assert.match(editor,/Usuarios y accesos de la organización/)
 assert.doesNotMatch(editor,/import SecurityPanel/)
 assert.doesNotMatch(editor,/setDialog\('platform-accounts'\)/)
 const settings=source('apps/web/src/features/projects/ProjectSettings.tsx')
 assert.doesNotMatch(settings,/assignProjectMember|projectCandidates|createUser/)
})
test('API limita altas y roles a administrador/propietario de organización',()=>{
 const organizations=source('apps/api/src/modules/organizations/organizations.controller.ts')
 const access=source('apps/api/src/modules/organizations/organization-access.controller.ts')
 assert.match(organizations,/onlyManager\(await organizationAccess/)
 assert.match(access,/await orgManager\(/)
 assert.match(access,/project\.workspace_id=\$2|p\.workspace_id=\$2/)
 assert.match(access,/SELECT 1 FROM workspaces WHERE id=\$1 AND organization_id=\$2/)
})
test('los endpoints antiguos de membresía no saltan el administrador de organización',()=>{
 assert.match(source('apps/api/src/modules/access/presentation/access.controller.ts'),/requireOrganizationManagerForWorkspace/)
 assert.match(source('apps/api/src/modules/projects/presentation/project-members.controller.ts'),/requireOrganizationManagerForProject/)
})
test('el acceso parcial proyecta los diagramas antes de devolver el documento',()=>{
 const roles=source('apps/api/src/security/roles.ts')
 const document=source('apps/api/src/modules/projects/application/document-policy.ts')
 assert.match(roles,/diagramIds\?:Set<string>/)
 assert.match(roles,/row\.diagram_scope==='selected'/)
 assert.match(document,/document\.diagrams\.filter\(d=>a\.diagramIds!\.has\(d\.id\)\)/)
 assert.match(document,/selectedDiagramIds/)
})
test('nueva API montada, con flujo central de asignación y retiro',()=>{
 assert.match(source('apps/api/src/http/routes.ts'),/registerOrganizationAccessController\(app\)/)
 const access=source('apps/api/src/modules/organizations/organization-access.controller.ts')
 assert.match(access,/project_diagram_grants/)
 assert.match(access,/organization\.access_revoked/)
 assert.match(access,/organization\.access_granted/)
})
