import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
test('018 preserva usuarios y documentos históricos; no destruye tablas',()=>{
 const sql=source('apps/api/migrations/018_organizations_and_invitations.sql')
 assert.doesNotMatch(sql,/\b(?:DROP|TRUNCATE|DELETE\s+FROM)\b/i)
 assert.match(sql,/CREATE TABLE IF NOT EXISTS organizations/)
 assert.match(sql,/CREATE TABLE IF NOT EXISTS organization_members/)
 assert.match(sql,/CREATE TABLE IF NOT EXISTS organization_invitations/)
 assert.match(sql,/WHERE organization_id IS NULL/)
 assert.match(sql,/REFERENCES organizations\(id\)/)
})
test('alta global de cuentas no aprovisiona proyectos ni espacios',()=>{
 const admin=source('apps/api/src/modules/admin/presentation/admin.controller.ts')
 assert.doesNotMatch(admin,/provisionUserDemo/)
 assert.match(admin,/INSERT INTO novzi_users/)
})
test('directorio está limitado por organization_id y las invitaciones por email exacto',()=>{
 const api=source('apps/api/src/modules/organizations/organizations.controller.ts')
 assert.match(api,/WHERE m.organization_id=\$1 AND u.active=true/)
 assert.match(api,/WHERE id=\$1 AND email=\$2 AND accepted_at IS NULL/)
 assert.match(api,/INSERT INTO organization_invitations/)
 assert.doesNotMatch(api,/WHERE platform_admin=true/)
})
test('acceso de proyecto requiere pertenecer a la organización',()=>{
 const api=source('apps/api/src/modules/projects/presentation/project-members.controller.ts')
 assert.match(api,/WHERE om.organization_id=\$1 AND om.user_id=\$2/)
 assert.match(api,/Usuario no pertenece a esta organización/)
 assert.match(api,/INSERT INTO workspace_members\(workspace_id,user_id,role,role_id\).*'viewer'/s)
})
test('UI ofrece jerarquía, invitaciones y filtros de usuario y rol',()=>{
 const editor=source('apps/web/src/features/editor/NovziEditor.tsx')
 const org=source('apps/web/src/features/organizations/OrganizationPanel.tsx')
 const access=source('apps/web/src/features/security/SecurityPanel.tsx')
 assert.match(editor,/aria-label="Organización"/)
 assert.match(editor,/Administrar organización e invitaciones/)
 assert.match(org,/myOrganizationInvitations/)
 assert.match(org,/acceptOrganizationInvitation/)
 assert.match(access,/Buscar usuario por nombre o correo/)
 assert.match(access,/Buscar rol/)
})
