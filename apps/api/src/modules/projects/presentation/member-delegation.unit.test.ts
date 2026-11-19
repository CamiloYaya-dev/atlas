import {test} from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import {pool} from '../../../db/pool'
import {registerProjectMembersController} from './project-members.controller'
import {projectEvents} from '../realtime/project-events'

const workspace='11111111-1111-4111-8111-111111111111'
const actor='22222222-2222-4222-8222-222222222222'
const role='33333333-3333-4333-8333-333333333333'
const project='44444444-4444-4444-8444-444444444444'
const candidate='55555555-5555-4555-8555-555555555555'
const delegate='66666666-6666-4666-8666-666666666666'
const organization='77777777-7777-4777-8777-777777777777'
const headers={cookie:'novzi_session='+'A'.repeat(48)}

// El rol de proyecto no basta para administrar usuarios: se requiere también
// ser owner/admin de la organización y seguir sin poder conceder permisos ajenos.
for(const permitted of [false,true])test(`administrador de organización: ${permitted?'permite subconjunto autorizado':'impide escalamiento de privilegios'}`,async t=>{
 const app=Fastify();t.after(()=>app.close());await registerProjectMembersController(app)
 t.mock.method(pool,'query',async(sql:string)=>{
  if(sql.includes('FROM novzi_sessions'))return {rows:[{id:actor,email:'qa@example.test',display_name:'QA',platform_admin:false,session_id:'s'}]}
  throw Error('SQL inesperado '+sql)
 })
 const seen:string[]=[]
 const client={
  query:async(sql:string,params:unknown[])=>{
   seen.push(sql.trim())
   if(sql.includes('SELECT workspace_id FROM projects'))return {rows:[{workspace_id:workspace}]}
   if(sql.includes('FROM projects p JOIN workspace_members'))return {rows:[{workspace_id:workspace,workspace_role:'editor',id:delegate,role_key:'delegado',name:'Delegado'}]}
   if(sql.includes('SELECT w.organization_id,m.role FROM workspaces w'))return {rows:[{organization_id:organization,role:'admin'}]}
   if(sql.includes('SELECT organization_id FROM workspaces WHERE id='))return {rows:[{organization_id:organization}]}
   if(sql.includes('FROM organization_members om JOIN novzi_users'))return {rows:[{user_id:candidate}]}
   if(sql.includes('SELECT user_id FROM workspace_members'))return {rows:[{user_id:candidate}]}
   if(sql.includes('FROM role_permissions'))return {rows:params[0]===delegate?[{permission:'project.members.manage'},{permission:'project.read'}]:[{permission:permitted?'project.read':'project.delete'}]}
   if(sql.includes('SELECT role_key FROM workspace_roles'))return {rows:[{role_key:'viewer'}]}
   if(sql.includes('SELECT r.role_key FROM project_members'))return {rows:[]}
   if(sql.includes('INSERT INTO project_members')||sql.includes('INSERT INTO audit_events')||['BEGIN','COMMIT','ROLLBACK'].includes(sql))return {rows:[]}
   throw Error('SQL inesperado '+sql)
  },release:()=>seen.push('RELEASE')
 }
 t.mock.method(pool,'connect',async()=>client)
 const revoke=t.mock.method(projectEvents,'revokeUser',()=>{})
 const response=await app.inject({method:'PUT',url:`/api/v1/projects/${project}/members/${candidate}`,headers,payload:{roleId:role}})
 assert.equal(response.statusCode,permitted?200:403,response.body)
 assert.deepEqual(seen.slice(-2),[permitted?'COMMIT':'ROLLBACK','RELEASE'])
 assert.equal(seen.some(s=>s.includes('INSERT INTO project_members')),permitted)
 assert.equal(revoke.mock.callCount(),permitted?1:0)
})

test('miembro ordinario de organización no asigna usuarios aunque tenga permiso de proyecto',async t=>{
 const app=Fastify();t.after(()=>app.close());await registerProjectMembersController(app)
 t.mock.method(pool,'query',async(sql:string)=>{
  if(sql.includes('FROM novzi_sessions'))return {rows:[{id:actor,email:'qa@example.test',display_name:'QA',platform_admin:false,session_id:'s'}]}
  throw Error('SQL inesperado '+sql)
 })
 const seen:string[]=[]
 const client={query:async(sql:string)=>{
  seen.push(sql.trim())
  if(sql.includes('SELECT workspace_id FROM projects'))return {rows:[{workspace_id:workspace}]}
  if(sql.includes('FROM projects p JOIN workspace_members'))return {rows:[{workspace_id:workspace,workspace_role:'editor',id:delegate,role_key:'delegado',name:'Delegado'}]}
  if(sql.includes('FROM role_permissions'))return {rows:[{permission:'project.members.manage'},{permission:'project.read'}]}
  if(sql.includes('SELECT w.organization_id,m.role FROM workspaces w'))return {rows:[{organization_id:organization,role:'member'}]}
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql))return {rows:[]}
  throw Error('SQL inesperado '+sql)
 },release:()=>seen.push('RELEASE')}
 t.mock.method(pool,'connect',async()=>client)
 const revoke=t.mock.method(projectEvents,'revokeUser',()=>{})
 const response=await app.inject({method:'PUT',url:`/api/v1/projects/${project}/members/${candidate}`,headers,payload:{roleId:role}})
 assert.equal(response.statusCode,403,response.body)
 assert.match(response.body,/Solo administradores de organización/)
 assert.equal(seen.some(s=>s.includes('INSERT INTO project_members')),false)
 assert.deepEqual(seen.slice(-2),['ROLLBACK','RELEASE'])
 assert.equal(revoke.mock.callCount(),0)
})

test('candidatos de proyecto: directorio privado de organización y roles sin escalamiento',async t=>{
 const app=Fastify();t.after(()=>app.close());await registerProjectMembersController(app)
 t.mock.method(pool,'query',async(sql:string)=>{
  if(sql.includes('FROM novzi_sessions'))return {rows:[{id:actor,email:'qa@example.test',display_name:'QA',platform_admin:false,session_id:'s'}]}
  if(sql.includes('FROM projects p JOIN workspace_members'))return {rows:[{workspace_id:workspace,workspace_role:'editor',id:delegate,role_key:'delegado',name:'Delegado'}]}
  if(sql.includes('FROM role_permissions'))return {rows:[{permission:'project.members.manage'},{permission:'project.read'}]}
  if(sql.includes('SELECT workspace_id FROM projects WHERE'))return {rows:[{workspace_id:workspace}]}
  if(sql.includes('SELECT w.organization_id,m.role FROM workspaces w'))return {rows:[{organization_id:organization,role:'admin'}]}
  if(sql.includes('SELECT p.workspace_id,w.organization_id FROM projects'))return {rows:[{workspace_id:workspace,organization_id:organization}]}
  if(sql.includes('FROM organization_members om JOIN novzi_users'))return {rows:[{id:candidate,name:'QA'}]}
  if(sql.includes('FROM workspace_roles r LEFT JOIN'))return {rows:[{id:role,permissions:['project.read']},{id:'blocked',permissions:['project.delete']}]}
  throw Error('SQL inesperado '+sql)
 })
 const response=await app.inject({method:'GET',url:`/api/v1/projects/${project}/candidates`,headers})
 assert.equal(response.statusCode,200,response.body)
 assert.deepEqual(response.json().roles,[{id:role,permissions:['project.read']}])
 assert.equal(response.json().users[0].id,candidate)
})

test('listados de proyecto no exponen el directorio a miembros ordinarios',async t=>{
 const app=Fastify();t.after(()=>app.close());await registerProjectMembersController(app)
 const queries:string[]=[]
 t.mock.method(pool,'query',async(sql:string)=>{
  queries.push(sql)
  if(sql.includes('FROM novzi_sessions'))return {rows:[{id:actor,email:'qa@example.test',display_name:'QA',platform_admin:false,session_id:'s'}]}
  if(sql.includes('FROM projects p JOIN workspace_members'))return {rows:[{workspace_id:workspace,workspace_role:'editor',id:delegate,role_key:'delegado',name:'Delegado'}]}
  if(sql.includes('FROM role_permissions'))return {rows:[{permission:'project.members.manage'},{permission:'project.read'}]}
  if(sql.includes('SELECT workspace_id FROM projects WHERE'))return {rows:[{workspace_id:workspace}]}
  if(sql.includes('SELECT w.organization_id,m.role FROM workspaces w'))return {rows:[{organization_id:organization,role:'member'}]}
  throw Error('SQL inesperado '+sql)
 })
 for(const path of ['candidates','members']){
  const response=await app.inject({method:'GET',url:`/api/v1/projects/${project}/${path}`,headers})
  assert.equal(response.statusCode,403,response.body)
 }
 assert.equal(queries.some(sql=>sql.includes('FROM organization_members om JOIN novzi_users')),false)
 assert.equal(queries.some(sql=>sql.includes('FROM project_members m JOIN novzi_users')),false)
})
