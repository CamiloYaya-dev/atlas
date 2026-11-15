import {test} from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import {pool} from '../../../db/pool'
import {registerProjectMembersController} from './project-members.controller'
import {projectEvents} from '../realtime/project-events'
const workspace='11111111-1111-4111-8111-111111111111',actor='22222222-2222-4222-8222-222222222222',role='33333333-3333-4333-8333-333333333333',project='44444444-4444-4444-8444-444444444444',candidate='55555555-5555-4555-8555-555555555555',delegate='66666666-6666-4666-8666-666666666666'
const headers={cookie:'atlas_session='+'A'.repeat(48)}
for(const allowed of [false,true])test(`membresía delegada: ${allowed?'permite subconjunto autorizado':'impide escalamiento de privilegios'}`,async t=>{
 const app=Fastify();t.after(()=>app.close());await registerProjectMembersController(app)
 t.mock.method(pool,'query',async(sql:string)=>{if(sql.includes('FROM atlas_sessions'))return {rows:[{id:actor,email:'qa@example.test',display_name:'QA',platform_admin:false,session_id:'s'}]};throw Error('SQL inesperado '+sql)})
 const seen:string[]=[];const client={query:async(sql:string,params:unknown[])=>{seen.push(sql.trim());if(sql.includes('SELECT workspace_id FROM projects'))return {rows:[{workspace_id:workspace}]};if(sql.includes('FROM projects p JOIN workspace_members'))return {rows:[{workspace_id:workspace,workspace_role:'editor',id:delegate,role_key:'delegado',name:'Delegado'}]};if(sql.includes('FROM role_permissions'))return {rows:params[0]===delegate?[{permission:'project.members.manage'},{permission:'project.read'}]:[{permission:allowed?'project.read':'project.delete'}]};if(sql.includes('SELECT wm.user_id'))return {rows:[{user_id:candidate}]};if(sql.includes('SELECT role_key FROM workspace_roles'))return {rows:[{role_key:'viewer'}]};if(sql.includes('SELECT r.role_key FROM project_members'))return {rows:[]};if(sql.includes('INSERT INTO project_members')||sql.includes('INSERT INTO audit_events')||['BEGIN','COMMIT','ROLLBACK'].includes(sql))return {rows:[]};throw Error('SQL inesperado '+sql)},release:()=>seen.push('RELEASE')}
 t.mock.method(pool,'connect',async()=>client);const revoke=t.mock.method(projectEvents,'revokeUser',()=>{})
 const response=await app.inject({method:'PUT',url:`/api/v1/projects/${project}/members/${candidate}`,headers,payload:{roleId:role}});assert.equal(response.statusCode,allowed?200:403,response.body)
 assert.deepEqual(seen.slice(-2),[allowed?'COMMIT':'ROLLBACK','RELEASE']);assert.equal(seen.some(s=>s.includes('INSERT INTO project_members')),allowed);assert.equal(revoke.mock.callCount(),allowed?1:0)
})

test('candidatos de miembro delegado: filtra políticas que exceden su autorización',async t=>{
 const app=Fastify();t.after(()=>app.close());await registerProjectMembersController(app)
 t.mock.method(pool,'query',async(sql:string)=>{
  if(sql.includes('FROM atlas_sessions'))return {rows:[{id:actor,email:'qa@example.test',display_name:'QA',platform_admin:false,session_id:'s'}]}
  if(sql.includes('FROM projects p JOIN workspace_members'))return {rows:[{workspace_id:workspace,workspace_role:'editor',id:delegate,role_key:'delegado',name:'Delegado'}]}
  if(sql.includes('FROM role_permissions'))return {rows:[{permission:'project.members.manage'},{permission:'project.read'}]}
  if(sql.includes('SELECT workspace_id FROM projects'))return {rows:[{workspace_id:workspace}]}
  if(sql.includes('FROM workspace_members wm JOIN atlas_users'))return {rows:[{id:candidate,name:'QA'}]}
  if(sql.includes('FROM workspace_roles r LEFT JOIN'))return {rows:[{id:role,permissions:['project.read']},{id:'blocked',permissions:['project.delete']}]}
  throw Error('SQL inesperado '+sql)
 })
 const r=await app.inject({method:'GET',url:`/api/v1/projects/${project}/candidates`,headers});assert.equal(r.statusCode,200,r.body);assert.deepEqual(r.json().roles,[{id:role,permissions:['project.read']}]);assert.equal(r.json().users[0].id,candidate)
})
