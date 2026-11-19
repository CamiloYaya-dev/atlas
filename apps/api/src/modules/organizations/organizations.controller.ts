import type {FastifyInstance} from 'fastify'
import type {PoolClient} from 'pg'
import {pool} from '../../db/pool'
import {identity} from '../../security/identity'
import {hashPassword} from '../../security/password'
import {DomainError,assertUUID} from '../../domain/errors'
import {initializeWorkspaceRoles} from '../../security/roles'
import {projectEvents} from '../projects/realtime/project-events'

const input=(value:unknown):Record<string,unknown>=>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new DomainError('Objeto JSON requerido',400)
 return value as Record<string,unknown>
}
const emailOf=(value:unknown)=>{
 const valueText=String(value??'').trim().toLowerCase()
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valueText)||valueText.length>254)throw new DomainError('Correo inválido',400)
 return valueText
}
const nameOf=(value:unknown)=>{
 const name=String(value??'').trim()
 if(name.length<2||name.length>120)throw new DomainError('Nombre inválido',400)
 return name
}
const searchOf=(value:unknown)=>{
 const q=String(value??'').trim()
 if(q.length>100)throw new DomainError('Búsqueda demasiado larga',400)
 return q
}
type OrganizationRole='owner'|'admin'|'member'
export async function organizationAccess(organizationId:string,userId:string,db:PoolClient|typeof pool=pool):Promise<OrganizationRole>{
 const {rows}=await db.query<{role:OrganizationRole}>(`SELECT m.role FROM organization_members m
  JOIN novzi_users u ON u.id=m.user_id AND u.active=true
  WHERE m.organization_id=$1 AND m.user_id=$2`,[organizationId,userId])
 if(!rows[0])throw new DomainError('Organización no disponible',404)
 return rows[0].role
}
const canManage=(role:OrganizationRole)=>role==='owner'||role==='admin'
const onlyManager=(role:OrganizationRole)=>{if(!canManage(role))throw new DomainError('Se requiere administrar la organización',403)}
const onlyOwner=(role:OrganizationRole)=>{if(role!=='owner')throw new DomainError('Acción reservada al propietario de la organización',403)}

export async function registerOrganizationsController(app:FastifyInstance){
 app.get('/api/v1/organizations',async req=>{
  const user=await identity(req)
  const {rows}=await pool.query(`SELECT o.id,o.name,o.created_by,m.role,
   (SELECT count(*)::int FROM workspaces w WHERE w.organization_id=o.id) AS workspace_count
   FROM organizations o JOIN organization_members m ON m.organization_id=o.id
   WHERE m.user_id=$1 ORDER BY o.created_at,o.name`,[user.id])
  return rows
 })
 app.post('/api/v1/organizations',async(req,reply)=>{
  const actor=await identity(req),name=nameOf(input(req.body).name)
  const c=await pool.connect()
  try{await c.query('BEGIN')
   const result=await c.query<{id:string}>(`INSERT INTO organizations(name,created_by) VALUES($1,$2) RETURNING id`,[name,actor.id])
   await c.query(`INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'owner')`,[result.rows[0].id,actor.id])
   await c.query('COMMIT');return reply.code(201).send({id:result.rows[0].id,name,role:'owner'})
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
 })
 app.get<{Params:{organizationId:string}}>('/api/v1/organizations/:organizationId/members',async req=>{
  assertUUID(req.params.organizationId);const actor=await identity(req)
  await organizationAccess(req.params.organizationId,actor.id)
  const query=searchOf((req.query as {q?:string})?.q)
  const {rows}=await pool.query(`SELECT u.id,u.display_name AS name,u.email,m.role
   FROM organization_members m JOIN novzi_users u ON u.id=m.user_id
   WHERE m.organization_id=$1 AND u.active=true
   AND ($2='' OR u.email ILIKE '%'||$2||'%' OR u.display_name ILIKE '%'||$2||'%')
   ORDER BY u.display_name,u.email LIMIT 50`,[req.params.organizationId,query])
  return rows
 })
 app.get<{Params:{organizationId:string}}>('/api/v1/organizations/:organizationId/workspaces',async req=>{
  assertUUID(req.params.organizationId);const actor=await identity(req)
  await organizationAccess(req.params.organizationId,actor.id)
  const {rows}=await pool.query(`SELECT w.id,w.name,w.created_by,w.organization_id,r.role_key AS role
   FROM workspaces w LEFT JOIN workspace_members wm ON wm.workspace_id=w.id AND wm.user_id=$2
   LEFT JOIN workspace_roles r ON r.id=wm.role_id
   WHERE w.organization_id=$1 AND wm.user_id IS NOT NULL ORDER BY w.created_at`,[req.params.organizationId,actor.id])
  return rows
 })
 app.post<{Params:{organizationId:string}}>('/api/v1/organizations/:organizationId/workspaces',async(req,reply)=>{
  assertUUID(req.params.organizationId);const actor=await identity(req),name=nameOf(input(req.body).name)
  const c=await pool.connect()
  try{await c.query('BEGIN')
   await organizationAccess(req.params.organizationId,actor.id,c)
   const {rows}=await c.query<{id:string}>(`INSERT INTO workspaces(name,created_by,organization_id) VALUES($1,$2,$3) RETURNING id`,[name,actor.id,req.params.organizationId])
   await initializeWorkspaceRoles(c,rows[0].id)
   const owner=await c.query<{id:string}>(`SELECT id FROM workspace_roles WHERE workspace_id=$1 AND role_key='owner'`,[rows[0].id])
   await c.query(`INSERT INTO workspace_members(workspace_id,user_id,role,role_id) VALUES($1,$2,'owner',$3)`,[rows[0].id,actor.id,owner.rows[0].id])
   // El propietario de la organización conserva el control de los espacios
   // creados por miembros o administradores, sin dar acceso a otros miembros.
   await c.query(`INSERT INTO workspace_members(workspace_id,user_id,role,role_id)
     SELECT $1,om.user_id,'owner',$2 FROM organization_members om
     WHERE om.organization_id=$3 AND om.role='owner' AND om.user_id<>$4
     ON CONFLICT DO NOTHING`,[rows[0].id,owner.rows[0].id,req.params.organizationId,actor.id])
   await c.query('COMMIT');return reply.code(201).send({id:rows[0].id})
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
 })
 app.post<{Params:{organizationId:string}}>('/api/v1/organizations/:organizationId/users',async(req,reply)=>{
  assertUUID(req.params.organizationId);const actor=await identity(req),b=input(req.body)
  onlyManager(await organizationAccess(req.params.organizationId,actor.id))
  const name=nameOf(b.name),email=emailOf(b.email),hash=await hashPassword(String(b.password??''))
  const role=b.role==='admin'?'admin':'member'
  const c=await pool.connect()
  try{await c.query('BEGIN')
   onlyManager(await organizationAccess(req.params.organizationId,actor.id,c))
   const {rows}=await c.query<{id:string}>(`INSERT INTO novzi_users(email,display_name,password_hash,created_by) VALUES($1,$2,$3,$4) RETURNING id`,[email,name,hash,actor.id])
   await c.query(`INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,$3)`,[req.params.organizationId,rows[0].id,role])
   await c.query('COMMIT');return reply.code(201).send({id:rows[0].id,name,email,role})
  }catch(e){await c.query('ROLLBACK');if((e as {code?:string}).code==='23505')throw new DomainError('La cuenta ya existe: utiliza Invitar por correo',409);throw e}finally{c.release()}
 })
 app.patch<{Params:{organizationId:string;userId:string}}>('/api/v1/organizations/:organizationId/members/:userId',async req=>{
  assertUUID(req.params.organizationId);assertUUID(req.params.userId)
  const actor=await identity(req),b=input(req.body)
  onlyManager(await organizationAccess(req.params.organizationId,actor.id))
  if(b.role!=='member'&&b.role!=='admin')throw new DomainError('Rol de organización inválido',400)
  const current=await pool.query<{role:string}>(`SELECT role FROM organization_members WHERE organization_id=$1 AND user_id=$2`,
   [req.params.organizationId,req.params.userId])
  if(!current.rows[0])throw new DomainError('Miembro no encontrado',404)
  if(current.rows[0].role==='owner')throw new DomainError('El propietario está protegido',403)
  if(current.rows[0].role==='admin'&&
     (await organizationAccess(req.params.organizationId,actor.id))!=='owner'&&
     req.params.userId!==actor.id)
   throw new DomainError('Solo el propietario puede cambiar el rol de otro administrador',403)
  const {rowCount}=await pool.query(`UPDATE organization_members SET role=$3
   WHERE organization_id=$1 AND user_id=$2 AND role<>'owner'`,[req.params.organizationId,req.params.userId,b.role])
  if(!rowCount)throw new DomainError('Miembro no encontrado o propietario protegido',404)
  return {ok:true}
 })
 app.delete<{Params:{organizationId:string;userId:string}}>('/api/v1/organizations/:organizationId/members/:userId',async req=>{
  assertUUID(req.params.organizationId);assertUUID(req.params.userId)
  const actor=await identity(req),c=await pool.connect()
  if(req.params.userId===actor.id)throw new DomainError('No puedes retirarte a ti mismo desde este panel',409)
  try{await c.query('BEGIN')
   const who=await organizationAccess(req.params.organizationId,actor.id,c);onlyManager(who)
   const target=await c.query<{role:string}>(`SELECT role FROM organization_members WHERE organization_id=$1 AND user_id=$2 FOR UPDATE`,[req.params.organizationId,req.params.userId])
   if(!target.rows[0])throw new DomainError('Miembro no encontrado',404)
   if(target.rows[0].role==='owner'||(who!=='owner'&&target.rows[0].role==='admin'))throw new DomainError('No puedes retirar a otro administrador o propietario',403)
   const {rows:affected}=await c.query<{project_id:string}>(`SELECT pm.project_id FROM project_members pm JOIN workspaces w ON w.id=pm.workspace_id
    WHERE w.organization_id=$1 AND pm.user_id=$2`,[req.params.organizationId,req.params.userId])
   await c.query(`DELETE FROM workspace_members wm USING workspaces w
    WHERE wm.workspace_id=w.id AND w.organization_id=$1 AND wm.user_id=$2`,[req.params.organizationId,req.params.userId])
   await c.query(`DELETE FROM organization_members WHERE organization_id=$1 AND user_id=$2`,[req.params.organizationId,req.params.userId])
   await c.query('COMMIT')
   for(const item of affected)projectEvents.revokeUser(item.project_id,req.params.userId)
   return {ok:true}
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
 })
 app.post<{Params:{organizationId:string}}>('/api/v1/organizations/:organizationId/invitations',async(req,reply)=>{
  assertUUID(req.params.organizationId);const actor=await identity(req),b=input(req.body)
  onlyManager(await organizationAccess(req.params.organizationId,actor.id))
  const email=emailOf(b.email),role=b.role==='admin'?'admin':'member'
  if(role==='admin')onlyManager(await organizationAccess(req.params.organizationId,actor.id))
  const c=await pool.connect()
  try{await c.query('BEGIN')
   const me=await organizationAccess(req.params.organizationId,actor.id,c);onlyManager(me)
   if(role==='admin')onlyOwner(me)
   const existing=await c.query(`SELECT m.user_id FROM organization_members m JOIN novzi_users u ON u.id=m.user_id
    WHERE m.organization_id=$1 AND u.email=$2`,[req.params.organizationId,email])
   if(existing.rows[0])throw new DomainError('El usuario ya pertenece a esta organización',409)
   await c.query(`DELETE FROM organization_invitations WHERE organization_id=$1 AND email=$2 AND accepted_at IS NULL AND declined_at IS NULL AND expires_at<=now()`,[req.params.organizationId,email])
   const {rows}=await c.query<{id:string}>(`INSERT INTO organization_invitations(organization_id,email,role,invited_by)
    VALUES($1,$2,$3,$4) RETURNING id`,[req.params.organizationId,email,role,actor.id])
   await c.query('COMMIT');return reply.code(201).send({id:rows[0].id,email,role,status:'pending'})
  }catch(e){await c.query('ROLLBACK');if((e as {code?:string}).code==='23505')throw new DomainError('Ya existe una invitación pendiente para ese correo',409);throw e}finally{c.release()}
 })
 app.get('/api/v1/organizations/invitations/mine',async req=>{
  const actor=await identity(req)
  const {rows}=await pool.query(`SELECT i.id,i.organization_id,o.name AS organization_name,i.email,i.role,i.created_at,i.expires_at
   FROM organization_invitations i JOIN organizations o ON o.id=i.organization_id
   WHERE i.email=$1 AND i.accepted_at IS NULL AND i.declined_at IS NULL AND i.expires_at>now()
   ORDER BY i.created_at DESC`,[actor.email])
  return rows
 })
 app.post<{Params:{invitationId:string}}>('/api/v1/organizations/invitations/:invitationId/accept',async req=>{
  assertUUID(req.params.invitationId);const actor=await identity(req),c=await pool.connect()
  try{await c.query('BEGIN')
   const {rows}=await c.query<{organization_id:string;role:'admin'|'member'}>(`SELECT organization_id,role FROM organization_invitations
    WHERE id=$1 AND email=$2 AND accepted_at IS NULL AND declined_at IS NULL AND expires_at>now() FOR UPDATE`,[req.params.invitationId,actor.email])
   if(!rows[0])throw new DomainError('Invitación inexistente o caducada',404)
   await c.query(`INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,$3)
    ON CONFLICT (organization_id,user_id) DO NOTHING`,[rows[0].organization_id,actor.id,rows[0].role])
   await c.query(`UPDATE organization_invitations SET accepted_at=now() WHERE id=$1`,[req.params.invitationId])
   await c.query('COMMIT');return {ok:true,organizationId:rows[0].organization_id}
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
 })
 app.post<{Params:{invitationId:string}}>('/api/v1/organizations/invitations/:invitationId/decline',async req=>{
  assertUUID(req.params.invitationId);const actor=await identity(req)
  const {rowCount}=await pool.query(`UPDATE organization_invitations SET declined_at=now()
   WHERE id=$1 AND email=$2 AND accepted_at IS NULL AND declined_at IS NULL AND expires_at>now()`,[req.params.invitationId,actor.email])
  if(!rowCount)throw new DomainError('Invitación inexistente o caducada',404)
  return {ok:true}
 })
}
