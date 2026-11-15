import {test} from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import {pool} from '../../../db/pool'
import {registerAccessController} from './access.controller'
import {registerAdminController} from '../../admin/presentation/admin.controller'
import {registerProjectController} from '../../projects/presentation/projects.controller'
import {ProjectsRepository} from '../../projects/infrastructure/projects.repository'
import {projectEvents} from '../../projects/realtime/project-events'
const workspace='11111111-1111-4111-8111-111111111111',actor='22222222-2222-4222-8222-222222222222',role='33333333-3333-4333-8333-333333333333',project='44444444-4444-4444-8444-444444444444'
const headers={cookie:'atlas_session='+'A'.repeat(48)}
// Exercise real Fastify route handlers + identity/ACL over a strict fake SQL boundary.
// CSRF/rate limiting are covered by the full application integration suite.
test('auditoría no propietaria limita proyectos por membresía y elimina atributos internos',async t=>{
 const a=Fastify();t.after(()=>a.close());await registerAccessController(a)
 const query=t.mock.method(pool,'query',async(sql:string,params:unknown[])=>{
  if(sql.includes('FROM atlas_sessions'))return {rows:[{id:actor,email:'qa@example.test',display_name:'QA',platform_admin:false,session_id:'s'}]}
  if(sql.includes('FROM workspace_members m JOIN workspace_roles'))return {rows:[{id:role,role_key:'qa_auditor',name:'Auditor'}]}
  if(sql.includes('FROM role_permissions'))return {rows:[{permission:'workspace.audit.view'}]}
  if(sql.includes('FROM audit_events')){assert.match(sql,/pm.user_id=\$2/);assert.deepEqual(params,[workspace,actor,26]);return {rows:[{id:'9',event_type:'project.renamed',actor_name:null,actor_email:null,resource_id:project,resource_name:null,detail:null,created_at:'2026-11-14'}]}}
  throw Error('SQL inesperado '+sql)
 })
 const result=await a.inject({method:'GET',url:`/api/v1/workspaces/${workspace}/audit`,headers});assert.equal(result.statusCode,200,result.body)
 assert.deepEqual(result.json().items,[{id:'9',event_type:'project.renamed',actor_name:'Usuario eliminado',actor_email:null,resource_id:project,resource_name:null,detail:{},created_at:'2026-11-14'}]);assert.equal(result.json().nextCursor,null)
 const roles=await a.inject({method:'GET',url:`/api/v1/workspaces/${workspace}/roles`,headers});assert.equal(roles.statusCode,403);assert.ok(query.mock.callCount()>=4)
})
test('roles: administrador delegado no puede conceder borrado de workspace ni insertar solicitudes incompletas',async t=>{
 const a=Fastify();t.after(()=>a.close());await registerAccessController(a)
 let roleKey='qa_admin'
 t.mock.method(pool,'query',async(sql:string)=>{
  if(sql.includes('FROM atlas_sessions'))return {rows:[{id:actor,email:'qa@example.test',display_name:'QA',platform_admin:false,session_id:'s'}]}
  if(sql.includes('FROM workspace_members m JOIN workspace_roles'))return {rows:[{id:role,role_key:roleKey,name:'Administrador'}]}
  if(sql.includes('FROM role_permissions'))return {rows:[{permission:'workspace.roles.manage'},{permission:'workspace.members.manage'}]}
  throw Error('SQL inesperado '+sql)
 })
 const connect=t.mock.method(pool,'connect',async()=>{throw Error('No debe abrir transacción')})
 const path=`/api/v1/workspaces/${workspace}`
 assert.equal((await a.inject({method:'POST',url:path+'/roles',headers,payload:{name:'Eliminar',roleKey:'delete_qa',permissions:['workspace.delete']}})).statusCode,403)
 assert.equal((await a.inject({method:'PUT',url:path+'/roles/'+role,headers,payload:{permissions:['workspace.delete']}})).statusCode,403)
 for(const payload of [{},{name:'QA'},{roleKey:'qa'},{name:'QA',roleKey:'invalid key'}])assert.equal((await a.inject({method:'POST',url:path+'/roles',headers,payload})).statusCode,400)
 assert.equal((await a.inject({method:'POST',url:path+'/members',headers,payload:{}})).statusCode,400)
 assert.equal((await a.inject({method:'POST',url:path+'/members',headers,payload:{userId:actor}})).statusCode,400)
 assert.equal(connect.mock.callCount(),0)
 roleKey='owner'
})
test('alta administrativa rechaza cuerpo inválido, nombre ausente y contraseña vacía, sin insertar cuentas',async t=>{
 const a=Fastify();t.after(()=>a.close());await registerAdminController(a)
 let writes=0;t.mock.method(pool,'query',async(sql:string)=>{
  if(sql.includes('FROM atlas_sessions'))return {rows:[{id:actor,email:'qa@example.test',display_name:'QA',platform_admin:true,session_id:'s'}]}
  writes++;return {rows:[],rowCount:0}
 })
 for(const payload of [[],{}, {email:'qa@example.test'}, {email:'qa@example.test',name:'QA'}])assert.equal((await a.inject({method:'POST',url:'/api/v1/admin/users',headers,payload})).statusCode,400)
 assert.equal(writes,0)
 const missing=await a.inject({method:'PATCH',url:`/api/v1/admin/users/${role}`,headers,payload:{password:'ClaveSeguraQA-2026!'}});assert.equal(missing.statusCode,404);assert.equal(writes,1)
})
test('presencia y restauración rechazan ausencia de documento y edición concurrente antes de persistir',async t=>{
 const a=Fastify();t.after(()=>a.close());await registerProjectController(a)
 t.mock.method(pool,'query',async(sql:string)=>{
  if(sql.includes('FROM atlas_sessions'))return {rows:[{id:actor,email:'qa@example.test',display_name:'QA',platform_admin:false,session_id:'s'}]}
  if(sql.includes('AS "workspaceId"'))return {rows:[{workspaceId:workspace}]}
  if(sql.includes('FROM projects p JOIN workspace_members'))return {rows:[{workspace_id:workspace,workspace_role:'owner',id:null,role_key:null,name:null}]}
  if(sql.includes('FROM workspace_members m JOIN workspace_roles'))return {rows:[{id:role,role_key:'owner',name:'Propietario'}]}
  if(sql.includes('FROM role_permissions'))return {rows:[]}
  throw Error('SQL inesperado '+sql)
 })
 t.mock.method(ProjectsRepository.prototype,'loadDocument',async()=>null)
 const base=`/api/v1/projects/${project}`,presence={clientId:'qa-client-valid',diagramId:null,elementId:null}
 assert.equal((await a.inject({method:'POST',url:base+'/presence',headers,payload:presence})).statusCode,404)
 assert.equal((await a.inject({method:'GET',url:base+'/events?clientId=qa-client-valid',headers})).statusCode,404)
 assert.equal((await a.inject({method:'POST',url:base+'/presence',headers,payload:[]})).statusCode,400)
 const save=t.mock.method(ProjectsRepository.prototype,'saveAuthorized',async()=>{throw Error('No se debe persistir')})
 t.mock.method(projectEvents,'hasOtherParticipants',()=>true)
 assert.equal((await a.inject({method:'POST',url:base+'/restore',headers,payload:{sourceVersion:1,expectedVersion:2}})).statusCode,409)
 assert.equal((await a.inject({method:'POST',url:base+'/restore-branches/'+role+'/apply',headers,payload:{mode:'replace',expectedVersion:2}})).statusCode,409)
 assert.equal(save.mock.callCount(),0)
})

test('SSE autorizado entrega cabeceras y revalida permisos y visibilidad antes de conservar conexión',async t=>{
 const app=Fastify();t.after(()=>app.close());await registerProjectController(app)
 const {emptyDoc,createElement}=await import('@atlas/contracts')
 const doc=emptyDoc();doc.elements.a={...createElement('Actor QA','actor'),id:'a'};doc.diagrams=[{id:'d',type:'c1',name:'QA',description:'',createdAt:'2026-11-14',nodes:[{id:'n',elementId:'a',x:0,y:0}],edges:[]}]
 t.mock.method(pool,'query',async(sql:string)=>{
  if(sql.includes('FROM atlas_sessions'))return {rows:[{id:actor,email:'qa@example.test',display_name:'QA',platform_admin:false,session_id:'s'}]}
  if(sql.includes('AS "workspaceId"'))return {rows:[{workspaceId:workspace}]}
  if(sql.includes('FROM projects p JOIN workspace_members'))return {rows:[{workspace_id:workspace,workspace_role:'owner',id:null,role_key:null,name:null}]}
  if(sql.includes('FROM workspace_members m JOIN workspace_roles'))return {rows:[{id:role,role_key:'owner',name:'Propietario'}]}
  if(sql.includes('FROM role_permissions'))return {rows:[]}
  throw Error('SQL inesperado '+sql)
 })
 let available=true; t.mock.method(ProjectsRepository.prototype,'loadDocument',async()=>available?{document:doc,version:3}:null)
 let validate:(()=>Promise<void>)|undefined
 const visibility=t.mock.method(projectEvents,'updateVisibility',()=>{})
 const subscribe=t.mock.method(projectEvents,'subscribe',(...args:Parameters<typeof projectEvents.subscribe>)=>{
  assert.deepEqual(args.slice(0,4),[project,'qa-client-valid',actor,'QA']);assert.equal(args[5],3);assert.deepEqual(args[7],{diagrams:new Set(['d']),elements:new Set(['a'])});validate=args[6];args[4].end()
 })
 const response=await app.inject({method:'GET',url:`/api/v1/projects/${project}/events?clientId=qa-client-valid`,headers});assert.equal(response.statusCode,200);assert.match(String(response.headers['content-type']),/text\/event-stream/);assert.match(response.body,/ATLAS live/);assert.equal(subscribe.mock.callCount(),1);assert.ok(validate)
 await validate();assert.deepEqual(visibility.mock.calls[0].arguments,[project,'qa-client-valid',new Set(['d']),new Set(['a'])]);available=false;await assert.rejects(validate(),{statusCode:404});assert.equal(visibility.mock.callCount(),1)
})
