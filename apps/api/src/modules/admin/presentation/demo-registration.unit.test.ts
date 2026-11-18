import {test} from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import {pool} from '../../../db/pool'
import {registerAdminController} from './admin.controller'

const actor='22222222-2222-4222-8222-222222222222'
const newUser='33333333-3333-4333-8333-333333333333'
const cookie='novzi_session='+'X'.repeat(48)

test('alta privada: usuario, workspace y 19 diagramas se crean de forma atómica',async t=>{
 const app=Fastify();t.after(()=>app.close());await registerAdminController(app)
 t.mock.method(pool,'query',async(sql:string)=>{
  if(sql.includes('FROM novzi_sessions'))return {rows:[{id:actor,email:'owner@novzi.test',display_name:'Owner',platform_admin:true,session_id:'s'}]}
  throw Error('SQL inesperado fuera de transacción: '+sql)
 })
 const queries:string[]=[]
 const c={query:async(sql:string,args:unknown[]=[])=>{
  queries.push(sql)
  if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK')return {rows:[]}
  if(sql.startsWith('INSERT INTO novzi_users'))return {rows:[{id:newUser}]}
  if(sql.startsWith('SELECT id FROM workspaces'))return {rows:[]}
  if(sql.startsWith('INSERT INTO workspaces'))return {rows:[{id:'w-demo'}]}
  if(sql.startsWith('INSERT INTO workspace_roles'))return {rows:[{id:'r-owner'}]}
  if(sql.startsWith('INSERT INTO role_permissions'))return {rows:[]}
  if(sql.startsWith('SELECT id FROM workspace_roles'))return {rows:[{id:'r-owner'}]}
  if(sql.startsWith('INSERT INTO workspace_members'))return {rows:[]}
  if(sql.startsWith('SELECT id FROM projects'))return {rows:[]}
  if(sql.startsWith('INSERT INTO projects'))return {rows:[{id:'p-demo'}]}
  if(sql.startsWith('INSERT INTO project_members'))return {rows:[]}
  if(sql.startsWith('INSERT INTO project_documents')){
   const doc=JSON.parse(String(args[1]));assert.equal(doc.diagrams.length,19)
   return {rows:[]}
  }
  if(sql.startsWith('INSERT INTO project_document_versions'))return {rows:[]}
  throw Error('SQL inesperado '+sql)
 },release:()=>{}}
 t.mock.method(pool,'connect',async()=>c as never)
 const response=await app.inject({method:'POST',url:'/api/v1/admin/users',headers:{cookie},payload:{email:'new@novzi.test',name:'Nuevo Usuario',password:'ClaveQaSegura2026!'}})
 assert.equal(response.statusCode,201,response.body)
 assert.equal(response.json().demoWorkspaceId,'w-demo')
 assert.equal(response.json().demoProjectId,'p-demo')
 assert.equal(queries[0],'BEGIN')
 assert.equal(queries.at(-1),'COMMIT')
 assert.ok(queries.includes('INSERT INTO project_documents(project_id,document,updated_by) VALUES($1,$2::jsonb,$3)'))
})

test('fallo de demo hace rollback de la cuenta; no deja un registro a medias',async t=>{
 const app=Fastify();t.after(()=>app.close());await registerAdminController(app)
 t.mock.method(pool,'query',async(sql:string)=>{
  if(sql.includes('FROM novzi_sessions'))return {rows:[{id:actor,email:'owner@novzi.test',display_name:'Owner',platform_admin:true,session_id:'s'}]}
  throw Error('SQL inesperado fuera de transacción')
 })
 const queries:string[]=[]
 const c={query:async(sql:string)=>{
  queries.push(sql)
  if(sql==='BEGIN'||sql==='ROLLBACK')return {rows:[]}
  if(sql.startsWith('INSERT INTO novzi_users'))return {rows:[{id:newUser}]}
  throw Error('Fallo de base de datos provocado')
 },release:()=>{}}
 t.mock.method(pool,'connect',async()=>c as never)
 const response=await app.inject({method:'POST',url:'/api/v1/admin/users',headers:{cookie},payload:{email:'new2@novzi.test',name:'Nuevo Usuario',password:'ClaveQaSegura2026!'}})
 assert.ok(response.statusCode>=500)
 assert.ok(queries.includes('ROLLBACK'))
 assert.ok(!queries.includes('COMMIT'))
})
