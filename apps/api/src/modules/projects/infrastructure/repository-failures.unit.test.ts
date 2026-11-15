import {test} from 'node:test'
import assert from 'node:assert/strict'
import {pool} from '../../../db/pool'
import {ProjectsRepository} from './projects.repository'
import {WorkspacesRepository} from '../../workspaces/infrastructure/workspaces.repository'
import {emptyDoc} from '@atlas/contracts'
// Mock only the PostgreSQL boundary. No sockets or working database are used.
test('repositorios: consultas sin filas conservan ausencia y no fabrican resultados',async t=>{
 const query=t.mock.method(pool,'query',async()=>({rows:[],rowCount:0}))
 const p=new ProjectsRepository(),w=new WorkspacesRepository()
 assert.equal(await w.role('w','u'),null);assert.equal(await p.scope('p','u'),null);assert.equal(await p.loadVersion('p',1),null);assert.equal(await p.loadDocument('p'),null)
 assert.equal(query.mock.callCount(),4)
})
test('repositorios: rol presente se devuelve sin elevar permisos',async t=>{
 t.mock.method(pool,'query',async()=>({rows:[{role:'viewer'}],rowCount:1}))
 assert.equal(await new WorkspacesRepository().role('w','u'),'viewer')
})
const transactionalFailures=[
 ['crear proyecto',(p:ProjectsRepository,w:WorkspacesRepository)=>p.create('w','QA',emptyDoc(),'u'),'INSERT INTO projects',false],
 ['renombrar proyecto',(p:ProjectsRepository,w:WorkspacesRepository)=>p.rename('p','QA','u'),'SELECT workspace_id',true],
 ['eliminar proyecto',(p:ProjectsRepository,w:WorkspacesRepository)=>p.delete('p','u'),'SELECT workspace_id',true],
 ['renombrar workspace',(p:ProjectsRepository,w:WorkspacesRepository)=>w.rename('w','QA','u'),'SELECT id FROM workspaces',true],
 ['eliminar workspace',(p:ProjectsRepository,w:WorkspacesRepository)=>w.delete('w','u'),'SELECT name FROM workspaces',true],
 ['crear workspace',(p:ProjectsRepository,w:WorkspacesRepository)=>w.create('QA','u'),'INSERT INTO workspaces',false],
 ['crear rama',(p:ProjectsRepository,w:WorkspacesRepository)=>p.createRestoreBranch('p',1,'u'),'SELECT p.workspace_id',true],
 ['aplicar rama',(p:ProjectsRepository,w:WorkspacesRepository)=>p.applyRestoreBranch('p','b','u',1,{},'merge'),'SELECT p.workspace_id',true],
] as const
for(const [name,invoke,expectedQuery,isMissing] of transactionalFailures){
 test('repositorios: '+name+' revierte la transacción y libera el cliente',async t=>{
  const seen:string[]=[],failure=new Error('Fallo SQL controlado QA')
  const client={query:async(sql:string)=>{seen.push(sql.trim());if(isMissing)return {rows:[],rowCount:0};if(sql.includes(expectedQuery))throw failure;return {rows:[],rowCount:0}},release:()=>{seen.push('RELEASE')}}
  t.mock.method(pool,'connect',async()=>client)
  const action=invoke(new ProjectsRepository(),new WorkspacesRepository())
  if(isMissing)await assert.rejects(action,{statusCode:404});else await assert.rejects(action,error=>error===failure)
  assert.ok(seen.some(sql=>sql.includes(expectedQuery)));assert.equal(seen[0],'BEGIN');assert.deepEqual(seen.slice(-2),['ROLLBACK','RELEASE']);assert.ok(!seen.includes('COMMIT'))
 })
}


// Simulate exact SQL boundary outcomes; never open a database connection.
for(const [label,call,status] of [
 ['listar',(p:ProjectsRepository)=>p.listRestoreBranches('p','u'),403],
 ['previsualizar',(p:ProjectsRepository)=>p.previewRestoreBranch('p','b','u'),403],
] as const){test('repositorio rechaza '+label+' ramas a rol no propietario',async t=>{
 const query=t.mock.method(pool,'query',async(sql:string)=>{if(sql.includes('FROM projects p JOIN workspace_members'))return {rows:[{workspace_id:'w',workspace_role:'editor',id:'r',role_key:'editor',name:'Editor'}]};if(sql.includes('FROM role_permissions'))return {rows:[{permission:'project.read'}]};throw Error('SQL inesperado '+sql)})
 await assert.rejects(call(new ProjectsRepository()),{statusCode:status});assert.equal(query.mock.callCount(),2)
})}
for(const [label,invoke] of [['crear',(p:ProjectsRepository)=>p.createRestoreBranch('p',1,'u')],['aplicar',(p:ProjectsRepository)=>p.applyRestoreBranch('p','b','u',1,{},'merge')],['descartar',(p:ProjectsRepository)=>p.discardRestoreBranch('p','b','u')]] as const){test('repositorio rechaza '+label+' rama sin privilegio y revierte',async t=>{
 const seen:string[]=[];const client={query:async(sql:string)=>{seen.push(sql.trim());if(sql.includes('SELECT p.workspace_id,d.version'))return {rows:[{workspace_id:'w',version:1,document:emptyDoc()}]};if(sql.includes('FROM projects p JOIN workspace_members'))return {rows:[{workspace_id:'w',workspace_role:'editor',id:'r',role_key:'editor',name:'Editor'}]};if(sql.includes('FROM role_permissions'))return {rows:[{permission:'project.read'}]};if(sql==='BEGIN'||sql==='ROLLBACK')return {rows:[]};throw Error('SQL inesperado '+sql)},release:()=>seen.push('RELEASE')};t.mock.method(pool,'connect',async()=>client)
 await assert.rejects(invoke(new ProjectsRepository()),{statusCode:403});assert.deepEqual(seen.slice(-2),['ROLLBACK','RELEASE']);assert.ok(!seen.includes('COMMIT'))
})}

for(const [label,invoke,stop] of [
 ['renombrar sin fila actualizada',(p:ProjectsRepository)=>p.rename('p','QA','u'),'UPDATE projects p'],
 ['crear rama sin versión histórica',(p:ProjectsRepository)=>p.createRestoreBranch('p',1,'u'),'SELECT 1 FROM project_document_versions'],
 ['descartar rama ausente',(p:ProjectsRepository)=>p.discardRestoreBranch('p','b','u'),'UPDATE project_restore_branches'],
 ['aplicar rama sin snapshots',(p:ProjectsRepository)=>p.applyRestoreBranch('p','b','u',1,{},'replace'),'SELECT version,document FROM project_document_versions'],
] as const)test('repositorio propietario: '+label+' revierte sin escribir auditoría',async t=>{
 const seen:string[]=[];const client={query:async(sql:string)=>{
  seen.push(sql.trim());if(sql.includes(stop))return {rows:[],rowCount:0}
  if(sql.includes('SELECT workspace_id FROM projects')||sql.includes('SELECT p.workspace_id,d.version'))return {rows:[{workspace_id:'w',version:1,document:emptyDoc()}]}
  if(sql.includes('FROM projects p JOIN workspace_members'))return {rows:[{workspace_id:'w',workspace_role:'owner'}]}
  if(sql.includes('FROM workspace_members m JOIN workspace_roles'))return {rows:[{id:'r',role_key:'owner',name:'Owner'}]}
  if(sql.includes('FROM role_permissions'))return {rows:[]}
  if(sql.includes('SELECT source_version,base_version,status'))return {rows:[{source_version:2,base_version:1,status:'open'}]}
  if(sql==='BEGIN'||sql==='ROLLBACK')return {rows:[]};throw Error('SQL inesperado '+sql)
 },release:()=>seen.push('RELEASE')};t.mock.method(pool,'connect',async()=>client)
 await assert.rejects(invoke(new ProjectsRepository()),{statusCode:404});assert.ok(seen.some(s=>s.includes(stop)));assert.deepEqual(seen.slice(-2),['ROLLBACK','RELEASE']);assert.ok(!seen.some(s=>s.includes('INSERT INTO audit_events')))
})
