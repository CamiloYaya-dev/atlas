import {test} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {buildApp} from '../app'
import {pool} from '../db/pool'
import {hashPassword} from '../security/password'
import {createElement,emptyDoc} from '@atlas/contracts'
import type {ProjectDocument} from '@atlas/contracts'

// Never run against the user's working or production database.
const url=process.env.DATABASE_URL||''
if(process.env.NODE_ENV!=='test'||process.env.ATLAS_ALLOW_DB_TESTS!=='true'||!/127\.0\.0\.1:5433\/atlas_test(?:\?|$)/.test(url)){
 throw new Error('Solo permitido en PostgreSQL exclusivo QA: 127.0.0.1:5433/atlas_test')
}
type User={cookie:string;csrf:string;id:string}
test('API real: autenticación, administración, roles, diagramas y aislamiento',async t=>{
 const app=await buildApp()
 const suffix=randomUUID().slice(0,8)
 const adminEmail=`qa-admin-${suffix}@example.test`,memberEmail=`qa-member-${suffix}@example.test`
 const pass='ContraseñaSegura!2026',invalidPass='ClaveIncorrecta!2026'
 let adminId='',memberId='',workspaceId='',projectId=''
 const send=async(method:'GET'|'POST'|'PUT'|'PATCH'|'DELETE',path:string,user?:User,payload?:object,extraHeaders:Record<string,string>={})=>{
  const r=await app.inject({method,url:`/api/v1${path}`,headers:{...(user?{cookie:user.cookie,'x-csrf-token':user.csrf}:{}),...extraHeaders},...(payload===undefined?{}:{payload})})
  return {status:r.statusCode,data:r.json() as Record<string,any>,headers:r.headers}
 }
 const signin=async(email:string,password:string)=>{
  const r=await send('POST','/auth/login',undefined,{email,password})
  if(r.status!==200)return {status:r.status}
  return {status:r.status,user:{id:r.data.user.id,csrf:r.data.csrfToken,cookie:String(r.headers['set-cookie']).split(';')[0]} as User}
 }
 let admin:User|undefined,member:User|undefined
 try{
  const record=await pool.query<{id:string}>(`INSERT INTO atlas_users(email,display_name,password_hash,platform_admin)
   VALUES($1,$2,$3,true) RETURNING id`,[adminEmail,'QA Admin',await hashPassword(pass)])
  adminId=record.rows[0].id
  await t.test('No hay endpoints públicos de registro; /me exige sesión',async()=>{
   assert.equal((await send('GET','/auth/me')).status,401)
   assert.equal((await send('POST','/auth/register',undefined,{})).status!==201,true)
  })
  await t.test('Login rechaza credenciales equivocadas y acepta las correctas',async()=>{
   assert.equal((await signin(adminEmail,invalidPass)).status,401)
   const result=await signin(adminEmail,pass)
   assert.equal(result.status,200);admin=result.user
   assert.ok(admin?.cookie.startsWith('atlas_session='))
   assert.equal((await send('GET','/auth/me',admin)).status,200)
   assert.equal(String((await send('GET','/auth/me',admin)).headers['cache-control']),'no-store')
  })
  await t.test('CSRF y CORS bloquean modificaciones no autorizadas',async()=>{
   assert.equal((await send('POST','/workspaces',undefined,{name:'QA'})).status,401)
   const noCsrf=await app.inject({method:'POST',url:'/api/v1/workspaces',headers:{cookie:admin!.cookie},payload:{name:'Test'}})
   assert.equal(noCsrf.statusCode,403)
   assert.equal((await send('POST','/workspaces',admin,{name:'Test'},{origin:'https://evil.example'})).status,403)
  })
  await t.test('Solo administrador puede crear usuarios; datos inválidos y duplicados fallan',async()=>{
   const invalid=await send('POST','/admin/users',admin,{email:'incorrecto',name:'A',password:pass})
   assert.equal(invalid.status,400)
   const created=await send('POST','/admin/users',admin,{email:memberEmail,name:'QA Member',password:pass})
   assert.equal(created.status,201);memberId=created.data.id
   assert.equal((await send('POST','/admin/users',admin,{email:memberEmail,name:'Otro',password:pass})).status,409)
   assert.equal((await send('GET','/admin/users',admin)).status,200)
  })
  await t.test('Suspender usuario impide ingreso; reactivar permite ingreso',async()=>{
   assert.equal((await send('PATCH',`/admin/users/${memberId}`,admin,{active:false})).status,200)
   assert.equal((await signin(memberEmail,pass)).status,401)
   assert.equal((await send('PATCH',`/admin/users/${memberId}`,admin,{active:true})).status,200)
   const result=await signin(memberEmail,pass)
   assert.equal(result.status,200);member=result.user
   assert.equal((await send('PATCH',`/admin/users/${adminId}`,admin,{active:false})).status,409)
  })
  await t.test('Usuario normal no administra otros usuarios ni crea espacios',async()=>{
   assert.equal((await send('GET','/admin/users',member)).status,403)
   assert.equal((await send('POST','/workspaces',member,{name:'No autorizado'})).status,403)
  })
  await t.test('Administrador crea workspace y proyecto; proyecto inicial vacío',async()=>{
   const w=await send('POST','/workspaces',admin,{name:'Espacio QA '+suffix})
   assert.equal(w.status,201);workspaceId=w.data.id
   assert.equal((await send('GET','/workspaces',admin)).status,200)
   const p=await send('POST',`/workspaces/${workspaceId}/projects`,admin,{name:'Proyecto de pruebas',document:emptyDoc()})
   assert.equal(p.status,201);projectId=p.data.id
   const loaded=await send('GET',`/projects/${projectId}/document`,admin)
   assert.equal(loaded.status,200);assert.equal(loaded.data.version,1)
   assert.equal((await send('POST',`/workspaces/${workspaceId}/projects`,admin,{name:'Inválido',document:{foo:'bar'}})).status,400)
  })
  await t.test('Roles y miembros: configurables, con permisos mínimos y sin asignar propietario',async()=>{
   const roles=await send('GET',`/workspaces/${workspaceId}/roles`,admin)
   assert.equal(roles.status,200)
   const ownerRole=roles.data.find((r:{role_key:string})=>r.role_key==='owner')
   assert.equal((await send('PUT',`/workspaces/${workspaceId}/roles/${ownerRole.id}`,admin,{permissions:[]})).status,403)
   const result=await send('POST',`/workspaces/${workspaceId}/roles`,admin,{roleKey:'qa_view',name:'QA Viewer',permissions:['project.read','diagram.view.c1','element.view.activity']})
   assert.equal(result.status,201)
   assert.equal((await send('POST',`/workspaces/${workspaceId}/members`,admin,{userId:memberId,roleId:ownerRole.id})).status,403)
   assert.equal((await send('POST',`/workspaces/${workspaceId}/members`,admin,{userId:memberId,roleId:result.data.id})).status,201)
   const access=await send('GET',`/workspaces/${workspaceId}/access`,member)
   assert.equal(access.status,200);assert.ok(access.data.permissions.includes('diagram.view.c1'))
   assert.equal((await send('POST',`/workspaces/${workspaceId}/roles`,member,{roleKey:'bad',name:'Privilegios',permissions:[]})).status,403)
   assert.equal((await send('GET',`/workspaces/${workspaceId}/members`,member)).status,403)
  })
  await t.test('Guardar C1+C2 y filtrar C2 de usuarios sin permiso',async()=>{
   const doc=emptyDoc(),a=createElement('Acceder','activity'),b=createElement('API privada','endpoint')
   a.id='activity';b.id='endpoint';b.technical='Secreto interno'
   doc.elements={activity:a,endpoint:b}
   doc.diagrams=[
    {id:'c1',name:'Contexto',type:'c1',description:'',createdAt:'2026-01-01',nodes:[{id:'na',elementId:'activity',x:1,y:2}],edges:[]},
    {id:'c2',name:'Contenedores',type:'c2',description:'',createdAt:'2026-01-01',nodes:[{id:'nb',elementId:'endpoint',x:3,y:4}],edges:[]}
   ]
   const saved=await send('PUT',`/projects/${projectId}/document`,admin,{document:doc,expectedVersion:1})
   assert.equal(saved.status,200,`Error al guardar: ${JSON.stringify(saved.data)}`);assert.equal(saved.data.version,2)
   const subset=await send('GET',`/projects/${projectId}/document`,member)
   assert.equal(subset.status,200)
   assert.deepEqual(subset.data.document.diagrams.map((d:{id:string})=>d.id),['c1'])
   assert.equal(subset.data.document.elements.endpoint,undefined)
   assert.equal((await send('GET',`/projects/${projectId}/export`,member)).status,403)
   assert.equal((await send('GET',`/projects/${projectId}/export`,admin)).status,200)
   assert.equal((await send('POST',`/projects/${projectId}/import`,member,{document:doc,expectedVersion:2})).status,403)
  })
  await t.test('Lector no edita ni importa, versiones optimistas evitan sobrescritura',async()=>{
   const read=await send('GET',`/projects/${projectId}/document`,member)
   assert.equal(read.status,200,`Error al leer: ${JSON.stringify(read.data)}`)
   assert.ok(read.data.document?.elements?.activity,'La actividad debe estar presente; revisa el guardado anterior')
   read.data.document.elements.activity.name='Editado sin permiso'
   assert.equal((await send('PUT',`/projects/${projectId}/document`,member,{document:read.data.document,expectedVersion:2})).status,403)
   const original=await send('GET',`/projects/${projectId}/document`,admin)
   assert.equal((await send('PUT',`/projects/${projectId}/document`,admin,{document:original.data.document,expectedVersion:1})).status,409)
   const versions=await send('GET',`/projects/${projectId}/versions`,admin)
   assert.equal(versions.status,200);assert.ok(versions.data.length>=2)
  })
  await t.test('Intento de leer otro proyecto sin membresía se rechaza',async()=>{
   const second=await send('POST','/workspaces',admin,{name:'Workspace aislado '+suffix})
   assert.equal(second.status,201)
   try{
    const p=await send('POST',`/workspaces/${second.data.id}/projects`,admin,{name:'Confidencial',document:emptyDoc()})
    assert.equal(p.status,201)
    assert.equal((await send('GET',`/projects/${p.data.id}/document`,member)).status,404)
    assert.equal((await send('PUT',`/projects/${p.data.id}/document`,member,{document:emptyDoc(),expectedVersion:1})).status,404)
   }finally{await pool.query('DELETE FROM workspaces WHERE id=$1',[second.data.id])}
  })
  await t.test('Logout invalida la sesión',async()=>{
   assert.equal((await send('POST','/auth/logout',member)).status,200)
   assert.equal((await send('GET','/auth/me',member)).status,401)
  })
 }finally{
  if(workspaceId)await pool.query('DELETE FROM workspaces WHERE id=$1',[workspaceId])
  if(memberId)await pool.query('DELETE FROM atlas_users WHERE id=$1',[memberId])
  if(adminId)await pool.query('DELETE FROM atlas_users WHERE id=$1',[adminId])
  await app.close();await pool.end()
 }
})
