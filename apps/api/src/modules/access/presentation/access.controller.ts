import type {FastifyInstance} from 'fastify'
import {pool} from '../../../db/pool'
import {identity} from '../../../security/identity'
import {access,allowed,requirePermission,requireValidPermissions} from '../../../security/roles'
import {DomainError,assertUUID} from '../../../domain/errors'
function obj(x:unknown):Record<string,unknown>{if(!x||typeof x!=='object'||Array.isArray(x))throw new DomainError('Objeto JSON requerido',400);return x as Record<string,unknown>}
function validateIds(ids:string[]){ids.forEach(assertUUID)}
export async function registerAccessController(app:FastifyInstance){
 app.get<{Params:{workspaceId:string}}>('/api/v1/workspaces/:workspaceId/access',async req=>{
  assertUUID(req.params.workspaceId)
  const a=await identity(req),ac=await access(req.params.workspaceId,a.id)
  return {roleId:ac.roleId,roleKey:ac.roleKey,roleName:ac.roleName,permissions:[...ac.permissions]}
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
  const {rowCount}=await pool.query(`DELETE FROM workspace_members WHERE workspace_id=$1 AND user_id=$2 AND role <> 'owner'`,[req.params.workspaceId,req.params.userId])
  if(!rowCount)throw new DomainError('Miembro no encontrado o propietario protegido',404)
  await pool.query(`INSERT INTO audit_events(workspace_id,actor_id,event_type,detail) VALUES($1,$2,'workspace.membership_removed',$3::jsonb)`,[req.params.workspaceId,actor.id,JSON.stringify({userId:req.params.userId})])
  return {ok:true}
 })
}
