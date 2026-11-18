import {test} from 'node:test'
import assert from 'node:assert/strict'
import type {PoolClient} from 'pg'
import {assertLocalDemoResetAllowed,isExplicitDemoReset} from './reset-demo-policy'
import {resetToCanonicalDemos} from './reset-demo-core'

test('reinicio bloqueado para producción, QA y direcciones externas',()=>{
 const local={DATABASE_URL:'postgresql://atlas:secret@127.0.0.1:5432/atlas',NODE_ENV:'development'}
 assert.doesNotThrow(()=>assertLocalDemoResetAllowed(local))
 for(const data of [{...local,NODE_ENV:'production'}, {...local,NODE_ENV:'test'}, {...local,NOVZI_ALLOW_DB_TESTS:'true'},
  {...local,DATABASE_URL:'postgresql://atlas:secret@127.0.0.1:5433/novzi_test'},
  {...local,DATABASE_URL:'postgresql://atlas:secret@otherhost:5432/atlas'},
  {...local,MIGRATIONS_DATABASE_URL:'postgresql://atlas:secret@otherhost:5432/atlas'}]){
  assert.throws(()=>assertLocalDemoResetAllowed(data))
 }
 assert.equal(isExplicitDemoReset([]),false)
 assert.throws(()=>isExplicitDemoReset(['--apply']))
 assert.equal(isExplicitDemoReset(['--apply','--confirm=REINICIAR-SOLO-DEMOS']),true)
})

test('elimina contenido antiguo solo una vez, conserva usuarios y crea un demo por usuario',async()=>{
 const sql:string[]=[]
 const client={query:async(query:string)=>{
  sql.push(query)
  if(query.includes('SELECT action_key'))return {rows:[]}
  if(query.includes('FROM novzi_users'))return {rows:[{id:'u1'},{id:'u2'},{id:'u3'}]}
  if(query.includes('count(*)')&&query.includes('FROM workspaces'))return {rows:[{n:'5'}]}
  if(query.includes('count(*)')&&query.includes('FROM projects'))return {rows:[{n:'0'}]}
  return {rows:[]}
 }} as unknown as PoolClient
 const ids:string[]=[]
 const result=await resetToCanonicalDemos(client,async(_client,id)=>{ids.push(id);return {workspaceId:id,projectId:id,created:true}})
 assert.deepEqual(result,{accountsPreserved:3,demosCreated:3,workspacesRemoved:5})
 assert.deepEqual(ids,['u1','u2','u3'])
 assert.equal(sql.filter(s=>s==='DELETE FROM workspaces').length,1)
 assert.ok(sql.includes('COMMIT'))
 assert.ok(!sql.some(s=>/\b(?:DELETE|TRUNCATE)\s+(?:FROM\s+)?novzi_users/i.test(s)))
 assert.ok(!sql.some(s=>/DELETE FROM projects|DELETE FROM project_documents/.test(s)))
 assert.ok(sql.some(s=>s.includes('INSERT INTO novzi_maintenance_runs')))
})

test('si el reinicio ya ocurrió, bloquea la eliminación y revierte la transacción',async()=>{
 const sql:string[]=[]
 const client={query:async(query:string)=>{
  sql.push(query)
  if(query.includes('SELECT action_key'))return {rows:[{action_key:'novzi-local-initial-demo-reset-v1'}]}
  return {rows:[]}
 }} as unknown as PoolClient
 await assert.rejects(()=>resetToCanonicalDemos(client),/ya fue reiniciado/)
 assert.ok(sql.includes('ROLLBACK'))
 assert.ok(!sql.includes('DELETE FROM workspaces'))
})

test('si falla la creación de un demo, la operación hace ROLLBACK y no registra el reinicio',async()=>{
 const sql:string[]=[]
 const client={query:async(query:string)=>{
  sql.push(query)
  if(query.includes('SELECT action_key'))return {rows:[]}
  if(query.includes('FROM novzi_users'))return {rows:[{id:'u1'}]}
  if(query.includes('count(*)')&&query.includes('FROM workspaces'))return {rows:[{n:'2'}]}
  if(query.includes('count(*)')&&query.includes('FROM projects'))return {rows:[{n:'0'}]}
  return {rows:[]}
 }} as unknown as PoolClient
 await assert.rejects(()=>resetToCanonicalDemos(client,async()=>{throw Error('falló demo')}),/falló demo/)
 assert.ok(sql.includes('ROLLBACK'))
 assert.ok(!sql.includes('COMMIT'))
 assert.ok(!sql.some(s=>s.includes('INSERT INTO novzi_maintenance_runs')))
})
