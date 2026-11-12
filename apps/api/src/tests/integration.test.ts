import {test} from 'node:test'
import {strict as assert} from 'node:assert'
import {randomUUID} from 'node:crypto'
import {pool} from '../db/pool'
import {WorkspacesService} from '../modules/workspaces/application/workspaces.service'
import {ProjectsService} from '../modules/projects/application/projects.service'
import {emptyDoc} from '@atlas/contracts'

if(process.env.NODE_ENV!=='test'||process.env.ATLAS_ALLOW_DB_TESTS!=='true'){
 throw new Error('Pruebas de BD bloqueadas. Usa NODE_ENV=test y ATLAS_ALLOW_DB_TESTS=true con una BD EXCLUSIVA de pruebas.')
}
const w=new WorkspacesService(),p=new ProjectsService()
test('aislamiento multi-tenant, permisos de lector y concurrencia optimista',async()=>{
 const owner=randomUUID(),outside=randomUUID(),viewer=randomUUID()
 let ws=''
 try{
  ws=await w.create('Espacio QA '+randomUUID().slice(0,8),owner)
  assert.equal((await w.list(outside)).length,0)
  const project=await p.create(ws,'Proyecto QA',emptyDoc(),owner)
  assert.equal((await p.loadDocument(project.id,owner))?.version,1)
  await assert.rejects(()=>p.loadDocument(project.id,outside))
  await assert.rejects(()=>p.saveDocument(project.id,emptyDoc(),1,outside))
  const viewerRole=await pool.query<{id:string}>("SELECT id FROM workspace_roles WHERE workspace_id=$1 AND role_key='viewer'",[ws])
  assert.ok(viewerRole.rows[0],'El espacio debe tener el rol viewer inicializado')
  await pool.query("INSERT INTO workspace_members(workspace_id,user_id,role,role_id) VALUES($1,$2,'viewer',$3)",[ws,viewer,viewerRole.rows[0].id])
  assert.equal((await p.loadDocument(project.id,viewer))?.version,1)
  await assert.rejects(()=>p.saveDocument(project.id,emptyDoc(),1,viewer))
  assert.equal(await p.saveDocument(project.id,emptyDoc(),1,owner),2)
  await assert.rejects(()=>p.saveDocument(project.id,emptyDoc(),1,owner),{statusCode:409})
  const versions=await p.listVersions(project.id,owner)
  assert.deepEqual(versions.map(v=>v.version),[2,1])
 }finally{if(ws)await pool.query('DELETE FROM workspaces WHERE id=$1',[ws]);await pool.end()}
})
