import {test} from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import {pool} from '../../db/pool'
import {registerOrganizationsController} from './organizations.controller'
const id={owner:'11111111-1111-4111-8111-111111111111',person:'22222222-2222-4222-8222-222222222222',org:'33333333-3333-4333-8333-333333333333',invite:'44444444-4444-4444-8444-444444444444'}
const cookie='novzi_session='+'X'.repeat(48)
const auth=(email:string,platformAdmin=false)=>({rows:[{id:id.person,email,display_name:'Persona QA',platform_admin:platformAdmin,session_id:id.owner}]})

test('organización: una cuenta puede crearla sin asignación automática de espacios',async t=>{
 const app=Fastify();t.after(()=>app.close());await registerOrganizationsController(app)
 t.mock.method(pool,'query',async(sql:string)=>{if(sql.includes('FROM novzi_sessions'))return auth('lady@example.com');throw Error('Consulta global imprevista '+sql)})
 const seen:string[]=[]
 t.mock.method(pool,'connect',async()=>({query:async(sql:string)=>{
  seen.push(sql)
  if(sql.startsWith('INSERT INTO organizations'))return {rows:[{id:id.org}]}
  if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK'||sql.startsWith('INSERT INTO organization_members'))return {rows:[]}
  throw Error('SQL inesperado '+sql)
 },release:()=>{}}) as never)
 const r=await app.inject({method:'POST',url:'/api/v1/organizations',headers:{cookie},payload:{name:'Zercano'}})
 assert.equal(r.statusCode,201,r.body)
 assert.equal(r.json().id,id.org)
 assert.ok(seen.some(sql=>sql.startsWith('INSERT INTO organization_members')))
 assert.ok(!seen.some(sql=>sql.includes('workspaces')||sql.includes('projects')))
})

test('organización: el administrador global no enumera los miembros de otra organización',async t=>{
 const app=Fastify();t.after(()=>app.close());await registerOrganizationsController(app)
 const queries:string[]=[]
 t.mock.method(pool,'query',async(sql:string)=>{
  queries.push(sql)
  if(sql.includes('FROM novzi_sessions'))return auth('admin@novzi.co',true)
  if(sql.includes('FROM organization_members m'))return {rows:[]}
  throw Error('No debe consultar el directorio '+sql)
 })
 const r=await app.inject({method:'GET',url:`/api/v1/organizations/${id.org}/members?q=Lady`,headers:{cookie}})
 assert.equal(r.statusCode,404,r.body)
 assert.ok(!queries.some(sql=>sql.includes('SELECT u.id,u.display_name')))
})

test('organización: invitar correo externo no concede inmediatamente acceso a espacios',async t=>{
 const app=Fastify();t.after(()=>app.close());await registerOrganizationsController(app)
 t.mock.method(pool,'query',async(sql:string)=>{
  if(sql.includes('FROM novzi_sessions'))return auth('lady@example.com')
  if(sql.includes('SELECT m.role FROM organization_members'))return {rows:[{role:'admin'}]}
  throw Error('SQL no esperado '+sql)
 })
 const seen:string[]=[]
 t.mock.method(pool,'connect',async()=>({query:async(sql:string)=>{
  seen.push(sql)
  if(sql.includes('SELECT m.role FROM organization_members'))return {rows:[{role:'admin'}]}
  if(sql.startsWith('SELECT m.user_id FROM organization_members'))return {rows:[]}
  if(sql.includes('INSERT INTO organization_invitations'))return {rows:[{id:id.invite}]}
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)||sql.startsWith('DELETE FROM organization_invitations'))return {rows:[]}
  throw Error('SQL no esperado '+sql)
 },release:()=>{}}) as never)
 const r=await app.inject({method:'POST',url:`/api/v1/organizations/${id.org}/invitations`,headers:{cookie},payload:{email:'ADMIN@NOVZI.CO',role:'member'}})
 assert.equal(r.statusCode,201,r.body);assert.equal(r.json().email,'admin@novzi.co')
 assert.ok(seen.some(sql=>sql.includes('INSERT INTO organization_invitations')))
 assert.ok(!seen.some(sql=>sql.includes('INSERT INTO workspace_members')||sql.includes('INSERT INTO project_members')))
})

test('organización: invitación solo se acepta por la cuenta del correo invitado',async t=>{
 const app=Fastify();t.after(()=>app.close());await registerOrganizationsController(app)
 t.mock.method(pool,'query',async(sql:string)=>{if(sql.includes('FROM novzi_sessions'))return auth('admin@novzi.co');throw Error('Consulta global no esperada '+sql)})
 const seen:string[]=[]
 t.mock.method(pool,'connect',async()=>({query:async(sql:string,args:unknown[]=[])=>{
  seen.push(sql)
  if(sql.includes('FROM organization_invitations')&&sql.includes('FOR UPDATE')){
   assert.equal(args[1],'admin@novzi.co');return {rows:[{organization_id:id.org,role:'member'}]}
  }
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)||sql.includes('INSERT INTO organization_members')||sql.includes('UPDATE organization_invitations'))return {rows:[]}
  throw Error('SQL no esperado '+sql)
 },release:()=>{}}) as never)
 const r=await app.inject({method:'POST',url:`/api/v1/organizations/invitations/${id.invite}/accept`,headers:{cookie}})
 assert.equal(r.statusCode,200,r.body)
 assert.ok(seen.some(sql=>sql.includes('INSERT INTO organization_members')))
 assert.ok(!seen.some(sql=>sql.includes('workspace_members')||sql.includes('project_members')))
})
