import {test} from 'node:test'
import {strict as assert} from 'node:assert'
import {randomUUID} from 'node:crypto'
import {pool} from '../db/pool'
import {WorkspacesService} from '../modules/workspaces/application/workspaces.service'
import {ProjectsService} from '../modules/projects/application/projects.service'
import {emptyDoc} from '@novzi/contracts'

// No se ejecutan fixtures destructivos contra desarrollo ni producción.
const db=process.env.DATABASE_URL||''
if(process.env.NODE_ENV!=='test'||process.env.NOVZI_ALLOW_DB_TESTS!=='true'||!/127\.0\.0\.1:5433\/novzi_test(?:\?|$)/.test(db)){
 throw new Error('Pruebas de BD bloqueadas: utilizar solo novzi_test en 127.0.0.1:5433')
}
const w=new WorkspacesService(),p=new ProjectsService()
test('aislamiento multi-tenant, permisos de lector y concurrencia optimista',async()=>{
 const owner=randomUUID(),outside=randomUUID(),viewer=randomUUID(),users=[owner,outside,viewer]
 let ws=''
 try{
  // Tras la creación de organizaciones, los propietarios deben existir
  // realmente para satisfacer organizations.created_by -> novzi_users.id.
  for(const [index,id] of users.entries())await pool.query(
   'INSERT INTO novzi_users(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)',
   [id,`qa-isolation-${id}@example.test`,`Usuario QA ${index}`,'qa-no-login-password-hash']
  )
  ws=await w.create('Espacio QA '+randomUUID().slice(0,8),owner)
  assert.equal((await w.list(outside)).length,0)
  const project=await p.create(ws,'Proyecto QA',emptyDoc(),owner)
  assert.equal((await p.loadDocument(project.id,owner))?.version,1)
  await assert.rejects(()=>p.loadDocument(project.id,outside))
  await assert.rejects(()=>p.saveDocument(project.id,emptyDoc(),1,outside))
  const viewerRole=await pool.query<{id:string}>("SELECT id FROM workspace_roles WHERE workspace_id=$1 AND role_key='viewer'",[ws])
  assert.ok(viewerRole.rows[0],'El espacio debe tener el rol viewer inicializado')
  // La pertenencia a una organización no concede acceso a proyectos.
  const org=await pool.query<{organization_id:string}>('SELECT organization_id FROM workspaces WHERE id=$1',[ws])
  await pool.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'member')",[org.rows[0].organization_id,viewer])
  await pool.query("INSERT INTO workspace_members(workspace_id,user_id,role,role_id) VALUES($1,$2,'viewer',$3)",[ws,viewer,viewerRole.rows[0].id])
  assert.deepEqual(await p.list(ws,viewer),[],'Un miembro del espacio no obtiene todos los proyectos')
  await assert.rejects(()=>p.loadDocument(project.id,viewer),{statusCode:404})
  await pool.query('INSERT INTO project_members(project_id,workspace_id,user_id,role_id) VALUES($1,$2,$3,$4)',[project.id,ws,viewer,viewerRole.rows[0].id])
  assert.equal((await p.loadDocument(project.id,viewer))?.version,1)
  await assert.rejects(()=>p.saveDocument(project.id,emptyDoc(),1,viewer))
  assert.equal(await p.saveDocument(project.id,emptyDoc(),1,owner),2)
  await assert.rejects(()=>p.saveDocument(project.id,emptyDoc(),1,owner),{statusCode:409})
  const versions=await p.listVersions(project.id,owner)
  assert.deepEqual(versions.map(v=>v.version),[2,1])
 }finally{
  try{
   if(ws)await pool.query('DELETE FROM workspaces WHERE id=$1',[ws])
   await pool.query('DELETE FROM organizations WHERE created_by=ANY($1::uuid[])',[users])
   await pool.query('DELETE FROM novzi_users WHERE id=ANY($1::uuid[])',[users])
  }finally{await pool.end()}
 }
})
