import {test} from 'node:test'
import assert from 'node:assert/strict'
import {pool} from '../../../db/pool'
import {ProjectsRepository} from './projects.repository'
import {WorkspacesRepository} from '../../workspaces/infrastructure/workspaces.repository'

const workspace='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222'
const owner={id:'role',role_key:'owner',name:'Propietario'}

test('Repositorios: listados devuelven únicamente filas autorizadas sin fabricar metadatos',async t=>{
 const response=[{id:'p',workspace_id:workspace,name:'Proyecto autorizado',description:''}]
 t.mock.method(pool,'query',async(sql:string)=>({rows:sql.includes('project_document_versions')?[{version:3,editor_name:'QA'}]:sql.includes('SELECT p.workspace_id AS')?[{workspaceId:workspace}]:sql.includes('SELECT DISTINCT p.id')?response:[{id:workspace,name:'Empresa',role:'owner'}]}))
 const p=new ProjectsRepository(),w=new WorkspacesRepository()
 assert.deepEqual(await p.list(workspace,user),response)
 assert.deepEqual(await p.scope('p',user),{workspaceId:workspace})
 assert.deepEqual(await p.listVersions('p'),[{version:3,editor_name:'QA'}])
 assert.deepEqual(await w.listForUser(user),[{id:workspace,name:'Empresa',role:'owner'}])
})

test('Workspace vacío: borrado autorizado confirma transacción, no inventa proyectos ni permisos',async t=>{
 const seen:string[]=[]
 const client={query:async(sql:string)=>{
  seen.push(sql.trim());if(sql.includes('SELECT name FROM workspaces'))return {rows:[{name:'Empresa QA'}]}
  if(sql.includes('FROM workspace_members m JOIN workspace_roles'))return {rows:[owner]}
  if(sql.includes('FROM role_permissions'))return {rows:[]}
  if(sql.includes('SELECT count(*)'))return {rows:[{total:'0'}]}
  return {rows:[],rowCount:1}
 },release:()=>seen.push('RELEASE')}
 t.mock.method(pool,'connect',async()=>client)
 assert.deepEqual(await new WorkspacesRepository().delete(workspace,user),{ok:true,deletedProjects:0})
 assert.ok(seen.some(q=>q.includes('DELETE FROM workspaces')))
 assert.deepEqual(seen.slice(-2),['COMMIT','RELEASE']);assert.ok(!seen.includes('ROLLBACK'))
})

test('Workspace con proyectos: requiere confirmación exacta y propietario; falla cerrado y revierte',async t=>{
 const seen:string[]=[]
 const client={query:async(sql:string)=>{
  seen.push(sql.trim());if(sql.includes('SELECT name FROM workspaces'))return {rows:[{name:'Empresa QA'}]}
  if(sql.includes('FROM workspace_members m JOIN workspace_roles'))return {rows:[owner]}
  if(sql.includes('FROM role_permissions'))return {rows:[]}
  if(sql.includes('SELECT count(*)'))return {rows:[{total:'2'}]}
  return {rows:[],rowCount:1}
 },release:()=>seen.push('RELEASE')}
 t.mock.method(pool,'connect',async()=>client)
 for(const options of [undefined,[],{deleteProjects:false,confirmName:'Empresa QA'},{deleteProjects:true,confirmName:'Empresa equivocada'}]){
  const snapshot=seen.length
  await assert.rejects(new WorkspacesRepository().delete(workspace,user,options),{statusCode:409})
  assert.deepEqual(seen.slice(-2),['ROLLBACK','RELEASE'])
  assert.ok(!seen.slice(snapshot).some(x=>x.includes('DELETE FROM workspaces')))
 }
 assert.deepEqual(await new WorkspacesRepository().delete(workspace,user,{deleteProjects:true,confirmName:'Empresa QA'}),{ok:true,deletedProjects:2})
 assert.deepEqual(seen.slice(-2),['COMMIT','RELEASE'])
})

test('Workspace con proyectos: administrador delegado no puede forzar eliminación aun con permiso workspace.delete',async t=>{
 const seen:string[]=[]
 const client={query:async(sql:string)=>{
  seen.push(sql.trim());if(sql.includes('SELECT name FROM workspaces'))return {rows:[{name:'Empresa QA'}]}
  if(sql.includes('FROM workspace_members m JOIN workspace_roles'))return {rows:[{id:'role',role_key:'editor',name:'Editor'}]}
  if(sql.includes('FROM role_permissions'))return {rows:[{permission:'workspace.delete'}]}
  if(sql.includes('SELECT count(*)'))return {rows:[{total:'2'}]}
  return {rows:[],rowCount:1}
 },release:()=>seen.push('RELEASE')}
 t.mock.method(pool,'connect',async()=>client)
 await assert.rejects(new WorkspacesRepository().delete(workspace,user,{deleteProjects:true,confirmName:'Empresa QA'}),{statusCode:409})
 assert.deepEqual(seen.slice(-2),['ROLLBACK','RELEASE'])
 assert.ok(!seen.some(x=>x.includes('DELETE FROM workspaces')))
})
