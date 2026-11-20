import {test} from 'node:test'
import {strict as assert} from 'node:assert'
import {randomUUID} from 'node:crypto'
import {pool} from '../db/pool'
import {WorkspacesService} from '../modules/workspaces/application/workspaces.service'
import {ProjectsService} from '../modules/projects/application/projects.service'
import {emptyDoc} from '@novzi/contracts'
import {hashPassword} from '../security/password'

if(process.env.NODE_ENV!=='test'||process.env.NOVZI_ALLOW_DB_TESTS!=='true'||process.env.DATABASE_URL!=='postgresql://novzi:novzi_test_only@127.0.0.1:5433/novzi_test'){
 throw new Error('Pruebas de BD bloqueadas. Sólo se permite la base QA 127.0.0.1:5433/novzi_test.')
}
const w=new WorkspacesService(),p=new ProjectsService()
test('aislamiento multi-tenant, permisos de lector y concurrencia optimista',async()=>{
 const owner=randomUUID(),outside=randomUUID(),viewer=randomUUID()
 let ws=''
 try{
  // Las tres identidades deben existir en NOVZI: desde la migración 018,
  // organizations.created_by referencia una cuenta real (FK obligatoria).
  // No crear organizaciones con UUID inventados ni alterar esa FK.
  const passwordHash=await hashPassword('NovziQA!2026-local-only')
  for(const [id,role] of [[owner,'owner'],[outside,'outside'],[viewer,'viewer']] as const){
   await pool.query('INSERT INTO novzi_users(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)',
    [id,`qa-scoped-${role}-${id}@example.test`,`QA ${role}`,passwordHash])
  }
  ws=await w.create('Espacio QA '+randomUUID().slice(0,8),owner)
  assert.equal((await w.list(outside)).length,0)
  // Una base con DOS diagramas permite comprobar cambios reales e independientes.
  const initial=emptyDoc()
  initial.diagrams.push(
   {id:randomUUID(),type:'c2',name:'C2 inicial QA',description:'',createdAt:'2026-11-19',nodes:[],edges:[]},
   {id:randomUUID(),type:'process',name:'Proceso inicial QA',description:'',createdAt:'2026-11-19',nodes:[],edges:[]}
  )
  // El contrato de NOVZI exige crear el proyecto vacío y después guardar
  // el primer documento con diagramas. Nunca sembrar vistas en create().
  const project=await p.create(ws,'Proyecto QA',emptyDoc(),owner)
  assert.equal((await p.loadDocument(project.id,owner))?.version,1)
  assert.equal(await p.saveDocument(project.id,initial,1,owner),2)
  const c2Id=initial.diagrams[0].id,processId=initial.diagrams[1].id
  assert.equal((await p.diagramState(project.id,c2Id,owner)).revision,1)
  assert.equal((await p.diagramState(project.id,processId,owner)).revision,1)
  await assert.rejects(()=>p.loadDocument(project.id,outside))
  await assert.rejects(()=>p.saveDocument(project.id,emptyDoc(),1,outside))
  const viewerRole=await pool.query<{id:string}>("SELECT id FROM workspace_roles WHERE workspace_id=$1 AND role_key='viewer'",[ws])
  assert.ok(viewerRole.rows[0],'El espacio debe tener el rol viewer inicializado')
  // El lector pertenece a la organización pero no hereda automáticamente
  // acceso a los proyectos: se prueba su asignación de forma independiente.
  const org=await pool.query<{organization_id:string}>('SELECT organization_id FROM workspaces WHERE id=$1',[ws])
  assert.ok(org.rows[0]?.organization_id,'El espacio QA debe pertenecer a una organización')
  await pool.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'member')",[org.rows[0].organization_id,viewer])
  await pool.query("INSERT INTO workspace_members(workspace_id,user_id,role,role_id) VALUES($1,$2,'viewer',$3)",[ws,viewer,viewerRole.rows[0].id])
  assert.deepEqual(await p.list(ws,viewer),[],'Un miembro del espacio no obtiene todos los proyectos')
  await assert.rejects(()=>p.loadDocument(project.id,viewer),{statusCode:404})
  await pool.query('INSERT INTO project_members(project_id,workspace_id,user_id,role_id) VALUES($1,$2,$3,$4)',[project.id,ws,viewer,viewerRole.rows[0].id])
  assert.equal((await p.loadDocument(project.id,viewer))?.version,2)
  await assert.rejects(()=>p.saveDocument(project.id,initial,2,viewer))
  // Guardar un documento identico NO debe generar otra version ni escritura.
  assert.equal(await p.saveDocument(project.id,structuredClone(initial),2,owner),2)
  assert.deepEqual((await p.listVersions(project.id,owner)).map(v=>v.version),[2,1])
  // Una edicion real de C2 incrementa el cursor tecnico, no el de otra vista.
  const updatedC2=structuredClone(initial)
  updatedC2.diagrams[0].name='C2 actualizado por propietario'
  assert.equal(await p.saveDocument(project.id,updatedC2,2,owner),3)
  assert.equal((await p.diagramState(project.id,c2Id,owner)).revision,2)
  assert.equal((await p.diagramState(project.id,processId,owner)).revision,1,'Editar C2 no cambia el cursor del proceso')
  // Otro editor con base v2 puede modificar un proceso DISTINTO sin perder C2.
  const updatedProcess=structuredClone(initial)
  updatedProcess.diagrams[1].name='Proceso editado en paralelo'
  const merged=await p.saveCollaborative(project.id,updatedProcess,2,owner)
  assert.equal(merged.version,4)
  assert.equal(merged.document.diagrams[0].name,'C2 actualizado por propietario')
  assert.equal(merged.document.diagrams[1].name,'Proceso editado en paralelo')
  assert.equal((await p.diagramState(project.id,c2Id,owner)).revision,2,'Editar el proceso no aumenta el cursor de C2')
  assert.equal((await p.diagramState(project.id,processId,owner)).revision,2)
  // Si dos personas cambian el MISMO campo de C2, se rechaza con 409.
  const incompatibleC2=structuredClone(initial)
  incompatibleC2.diagrams[0].name='C2 incompatible con cambio remoto'
  await assert.rejects(()=>p.saveCollaborative(project.id,incompatibleC2,2,owner),{statusCode:409})
  const after=await p.loadDocument(project.id,owner)
  assert.equal(after?.version,4,'Un conflicto no debe incrementar el cursor')
  assert.equal((await p.diagramState(project.id,c2Id,owner)).revision,2)
  assert.equal((await p.diagramState(project.id,processId,owner)).revision,2)
  assert.deepEqual((await p.listVersions(project.id,owner)).map(v=>v.version),[4,3,2,1])
 }finally{
  // Orden seguro de limpieza de fixtures: proyecto/espacio -> organización
  // -> cuentas. Nunca eliminar usuarios antes de organizations.created_by.
  try{
   if(ws)await pool.query('DELETE FROM workspaces WHERE id=$1',[ws])
   await pool.query("DELETE FROM organizations WHERE created_by=$1 AND name='NOVZI · Formación'",[owner])
   await pool.query('DELETE FROM novzi_users WHERE id = ANY($1::uuid[])',[[owner,outside,viewer]])
  }finally{await pool.end()}
 }
})
