import type {FastifyInstance} from 'fastify'
import {pool} from '../../../db/pool'
import {identity} from '../../../security/identity'
import {access,allowed,requirePermission,requireValidPermissions} from '../../../security/roles'
import {DomainError,assertUUID} from '../../../domain/errors'
import {projectEvents} from '../../projects/realtime/project-events'
function obj(x:unknown):Record<string,unknown>{if(!x||typeof x!=='object'||Array.isArray(x))throw new DomainError('Objeto JSON requerido',400);return x as Record<string,unknown>}
function validateIds(ids:string[]){ids.forEach(assertUUID)}
export async function registerAccessController(app:FastifyInstance){
 app.get<{Params:{workspaceId:string}}>('/api/v1/workspaces/:workspaceId/access',async req=>{
  assertUUID(req.params.workspaceId)
  const a=await identity(req),ac=await access(req.params.workspaceId,a.id)
  return {roleId:ac.roleId,roleKey:ac.roleKey,roleName:ac.roleName,permissions:[...ac.permissions]}
 })
 app.get<{Params:{workspaceId:string};Querystring:{limit?:string;beforeId?:string}}>('/api/v1/workspaces/:workspaceId/audit',async req=>{
  assertUUID(req.params.workspaceId)
  const actor=await identity(req),ac=await access(req.params.workspaceId,actor.id)
  requirePermission(ac,'workspace.audit.view')
  const limit=Number(req.query.limit??30)
  if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new DomainError('Límite de auditoría inválido (1-100)',400)
  const before=req.query.beforeId
  if(before!==undefined&&(!/^[1-9]\d*$/.test(before)||!Number.isSafeInteger(Number(before))))throw new DomainError('Cursor de auditoría inválido',400)
  const params:unknown[]=[req.params.workspaceId,limit+1]
  const filter=before===undefined?'':'AND a.id < $3::bigint'
  if(before!==undefined)params.push(before)
  params.push(actor.id)
  const viewerIndex=params.length
  const {rows}=await pool.query<{id:string;event_type:string;actor_name:string|null;actor_email:string|null;resource_id:string|null;resource_name:string|null;detail:Record<string,unknown>;created_at:string}>(`
   SELECT a.id::text,a.event_type,u.display_name AS actor_name,u.email AS actor_email,a.resource_id,p.name AS resource_name,a.detail,a.created_at
   FROM audit_events a LEFT JOIN atlas_users u ON u.id=a.actor_id
   LEFT JOIN projects p ON p.id=a.resource_id AND p.workspace_id=a.workspace_id
   WHERE a.workspace_id=$1 ${filter}
   AND (${ac.roleKey==='owner'?`$${viewerIndex}::uuid IS NOT NULL`:`a.event_type NOT LIKE 'project.%' OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id=a.resource_id AND pm.user_id=$${viewerIndex})`})
   ORDER BY a.id DESC LIMIT $2`,params)
  const page=rows.slice(0,limit).map(row=>({
   id:row.id,event_type:row.event_type,actor_name:row.actor_name||'Usuario eliminado',
   actor_email:row.actor_email||null,resource_id:row.resource_id,resource_name:row.resource_name||null,created_at:row.created_at,
   // Explicit allowlist: audit metadata may contain internal/security fields.
   detail:Object.fromEntries(Object.entries(row.detail||{}).filter(([key])=>
    ['version','sourceVersion','roleId','roleKey','userId','collaborative','name'].includes(key)))
  }))
  return {items:page,nextCursor:rows.length>limit?page[page.length-1]?.id??null:null}
 })
 app.get<{Params:{workspaceId:string}}>('/api/v1/workspaces/:workspaceId/roles',async req=>{
  assertUUID(req.params.workspaceId)
  const a=await access(req.params.workspaceId,(await identity(req)).id)
  if(! (a.roleKey==='owner'||allowed(a,'workspace.roles.manage')||allowed(a,'workspace.members.manage')))requirePermission(a,'workspace.roles.manage')
  const {rows}=await pool.query<{id:string;role_key:string;name:string;system_role:boolean;permissions:string[]}>(`
   SELECT r.id,r.role_key,r.name,r.system_role,COALESCE(array_agg(p.permission) FILTER (WHERE p.permission IS NOT NULL),'{}') AS permissions
   FROM workspace_roles r LEFT JOIN role_permissions p ON p.role_id=r.id WHERE r.workspace_id=$1
   GROUP BY r.id ORDER BY CASE WHEN r.role_key='owner' THEN 0 WHEN r.role_key='admin' THEN 1 ELSE 2 END,r.name`,[req.params.workspaceId])
  return rows
 })
 app.post<{Params:{workspaceId:string}}>('/api/v1/workspaces/:workspaceId/roles',async(req,reply)=>{
  assertUUID(req.params.workspaceId)
  const who=await access(req.params.workspaceId,(await identity(req)).id)
  requirePermission(who,'workspace.roles.manage')
  const b=obj(req.body),name=String(b.name||'').trim(),roleKey=String(b.roleKey||'').trim().toLowerCase()
  if(name.length<2||name.length>100||!/^[a-z][a-z0-9_-]{1,39}$/.test(roleKey))throw new DomainError('Nombre o identificador del rol inválido',400)
  const perms=requireValidPermissions(b.permissions||[])
  if(perms.includes('workspace.delete')&&who.roleKey!=='owner')throw new DomainError('Solo el propietario puede conceder la eliminación de espacios',403)
  const c=await pool.connect()
  try{
   await c.query('BEGIN')
   const {rows}=await c.query<{id:string}>(`INSERT INTO workspace_roles(workspace_id,role_key,name)
     VALUES($1,$2,$3) RETURNING id`,[req.params.workspaceId,roleKey,name])
   await c.query('INSERT INTO role_permissions(role_id,permission) SELECT $1,unnest($2::text[])',[rows[0].id,perms])
   await c.query('COMMIT')
   return reply.code(201).send({id:rows[0].id,role_key:roleKey,name,permissions:perms})
  }catch(e){await c.query('ROLLBACK');if((e as {code?:string}).code==='23505')throw new DomainError('Ya existe un rol con ese identificador',409);throw e}finally{c.release()}
 })
 app.put<{Params:{workspaceId:string;roleId:string}}>('/api/v1/workspaces/:workspaceId/roles/:roleId',async req=>{
  validateIds([req.params.workspaceId,req.params.roleId])
  const actor=await identity(req)
  const who=await access(req.params.workspaceId,actor.id)
  requirePermission(who,'workspace.roles.manage')
  const b=obj(req.body),permissions=requireValidPermissions(b.permissions)
  if(permissions.includes('workspace.delete')&&who.roleKey!=='owner')throw new DomainError('Solo el propietario puede conceder la eliminación de espacios',403)
  const c=await pool.connect()
  try{
   await c.query('BEGIN')
   const r=await c.query<{role_key:string}>('SELECT role_key FROM workspace_roles WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[req.params.workspaceId,req.params.roleId])
   if(!r.rows[0])throw new DomainError('Rol no encontrado',404)
   if(r.rows[0].role_key==='owner')throw new DomainError('La política de propietario es inmutable',403)
   await c.query('DELETE FROM role_permissions WHERE role_id=$1',[req.params.roleId])
   await c.query('INSERT INTO role_permissions(role_id,permission) SELECT $1,unnest($2::text[])',[req.params.roleId,permissions])
   await c.query(`INSERT INTO audit_events(workspace_id,actor_id,event_type,detail)
    VALUES($1,$2,'workspace.role_policy_changed',$3::jsonb)`,[req.params.workspaceId,actor.id,JSON.stringify({roleId:req.params.roleId,permissions})])
   await c.query('COMMIT');return {ok:true}
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
 })
 app.get<{Params:{workspaceId:string}}>('/api/v1/workspaces/:workspaceId/members',async req=>{
  assertUUID(req.params.workspaceId)
  const who=await access(req.params.workspaceId,(await identity(req)).id)
  requirePermission(who,'workspace.members.manage')
  const {rows}=await pool.query(`SELECT u.id,u.email,u.display_name AS name,u.active,r.id AS role_id,r.role_key,r.name AS role_name
    FROM workspace_members m JOIN atlas_users u ON u.id=m.user_id
    JOIN workspace_roles r ON r.id=m.role_id WHERE m.workspace_id=$1 ORDER BY u.email`,[req.params.workspaceId])
  return rows
 })
 app.post<{Params:{workspaceId:string}}>('/api/v1/workspaces/:workspaceId/members',async(req,reply)=>{
  assertUUID(req.params.workspaceId)
  const actor=await identity(req),who=await access(req.params.workspaceId,actor.id)
  requirePermission(who,'workspace.members.manage')
  const b=obj(req.body),userId=String(b.userId||''),roleId=String(b.roleId||'');validateIds([userId,roleId])
  const c=await pool.connect()
  try{
   await c.query('BEGIN')
   const target=await c.query('SELECT id FROM atlas_users WHERE id=$1 AND active=true',[userId])
   if(!target.rows[0])throw new DomainError('Usuario no existe o está inactivo',404)
   const role=await c.query<{role_key:string}>('SELECT role_key FROM workspace_roles WHERE workspace_id=$1 AND id=$2',[req.params.workspaceId,roleId])
   if(!role.rows[0]||role.rows[0].role_key==='owner')throw new DomainError('No puedes asignar el rol propietario',403)
   await c.query(`INSERT INTO workspace_members(workspace_id,user_id,role,role_id) VALUES($1,$2,'editor',$3)
    ON CONFLICT(workspace_id,user_id) DO UPDATE SET role_id=EXCLUDED.role_id, role='editor' WHERE workspace_members.role <> 'owner'`,[req.params.workspaceId,userId,roleId])
   await c.query(`INSERT INTO audit_events(workspace_id,actor_id,event_type,detail)
    VALUES($1,$2,'workspace.membership_changed',$3::jsonb)`,[req.params.workspaceId,actor.id,JSON.stringify({userId,roleId})])
   await c.query('COMMIT')
   return reply.code(201).send({ok:true})
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
 })
 app.delete<{Params:{workspaceId:string;userId:string}}>('/api/v1/workspaces/:workspaceId/members/:userId',async req=>{
  validateIds([req.params.workspaceId,req.params.userId])
  const actor=await identity(req),who=await access(req.params.workspaceId,actor.id)
  requirePermission(who,'workspace.members.manage')
  const affected=await pool.query<{project_id:string}>('SELECT project_id FROM project_members WHERE workspace_id=$1 AND user_id=$2',[req.params.workspaceId,req.params.userId])
  const {rowCount}=await pool.query(`DELETE FROM workspace_members WHERE workspace_id=$1 AND user_id=$2 AND role <> 'owner'`,[req.params.workspaceId,req.params.userId])
  if(!rowCount)throw new DomainError('Miembro no encontrado o propietario protegido',404)
  for(const x of affected.rows)projectEvents.revokeUser(x.project_id,req.params.userId)
  await pool.query(`INSERT INTO audit_events(workspace_id,actor_id,event_type,detail) VALUES($1,$2,'workspace.membership_removed',$3::jsonb)`,[req.params.workspaceId,actor.id,JSON.stringify({userId:req.params.userId})])
  return {ok:true}
 })
}
