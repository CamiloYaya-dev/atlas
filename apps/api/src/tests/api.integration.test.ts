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
 // La suite usa varias aplicaciones Fastify aisladas para no consumir el límite
 // global 100/min entre bloques independientes. El limitador real permanece activo,
 // incluyendo el tope estricto de 6/min del login en CADA instancia.
 let app=await buildApp()
 const registerQaErrorRoute=(server:Awaited<ReturnType<typeof buildApp>>)=>{
  // Ruta exclusiva de inyección; no existe en la API publicada.
  server.get('/api/v1/_qa_unhandled_error',async()=>{throw new Error('Detalle interno secreto QA')})
 }
 registerQaErrorRoute(app)
 const resetQaRateLimitWindow=async()=>{
  await app.close()
  app=await buildApp()
  registerQaErrorRoute(app)
 }
 const suffix=randomUUID().slice(0,8)
 const adminEmail=`qa-admin-${suffix}@example.test`,memberEmail=`qa-member-${suffix}@example.test`
 const pass='ContraseñaSegura!2026',invalidPass='ClaveIncorrecta!2026'
 let adminId='',memberId='',extraId='',workspaceId='',projectId=''
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
  await t.test('Cuentas activas crean espacios propios, sin convertirse en administradores globales',async()=>{
   assert.equal((await send('GET','/admin/users',member)).status,403)
   const created=await send('POST','/workspaces',member,{name:'Espacio independiente '+suffix})
   assert.equal(created.status,201,JSON.stringify(created.data))
   const ownId=created.data.id
   try{
    const own=await send('GET','/workspaces',member)
    assert.equal(own.status,200)
    assert.ok(own.data.some((x:{id:string})=>x.id===ownId))
    assert.equal((await send('GET',`/workspaces/${ownId}/projects`,admin)).status,403)
    assert.equal((await send('POST',`/workspaces/${ownId}/projects`,admin,{name:'Sin acceso',document:emptyDoc()})).status,403)
    const p=await send('POST',`/workspaces/${ownId}/projects`,member,{name:'Proyecto personal',document:emptyDoc()})
    assert.equal(p.status,201,JSON.stringify(p.data))
    assert.equal((await send('DELETE',`/workspaces/${ownId}`,member)).status,409)
    assert.equal((await send('DELETE',`/projects/${p.data.id}`,member)).status,200)
    assert.equal((await send('DELETE',`/workspaces/${ownId}`,member)).status,200)
   }finally{await pool.query('DELETE FROM workspaces WHERE id=$1',[ownId])}
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
   // Space membership alone must NOT expose any existing project.
   assert.equal((await send('GET',`/projects/${projectId}/document`,member)).status,404)
   const hidden=await send('GET',`/workspaces/${workspaceId}/projects`,member)
   assert.equal(hidden.status,200);assert.equal(hidden.data.length,0)
   const candidates=await send('GET',`/projects/${projectId}/candidates`,admin)
   assert.equal(candidates.status,200);assert.ok(candidates.data.users.some((u:{id:string})=>u.id===memberId))
   assert.equal((await send('PUT',`/projects/${projectId}/members/${memberId}`,admin,{roleId:result.data.id})).status,200)
   assert.equal((await send('GET',`/projects/${projectId}/document`,member)).status,200)
   assert.equal((await send('GET',`/projects/${projectId}/members`,member)).status,403)
  })
  await t.test('Proyectos privados: U1 ve P1/P2, U2 solo P3; borrado y administración aislada',async()=>{
   // Another real account in the SAME workspace does not automatically see projects.
   const guestEmail=`qa-guest-${suffix}@example.test`
   const created=await send('POST','/admin/users',admin,{email:guestEmail,name:'QA Guest',password:pass})
   assert.equal(created.status,201);extraId=created.data.id
   const signed=await signin(guestEmail,pass);assert.equal(signed.status,200);const guest=signed.user!
   const roleList=await send('GET',`/workspaces/${workspaceId}/roles`,admin)
   const readerRole=roleList.data.find((r:{role_key:string})=>r.role_key==='qa_view')
   assert.equal((await send('POST',`/workspaces/${workspaceId}/members`,admin,{userId:extraId,roleId:readerRole.id})).status,201)
   const untouched=await send('GET',`/workspaces/${workspaceId}/projects`,guest)
   assert.equal(untouched.status,200);assert.equal(untouched.data.length,0)
   assert.equal((await send('GET',`/projects/${projectId}/document`,guest)).status,404)
   const p2=await send('POST',`/workspaces/${workspaceId}/projects`,admin,{name:'Proyecto dos',document:emptyDoc()})
   const p3=await send('POST',`/workspaces/${workspaceId}/projects`,admin,{name:'Proyecto tres',document:emptyDoc()})
   assert.equal(p2.status,201);assert.equal(p3.status,201)
   assert.equal((await send('PUT',`/projects/${p2.data.id}/members/${memberId}`,admin,{roleId:readerRole.id})).status,200)
   assert.equal((await send('PUT',`/projects/${p3.data.id}/members/${extraId}`,admin,{roleId:readerRole.id})).status,200)
   const memberProjects=await send('GET',`/workspaces/${workspaceId}/projects`,member)
   assert.deepEqual(memberProjects.data.map((p:{id:string})=>p.id).sort(),[projectId,p2.data.id].sort())
   const guestProjects=await send('GET',`/workspaces/${workspaceId}/projects`,guest)
   assert.deepEqual(guestProjects.data.map((p:{id:string})=>p.id),[p3.data.id])
   assert.equal((await send('GET',`/projects/${p2.data.id}/document`,guest)).status,404)
   assert.equal((await send('GET',`/projects/${p3.data.id}/document`,member)).status,404)
   assert.equal((await send('GET',`/projects/${p3.data.id}/members`,guest)).status,403)
   assert.equal((await send('DELETE',`/projects/${p2.data.id}`,guest)).status,404)
   assert.equal((await send('DELETE',`/projects/${p2.data.id}`,member)).status,403)
   assert.equal((await send('DELETE',`/projects/${p2.data.id}`,admin)).status,200)
   assert.equal((await send('GET',`/projects/${p2.data.id}/document`,admin)).status,404)
   assert.equal((await send('GET',`/projects/${p3.data.id}/document`,guest)).status,200)
   // Revoke only this project; the account and workspace membership must remain intact.
   assert.equal((await send('DELETE',`/projects/${p3.data.id}/members/${extraId}`,admin)).status,200)
   assert.equal((await send('GET',`/projects/${p3.data.id}/document`,guest)).status,404)
   assert.equal((await send('GET',`/workspaces/${workspaceId}/projects`,guest)).status,200)
   assert.equal((await send('PUT',`/projects/${p3.data.id}/members/${extraId}`,admin,{roleId:readerRole.id})).status,200)
   assert.equal((await send('GET',`/projects/${p3.data.id}/document`,guest)).status,200)
   assert.equal((await send('DELETE',`/projects/${p3.data.id}/members/${adminId}`,admin)).status,404)
   // No cascading project deletion when attempting to delete an occupied workspace.
   assert.equal((await send('DELETE',`/workspaces/${workspaceId}`,admin)).status,409)
   assert.equal((await send('PATCH',`/workspaces/${workspaceId}`,guest,{name:'Acceso ilegal'})).status,403)
   assert.equal((await send('PATCH',`/workspaces/${workspaceId}`,admin,{name:'Espacio QA actualizado'})).status,200)
   const empty=await send('POST','/workspaces',admin,{name:'Vacío de QA'})
   assert.equal(empty.status,201)
   // Frontends antiguos enviaban Content-Type JSON sin cuerpo: Fastify no debe rechazar antes de verificar CSRF y permisos.
   const legacy=await app.inject({method:'DELETE',url:`/api/v1/workspaces/${empty.data.id}`,headers:{cookie:admin!.cookie,'x-csrf-token':admin!.csrf,'content-type':'application/json'}})
   assert.equal(legacy.statusCode,200,legacy.body)
  })
  await t.test('Solo el propietario borra en cascada un espacio ocupado, mediante confirmación exacta',async()=>{
   const created=await send('POST','/workspaces',admin,{name:'Espacio temporal '+suffix})
   assert.equal(created.status,201)
   const ownId=created.data.id
   try{
    const project=await send('POST',`/workspaces/${ownId}/projects`,admin,{name:'Proyecto con contenido',document:emptyDoc()})
    assert.equal(project.status,201)
    assert.equal((await send('DELETE',`/workspaces/${ownId}`,admin)).status,409)
    assert.equal((await send('DELETE',`/workspaces/${ownId}`,admin,{deleteProjects:true,confirmName:'Incorrecto'})).status,409)
    assert.equal((await send('DELETE',`/workspaces/${ownId}`,member,{deleteProjects:true,confirmName:'Espacio temporal '+suffix})).status,403)
    const removed=await send('DELETE',`/workspaces/${ownId}`,admin,{deleteProjects:true,confirmName:'Espacio temporal '+suffix})
    assert.equal(removed.status,200,JSON.stringify(removed.data))
    assert.equal(removed.data.deletedProjects,1)
    assert.equal((await send('GET',`/projects/${project.data.id}/document`,admin)).status,404)
   }finally{await pool.query('DELETE FROM workspaces WHERE id=$1',[ownId])}
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
  await t.test('Historial: autor, versión anterior y proyección segura según rol',async()=>{
   const path=`/projects/${projectId}/versions`
   const list=await send('GET',path,admin)
   assert.equal(list.status,200)
   assert.equal(list.data[0].version,2)
   assert.equal(list.data[0].editor_name,'QA Admin')
   const previous=await send('GET',`${path}/1`,admin)
   assert.equal(previous.status,200)
   assert.equal(previous.data.version,1)
   assert.equal(previous.data.document.diagrams.length,0)
   const ownerCurrent=await send('GET',`${path}/2`,admin)
   assert.equal(ownerCurrent.status,200)
   assert.deepEqual(ownerCurrent.data.document.diagrams.map((d:{id:string})=>d.id),['c1','c2'])
   const memberCurrent=await send('GET',`${path}/2`,member)
   assert.equal(memberCurrent.status,200)
   assert.deepEqual(memberCurrent.data.document.diagrams.map((d:{id:string})=>d.id),['c1'])
   assert.equal(memberCurrent.data.document.elements.endpoint,undefined)
   assert.equal((await send('GET',`${path}/0`,admin)).status,400)
   assert.equal((await send('GET',`${path}/no-es-numero`,admin)).status,400)
   assert.equal((await send('GET',`${path}/200000`,admin)).status,404)
  })
  await t.test('Intento de leer otro proyecto sin membresía se rechaza',async()=>{
   const second=await send('POST','/workspaces',admin,{name:'Workspace aislado '+suffix})
   assert.equal(second.status,201)
   try{
    const p=await send('POST',`/workspaces/${second.data.id}/projects`,admin,{name:'Confidencial',document:emptyDoc()})
    assert.equal(p.status,201)
    assert.equal((await send('GET',`/projects/${p.data.id}/document`,member)).status,404)
    assert.equal((await send('PUT',`/projects/${p.data.id}/document`,member,{document:emptyDoc(),expectedVersion:1})).status,404)
    assert.equal((await send('GET',`/projects/${p.data.id}/versions/1`,member)).status,404)
   }finally{await pool.query('DELETE FROM workspaces WHERE id=$1',[second.data.id])}
  })
  // Reiniciar el contenedor Fastify SOLO del test tras el bloque de aislamiento.
  // Conservamos usuarios, sesiones, proyectos y DB QA; no alteramos seguridad
  // ni límites del backend. Evita HTTP 429 accidental en subpruebas posteriores.
  await resetQaRateLimitWindow()
  await t.test('API real: roles inválidos y duplicados no se almacenan',async()=>{
   const path=`/workspaces/${workspaceId}/roles`
   assert.equal((await send('POST',path,admin,{name:'Q',roleKey:'x',permissions:[]})).status,400)
   assert.equal((await send('POST',path,admin,{name:'Rol inválido',roleKey:'clave con espacios',permissions:[]})).status,400)
   assert.equal((await send('POST',path,admin,{name:'Permiso falso',roleKey:'qa_fake',permissions:['permission.invalid']})).status,400)
   assert.equal((await send('POST',path,admin,{name:'QA duplicado',roleKey:'qa_view',permissions:['project.read']})).status,409)
   assert.equal((await send('POST',path,admin,[])).status,400)
  })
  await t.test('API real: actualizar roles y bloquear ediciones ajenas',async()=>{
   const roles=await send('GET',`/workspaces/${workspaceId}/roles`,admin)
   assert.equal(roles.status,200)
   const role=roles.data.find((r:{role_key:string})=>r.role_key==='qa_view')
   assert.ok(role?.id)
   const endpoint=`/workspaces/${workspaceId}/roles/${role.id}`
   assert.equal((await send('PUT',endpoint,member,{permissions:['project.read']})).status,403)
   assert.equal((await send('PUT',endpoint,admin,{permissions:['invalid.permission']})).status,400)
   assert.equal((await send('PUT',`/workspaces/${workspaceId}/roles/${randomUUID()}`,admin,{permissions:[]})).status,404)
   assert.equal((await send('PUT',endpoint,admin,{permissions:['project.read','diagram.view.c1','element.view.activity']})).status,200)
   const reloaded=await send('GET',`/workspaces/${workspaceId}/roles`,admin)
   assert.ok(reloaded.data.find((r:{id:string})=>r.id===role.id).permissions.includes('diagram.view.c1'))
  })
  await t.test('API real: altas, bajas y autorización de miembros',async()=>{
   const endpoint=`/workspaces/${workspaceId}/members`
   const roles=await send('GET',`/workspaces/${workspaceId}/roles`,admin)
   const role=roles.data.find((r:{role_key:string})=>r.role_key==='qa_view')
   assert.ok(role?.id)
   assert.equal((await send('POST',endpoint,admin,{userId:randomUUID(),roleId:role.id})).status,404)
   assert.equal((await send('POST',endpoint,admin,{userId:memberId,roleId:randomUUID()})).status,403)
   assert.equal((await send('POST',endpoint,admin,{userId:'no-uuid',roleId:role.id})).status,400)
   const before=await send('GET',endpoint,admin)
   assert.equal(before.status,200)
   assert.ok(before.data.some((m:{id:string})=>m.id===memberId))
   assert.equal((await send('DELETE',`${endpoint}/${memberId}`,member)).status,403)
   assert.equal((await send('DELETE',`${endpoint}/${memberId}`,admin)).status,200)
   assert.equal((await send('DELETE',`${endpoint}/${memberId}`,admin)).status,404)
   assert.equal((await send('POST',endpoint,admin,{userId:memberId,roleId:role.id})).status,201)
   // Removing workspace membership also revokes every project membership (FK CASCADE).
   assert.equal((await send('GET',`/projects/${projectId}/document`,member)).status,404)
   assert.equal((await send('PUT',`/projects/${projectId}/members/${memberId}`,admin,{roleId:role.id})).status,200)
   assert.equal((await send('GET',`/workspaces/${workspaceId}/access`,member)).status,200)
  })
  await t.test('API real: validación de identificadores y formatos',async()=>{
   assert.equal((await send('GET','/workspaces/no-uuid/roles',admin)).status,400)
   assert.equal((await send('GET','/workspaces/no-uuid/access',admin)).status,400)
   assert.equal((await send('GET',`/projects/${randomUUID()}/document`,admin)).status,404)
   assert.equal((await send('GET',`/projects/${projectId}/versions`,member)).status,200)
   assert.equal((await send('PATCH',`/admin/users/no-uuid`,admin,{active:true})).status,400)
   assert.equal((await send('PATCH',`/admin/users/${memberId}`,admin,{})).status,400)
   assert.equal((await send('PATCH',`/admin/users/${randomUUID()}`,admin,{active:true})).status,404)
   assert.equal((await send('PATCH',`/admin/users/${adminId}`,admin,{password:pass})).status,409)
  })
  await t.test('API real: renovación de credenciales revoca contraseñas anteriores',async()=>{
   const replacement='NuevaClaveDePrueba!2026'
   assert.equal((await send('PATCH',`/admin/users/${memberId}`,member,{password:replacement})).status,403)
   assert.equal((await send('PATCH',`/admin/users/${memberId}`,admin,{password:replacement})).status,200)
   assert.equal((await signin(memberEmail,pass)).status,401)
   const login=await signin(memberEmail,replacement)
   assert.equal(login.status,200)
   member=login.user
  })
  await t.test('API real: errores internos no exponen detalles al cliente',async()=>{
   const response=await send('GET','/_qa_unhandled_error',admin)
   assert.equal(response.status,500)
   assert.equal(response.data.message,'Error interno del servidor')
   assert.equal(JSON.stringify(response.data).includes('Detalle interno secreto QA'),false)
   assert.equal(typeof response.data.requestId,'string')
  })
  await t.test('API real: el guardado bloquea documentos y versiones incorrectos antes de escribir',async()=>{
   const endpoint=`/projects/${projectId}/document`
   const invalid=await send('PUT',endpoint,admin,{document:{schema:0},expectedVersion:2})
   assert.equal(invalid.status,400)
   for(const version of [0,-1,'version inválida',1.5]){
    assert.equal((await send('PUT',endpoint,admin,{document:emptyDoc(),expectedVersion:version})).status,400)
   }
   assert.equal((await send('POST',`/projects/${projectId}/import`,admin,{document:{incorrect:true},expectedVersion:2})).status,400)
   assert.equal((await send('PUT',endpoint,member,{document:emptyDoc(),expectedVersion:2})).status,403)
  })
  await t.test('API real: credenciales excesivamente largas se rechazan sin crear sesión',async()=>{
   // La suite ya consumió intentos de login en la aplicación principal. Usar
   // otra instancia evita que el limitador (6/min) bloquee el escenario 401.
   // No se desactiva ni modifica la protección de producción.
   const isolated=await buildApp()
   const loginStatus=async(email:string,password:string)=>{
    const response=await isolated.inject({method:'POST',url:'/api/v1/auth/login',payload:{email,password}})
    return response.statusCode
   }
   try{
    assert.equal(await loginStatus('x'.repeat(255)+'@example.test',pass),401)
    assert.equal(await loginStatus(adminEmail,'x'.repeat(129)),401)
    // Regresión de seguridad: después de seis intentos, el séptimo da 429.
    for(let i=0;i<4;i++)assert.equal(await loginStatus('x'.repeat(255)+'@example.test',pass),401)
    assert.equal(await loginStatus('x'.repeat(255)+'@example.test',pass),429)
   }finally{await isolated.close()}
  })
  // An independent Fastify app keeps the existing 100/min global limiter intact,
  // without letting earlier integration requests consume these collaboration tests.
  const liveApp=await buildApp()
  const sendLive=async(method:'GET'|'POST'|'PUT'|'PATCH'|'DELETE',path:string,user?:User,payload?:object)=>{
   const r=await liveApp.inject({method,url:`/api/v1${path}`,headers:user?{cookie:user.cookie,'x-csrf-token':user.csrf}:{},...(payload===undefined?{}:{payload})})
   return {status:r.statusCode,data:r.json() as Record<string,any>}
  }
  try{
  await t.test('Colaboración: ediciones distintas de C1 y C2 se guardan sin perder cambios; colisiones dan 409',async()=>{
   const endpoint=`/projects/${projectId}/document`
   const start=await sendLive('GET',endpoint,admin)
   assert.equal(start.status,200)
   const initial=start.data.document as ProjectDocument
   const version=start.data.version as number
   assert.ok(initial.diagrams.length>=2)
   const rolesPath=`/workspaces/${workspaceId}/roles`,membersPath=`/workspaces/${workspaceId}/members`
   const editorRole=await sendLive('POST',rolesPath,admin,{roleKey:'qa_collaborator',name:'Colaborador de QA',permissions:[
    'project.read','diagram.view.c1','diagram.view.c2','element.view.activity','element.view.endpoint',
    'diagram.edit.c1','diagram.edit.c2']})
   assert.equal(editorRole.status,201)
   assert.equal((await sendLive('POST',membersPath,admin,{userId:memberId,roleId:editorRole.data.id})).status,201)
   assert.equal((await sendLive('PUT',`/projects/${projectId}/members/${memberId}`,admin,{roleId:editorRole.data.id})).status,200)
   const memberBase=await sendLive('GET',endpoint,member)
   assert.equal(memberBase.status,200)
   assert.equal(memberBase.data.version,version)
   const first=structuredClone(initial),second=structuredClone(memberBase.data.document) as ProjectDocument
   first.diagrams[0].description='Actualización de usuario A '+suffix
   second.diagrams[1].description='Actualización independiente de usuario B '+suffix
   const savedA=await sendLive('PUT',endpoint,admin,{document:first,expectedVersion:version,collaborative:true})
   assert.equal(savedA.status,200,JSON.stringify(savedA.data))
   const savedB=await sendLive('PUT',endpoint,member,{document:second,expectedVersion:version,collaborative:true})
   assert.equal(savedB.status,200,JSON.stringify(savedB.data))
   const persisted=await sendLive('GET',endpoint,admin)
   assert.equal(persisted.data.version,version+2)
   assert.equal(persisted.data.document.diagrams[0].description,first.diagrams[0].description)
   assert.equal(persisted.data.document.diagrams[1].description,second.diagrams[1].description)
   const overlapA=structuredClone(persisted.data.document) as ProjectDocument
   const overlapB=structuredClone(persisted.data.document) as ProjectDocument
   overlapA.diagrams[0].name='Nombre del usuario A'
   overlapB.diagrams[0].name='Nombre del usuario B'
   const commit=await sendLive('PUT',endpoint,admin,{document:overlapA,expectedVersion:persisted.data.version,collaborative:true})
   assert.equal(commit.status,200)
   const denied=await sendLive('PUT',endpoint,admin,{document:overlapB,expectedVersion:persisted.data.version,collaborative:true})
   assert.equal(denied.status,409)
   const final=await sendLive('GET',endpoint,admin)
   assert.equal(final.data.document.diagrams[0].name,overlapA.diagrams[0].name)
   const versionRows=await sendLive('GET',`/projects/${projectId}/versions`,admin)
   assert.equal(versionRows.status,200)
   assert.ok(versionRows.data.some((v:{updated_by:string})=>v.updated_by===memberId))
   const roles=await sendLive('GET',rolesPath,admin)
   const viewer=roles.data.find((role:{role_key:string})=>role.role_key==='qa_view')
   assert.ok(viewer?.id)
   assert.equal((await sendLive('POST',membersPath,admin,{userId:memberId,roleId:viewer.id})).status,201)
   assert.equal((await sendLive('PUT',`/projects/${projectId}/members/${memberId}`,admin,{roleId:viewer.id})).status,200)
   const limited=await sendLive('GET',endpoint,member)
   const attempted=structuredClone(limited.data.document) as ProjectDocument
   attempted.diagrams[0].name='Edición no permitida'
   const forbidden=await sendLive('PUT',endpoint,member,{document:attempted,expectedVersion:final.data.version,collaborative:true})
   assert.equal(forbidden.status,403)
  })
  await t.test('Colaboración: el canal y la presencia requieren sesión y visibilidad del modelo',async()=>{
   const id='12345678-1234-4234-8234-123456789012'
   assert.equal((await sendLive('GET',`/projects/${projectId}/events?clientId=${id}`)).status,401)
   assert.equal((await sendLive('POST',`/projects/${projectId}/presence`,undefined,{clientId:id,diagramId:'c1',elementId:null})).status,401)
   assert.equal((await sendLive('POST',`/projects/${projectId}/presence`,member,{clientId:id,diagramId:'c2',elementId:null})).status,403)
   assert.equal((await sendLive('POST',`/projects/${projectId}/presence`,member,{clientId:id,diagramId:'c1',elementId:'endpoint'})).status,403)
   assert.equal((await sendLive('POST',`/projects/${projectId}/presence`,admin,{clientId:id,diagramId:'c1',elementId:null})).status,200)
  })
  }finally{await liveApp.close()}
  // La suite de historial/ramas vuelve a empezar con la ventana de rate-limit
  // limpia; sus respuestas 400/403/409/200 se validan sin 429 de otras pruebas.
  await resetQaRateLimitWindow()
  await t.test('V1 funcional: renombrar proyecto y consultar auditoría requieren permisos del workspace',async()=>{
   const url=`/projects/${projectId}`
   assert.equal((await send('PATCH',url,member,{name:'Intruso'})).status,403)
   assert.equal((await send('PATCH',url,admin,{name:'A'})).status,400)
   const renamed=await send('PATCH',url,admin,{name:'Proyecto cerrado '+suffix})
   assert.equal(renamed.status,200,JSON.stringify(renamed.data))
   assert.equal(renamed.data.name,'Proyecto cerrado '+suffix)
   const projectList=await send('GET',`/workspaces/${workspaceId}/projects`,admin)
   assert.equal(projectList.status,200)
   assert.ok(projectList.data.some((x:{id:string;name:string})=>x.id===projectId&&x.name===renamed.data.name))
   const endpoint=`/workspaces/${workspaceId}/audit`
   assert.equal((await send('GET',endpoint,member)).status,403)
   assert.equal((await send('GET',endpoint+'?beforeId=bad',admin)).status,400)
   const audit=await send('GET',endpoint+'?limit=2',admin)
   assert.equal(audit.status,200)
   assert.equal(audit.data.items.length,2)
   assert.ok(audit.data.nextCursor)
   const older=await send('GET',endpoint+'?limit=2&beforeId='+audit.data.nextCursor,admin)
   assert.equal(older.status,200)
   assert.ok(older.data.items.every((x:{id:string})=>BigInt(x.id)<BigInt(audit.data.nextCursor)))
   assert.ok(audit.data.items.some((x:{event_type:string})=>x.event_type==='project.renamed'))
  })
  await t.test('V1 funcional: restaurar historial crea versión nueva y evita sobrescrituras por carrera',async()=>{
   const url=`/projects/${projectId}/document`
   const before=await send('GET',url,admin)
   assert.equal(before.status,200)
   const version=before.data.version as number
   const restorePath=`/projects/${projectId}/restore`
   assert.equal((await send('POST',restorePath,member,{sourceVersion:1,expectedVersion:version})).status,403)
   assert.equal((await send('POST',restorePath,admin,{sourceVersion:0,expectedVersion:version})).status,400)
   assert.equal((await send('POST',restorePath,admin,{sourceVersion:1,expectedVersion:version-1})).status,409)
   const unchanged=await send('GET',url,admin)
   assert.equal(unchanged.data.version,version)
   const result=await send('POST',restorePath,admin,{sourceVersion:1,expectedVersion:version})
   assert.equal(result.status,200,JSON.stringify(result.data))
   assert.equal(result.data.version,version+1)
   const restored=await send('GET',url,admin)
   assert.equal(restored.data.version,version+1)
   assert.equal(restored.data.document.diagrams.length,0)
   const old=await send('GET',`/projects/${projectId}/versions/${version}`,admin)
   assert.equal(old.status,200)
   assert.ok(old.data.document.diagrams.length>0)
   const audit=await send('GET',`/workspaces/${workspaceId}/audit`,admin)
   assert.equal(audit.status,200)
   assert.ok(audit.data.items.some((x:{event_type:string;detail:{sourceVersion?:number}})=>x.event_type==='project.document_restore'&&x.detail.sourceVersion===1))
  })
  await t.test('ramas: acceso owner, propuesta sin mutación, fusión y protección ante cambios concurrentes',async()=>{
   const branchUrl=`/projects/${projectId}/restore-branches`,docUrl=`/projects/${projectId}/document`
   const before=await send('GET',docUrl,admin)
   assert.equal(before.status,200)
   const initialVersion=before.data.version as number
   assert.equal((await send('POST',branchUrl,member,{sourceVersion:1})).status,403)
   const proposal=await send('POST',branchUrl,admin,{sourceVersion:1})
   assert.equal(proposal.status,200,JSON.stringify(proposal.data))
   const branchId=String(proposal.data.id)
   assert.equal((await send('GET',branchUrl,admin)).status,200)
   assert.equal((await send('GET',`${branchUrl}/${branchId}/preview`,member)).status,403)
   const plan=await send('GET',`${branchUrl}/${branchId}/preview`,admin)
   assert.equal(plan.status,200,JSON.stringify(plan.data))
   assert.equal(plan.data.currentVersion,initialVersion)
   const unchanged=await send('GET',docUrl,admin)
   assert.equal(unchanged.data.version,initialVersion,'Crear una rama no modifica el documento principal')
   assert.equal((await send('POST',`${branchUrl}/${branchId}/apply`,admin,{expectedVersion:initialVersion-1,mode:'merge',resolutions:{}})).status,409)
   const result=await send('POST',`${branchUrl}/${branchId}/apply`,admin,{expectedVersion:initialVersion,mode:'merge',resolutions:{}})
   assert.equal(result.status,200,JSON.stringify(result.data))
   assert.equal(result.data.version,initialVersion+1)
   assert.equal((await send('POST',`${branchUrl}/${branchId}/apply`,admin,{expectedVersion:initialVersion+1,mode:'merge',resolutions:{}})).status,409)
  })
  await t.test('restauración del propietario conserva también elementos históricos huérfanos',async()=>{
   const url=`/projects/${projectId}/document`
   const before=await send('GET',url,admin)
   assert.equal(before.status,200)
   const doc:ProjectDocument=before.data.document
   const orphan=createElement('Elemento sin vista','component')
   doc.elements[orphan.id]=orphan
   const added=await send('PUT',url,admin,{document:doc,expectedVersion:before.data.version})
   assert.equal(added.status,200,JSON.stringify(added.data))
   const snapshotVersion=added.data.version as number
   const after=await send('GET',url,admin)
   assert.equal(after.status,200)
   const another=await send('PUT',url,admin,{document:after.data.document,expectedVersion:snapshotVersion})
   assert.equal(another.status,200,JSON.stringify(another.data))
   const restored=await send('POST',`/projects/${projectId}/restore`,admin,{sourceVersion:snapshotVersion,expectedVersion:another.data.version})
   assert.equal(restored.status,200,JSON.stringify(restored.data))
   const full=await pool.query<{document:ProjectDocument}>('SELECT document FROM project_documents WHERE project_id=$1',[projectId])
   assert.ok(full.rows[0].document.elements[orphan.id],'La restauración completa no descarta elementos fuera de vistas')
  })
  await t.test('Logout invalida la sesión',async()=>{
   assert.equal((await send('POST','/auth/logout',member)).status,200)
   assert.equal((await send('GET','/auth/me',member)).status,401)
  })
 }finally{
  if(workspaceId)await pool.query('DELETE FROM workspaces WHERE id=$1',[workspaceId])
  if(memberId)await pool.query('DELETE FROM atlas_users WHERE id=$1',[memberId])
  if(extraId)await pool.query('DELETE FROM atlas_users WHERE id=$1',[extraId])
  if(adminId)await pool.query('DELETE FROM atlas_users WHERE id=$1',[adminId])
  await app.close();await pool.end()
 }
})
