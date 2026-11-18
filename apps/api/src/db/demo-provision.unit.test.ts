import {test} from 'node:test'
import assert from 'node:assert/strict'
import type {PoolClient} from 'pg'
import {DEMO_PROJECT_NAME,DEMO_WORKSPACE_NAME,onboardingDemoDocument,provisionUserDemo} from './demo-provision'

test('demo inicial reproduce el JSON QA completo con vistas y referencias entre cajas',()=>{
 const first=onboardingDemoDocument(),second=onboardingDemoDocument()
 assert.equal(first.schema,1)
 assert.equal(first.diagrams.length,19)
 assert.equal(Object.keys(first.elements).length,274)
 assert.notStrictEqual(first,second)
 const validIds=new Set(first.diagrams.map(d=>d.id))
 assert.ok(Object.values(first.elements).filter(e=>e.childDiagramId&&validIds.has(e.childDiagramId)).length>20)
 first.diagrams[0].name='Editado por usuario'
 assert.notEqual(second.diagrams[0].name,first.diagrams[0].name,'los usuarios no comparten la copia mutable')
})

test('provisionar es idempotente, privado por usuario y no reescribe demos editados',async()=>{
 const workspaces=new Map<string,string>(),projects=new Map<string,string>(),sqlLog:string[]=[]
 let sequence=0,storedDocument:unknown
 const db={query:async(sql:string,args:unknown[]=[])=>{
  sqlLog.push(sql)
  if(sql.startsWith('SELECT id FROM workspaces'))return {rows:workspaces.has(String(args[0]))?[{id:workspaces.get(String(args[0]))}]:[]}
  if(sql.startsWith('INSERT INTO workspaces')){const id='w'+(++sequence);workspaces.set(String(args[1]),id);return {rows:[{id}]}}
  if(sql.startsWith('INSERT INTO workspace_roles'))return {rows:[{id:'owner-role'}]}
  if(sql.startsWith('INSERT INTO role_permissions'))return {rows:[]}
  if(sql.startsWith('SELECT id FROM workspace_roles'))return {rows:[{id:'owner-role'}]}
  if(sql.startsWith('INSERT INTO workspace_members'))return {rows:[]}
  if(sql.startsWith('SELECT id FROM projects'))return {rows:projects.has(String(args[0]))?[{id:projects.get(String(args[0]))}]:[]}
  if(sql.startsWith('INSERT INTO projects')){const id='p'+(++sequence);projects.set(String(args[0]),id);return {rows:[{id}]}}
  if(sql.startsWith('INSERT INTO project_members'))return {rows:[]}
  if(sql.startsWith('INSERT INTO project_documents')){storedDocument=JSON.parse(String(args[1]));return {rows:[]}}
  if(sql.startsWith('INSERT INTO project_document_versions'))return {rows:[]}
  throw Error('SQL inesperado: '+sql)
 }} as unknown as PoolClient
 const a=await provisionUserDemo(db,'u1')
 assert.equal(a.created,true)
 assert.equal((storedDocument as {diagrams:unknown[]}).diagrams.length,19)
 assert.ok(sqlLog.some(s=>s.includes('workspace_members')))
 const prior=sqlLog.length
 const again=await provisionUserDemo(db,'u1')
 assert.equal(again.created,false)
 assert.equal(sqlLog.slice(prior).filter(s=>s.startsWith('INSERT INTO project_')).length,0)
 const b=await provisionUserDemo(db,'u2')
 assert.equal(b.created,true)
 assert.notEqual(b.workspaceId,a.workspaceId)
 assert.notEqual(b.projectId,a.projectId)
 assert.equal(DEMO_WORKSPACE_NAME,'NOVZI · DEMO')
 assert.match(DEMO_PROJECT_NAME,/exploración/)
})
