import {test} from 'node:test'
import assert from 'node:assert/strict'
import type {Pool} from 'pg'
import {projectAccess,allowed} from './roles'
function db(rows:Array<Record<string,unknown>>,grants:string[]=[]){
 return {query:async(sql:string)=>{
  if(sql.includes('FROM projects p JOIN workspace_members'))return {rows}
  if(sql.includes('SELECT r.id,r.role_key,r.name FROM workspace_members'))return {rows:[{id:'owner',role_key:'owner',name:'Propietario'}]}
  if(sql.includes('SELECT permission FROM role_permissions'))return {rows:grants.map(permission=>({permission}))}
  throw new Error('Consulta no prevista en QA')
 }} as unknown as Pool
}
test('miembro del espacio sin acceso explícito no puede leer proyectos',async()=>{
 await assert.rejects(()=>projectAccess('p1','u2',db([{workspace_id:'w1',workspace_role:'viewer',id:null,role_key:null,name:null}])),{statusCode:404})
 await assert.rejects(()=>projectAccess('p1','externo',db([])),{statusCode:404})
})
test('dos proyectos del mismo usuario pueden otorgar permisos distintos',async()=>{
 const viewer=await projectAccess('p1','u1',db([{workspace_id:'w1',workspace_role:'viewer',id:'r1',role_key:'viewer',name:'Lector'}],['project.read','diagram.view.c1']))
 const editor=await projectAccess('p2','u1',db([{workspace_id:'w1',workspace_role:'viewer',id:'r2',role_key:'functional',name:'Funcional'}],['project.read','diagram.edit.c1']))
 assert.equal(allowed(viewer,'diagram.edit.c1'),false)
 assert.equal(allowed(editor,'diagram.edit.c1'),true)
 assert.equal(allowed(viewer,'project.read'),true)
})
test('propietario del espacio mantiene acceso a todos sus proyectos',async()=>{
 const owner=await projectAccess('p1','admin',db([{workspace_id:'w1',workspace_role:'owner',id:null,role_key:null,name:null}]))
 assert.equal(owner.roleKey,'owner');assert.equal(allowed(owner,'project.delete'),true)
})
