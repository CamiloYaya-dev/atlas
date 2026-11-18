import {test} from 'node:test'
import assert from 'node:assert/strict'
import {emptyDoc,createElement} from '@novzi/contracts'
import {ProjectsService} from './projects.service'
import {ProjectsRepository} from '../infrastructure/projects.repository'
import {pool} from '../../../db/pool'

// Only database adapters are replaced. The actual service validates payload,
// authorization, conflict status, history and oversized documents.
const workspace='w',project='p',actor='u'
const repo=()=>new ProjectsRepository()
const nonEmpty=()=>{const d=emptyDoc();const e=createElement('Actor QA','actor');d.elements[e.id]=e;return d}

test('proyecto inaccesible: todas las lecturas y operaciones históricas fallan antes de consultar documentos',async t=>{
 const r=repo();t.mock.method(r,'scope',async()=>null)
 const load=t.mock.method(r,'loadDocument',async()=>{throw Error('No debe consultarse el documento')})
 const service=new ProjectsService(r)
 for(const call of [()=>service.rename(project,'Nuevo nombre',actor),()=>service.restoreVersion(project,1,2,actor),()=>service.assertReadable(project,actor),()=>service.loadDocument(project,actor),()=>service.listVersions(project,actor),()=>service.loadVersion(project,1,actor),()=>service.exportDocument(project,actor),()=>service.listRestoreBranches(project,actor),()=>service.applyRestoreBranch(project,'b',actor,{})])await assert.rejects(call,{statusCode:404})
 assert.equal(load.mock.callCount(),0)
})

test('validación de guardado y colaboración impide enviar datos inválidos, exceso de tamaño y versiones incorrectas al repositorio',async t=>{
 const r=repo();const save=t.mock.method(r,'saveAuthorized',async()=>null),collab=t.mock.method(r,'saveCollaborative',async()=>null)
 const service=new ProjectsService(r),big=nonEmpty();Object.values(big.elements)[0].summary='x'.repeat(4*1024*1024+1)
 // El modelo admite texto libre, pero la política limita el tamaño del JSON.
 for(const [method,spy] of [[service.saveDocument.bind(service),save],[service.saveCollaborative.bind(service),collab]] as const){
  await assert.rejects(()=>method(project,{},1,actor),{statusCode:400})
  await assert.rejects(()=>method(project,big,1,actor),{statusCode:413})
  for(const version of [0,1.5,'2',Number.MAX_SAFE_INTEGER+1])await assert.rejects(()=>method(project,emptyDoc(),version,actor),{statusCode:400})
  assert.equal(spy.mock.callCount(),0)
  await assert.rejects(()=>method(project,emptyDoc(),1,actor),{statusCode:409})
  assert.equal(spy.mock.callCount(),1)
 }
})

test('historial del propietario: versiones inválidas, documento ausente, CAS y restauración controlada',async t=>{
 const r=repo();t.mock.method(r,'scope',async()=>({workspaceId:workspace}))
 t.mock.method(pool,'query',async(sql:string)=>{
  if(sql.includes('FROM projects p JOIN workspace_members'))return {rows:[{workspace_id:workspace,workspace_role:'owner',id:null,role_key:null,name:null}]}
  if(sql.includes('FROM workspace_members m JOIN workspace_roles'))return {rows:[{id:'owner',role_key:'owner',name:'Propietario'}]}
  if(sql.includes('SELECT permission FROM role_permissions'))return {rows:[]}
  throw Error('Consulta inesperada en QA: '+sql)
 })
 const historical=emptyDoc(),versionRow={document:historical,version:1,created_at:'2026-11-14',updated_by:actor,editor_name:'QA'}
 let found=false,next:number|null=null
 t.mock.method(r,'loadVersion',async()=>found?versionRow:null)
 t.mock.method(r,'loadDocument',async()=>null)
 const save=t.mock.method(r,'saveAuthorized',async()=>next)
 const apply=t.mock.method(r,'applyRestoreBranch',async()=>({version:4,restoredFrom:1,mode:'merge'}))
 const service=new ProjectsService(r)
 for(const v of [0,1.1,'1',Infinity]){
  await assert.rejects(()=>service.restoreVersion(project,v,2,actor),{statusCode:400})
  await assert.rejects(()=>service.restoreVersion(project,1,v,actor),{statusCode:400})
 }
 await assert.rejects(()=>service.loadVersion(project,1,actor),{statusCode:404})
 assert.equal(await service.loadDocument(project,actor),null)
 await assert.rejects(()=>service.exportDocument(project,actor),{statusCode:404})
 await assert.rejects(()=>service.restoreVersion(project,1,2,actor),{statusCode:404})
 found=true;await assert.rejects(()=>service.restoreVersion(project,1,2,actor),{statusCode:409})
 next=3;assert.deepEqual(await service.restoreVersion(project,1,2,actor),{version:3,restoredFrom:1})
 assert.deepEqual(save.mock.calls.at(-1)?.arguments,[project,historical,2,actor,'restore',1])
 for(const resolutions of [false,[],{'outside.path':'current'},{'document.x':'neither'},{['document.'+'x'.repeat(500)]:'current'},Object.fromEntries(Array.from({length:501},(_,i)=>['document.'+i,'current']))])await assert.rejects(()=>service.applyRestoreBranch(project,'b',actor,{expectedVersion:3,mode:'merge',resolutions}),{statusCode:400})
 assert.equal(apply.mock.callCount(),0)
 assert.deepEqual(await service.applyRestoreBranch(project,'b',actor,{expectedVersion:3,mode:'merge'}),{version:4,restoredFrom:1,mode:'merge'})
 assert.deepEqual(apply.mock.calls[0]?.arguments,[project,'b',actor,3,{},'merge'])
})
