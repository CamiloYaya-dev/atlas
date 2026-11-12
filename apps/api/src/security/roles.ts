import type {PoolClient} from 'pg'
import {pool} from '../db/pool'
import {PERMISSIONS,ROLE_PRESETS} from '@atlas/contracts'
import {forbidden,DomainError,notFound} from '../domain/errors'
export const catalog=new Set<string>(PERMISSIONS)
export interface Access {roleId:string;roleKey:string;roleName:string;permissions:Set<string>}
export async function access(workspaceId:string,userId:string,db:PoolClient|typeof pool=pool):Promise<Access>{
 const {rows}=await db.query<{id:string;role_key:string;name:string}>(
  `SELECT r.id,r.role_key,r.name FROM workspace_members m JOIN workspace_roles r ON r.id=m.role_id AND r.workspace_id=m.workspace_id
    WHERE m.workspace_id=$1 AND m.user_id=$2`,[workspaceId,userId])
 if(!rows[0])throw forbidden()
 const granted=await db.query<{permission:string}>('SELECT permission FROM role_permissions WHERE role_id=$1',[rows[0].id])
 return {roleId:rows[0].id,roleKey:rows[0].role_key,roleName:rows[0].name,permissions:new Set(granted.rows.map(x=>x.permission))}
}
/** A workspace grants organizational access, NOT access to all of its projects.
 * Project membership selects its own role/policy. Workspace owners keep full access.
 */
export async function projectAccess(projectId:string,userId:string,db:PoolClient|typeof pool=pool):Promise<Access>{
 const {rows}=await db.query<{workspace_id:string;workspace_role:string;id:string|null;role_key:string|null;name:string|null}>(`
  SELECT p.workspace_id,wr.role_key AS workspace_role,pr.id,pr.role_key,pr.name
  FROM projects p JOIN workspace_members wm ON wm.workspace_id=p.workspace_id AND wm.user_id=$2
  JOIN workspace_roles wr ON wr.id=wm.role_id AND wr.workspace_id=p.workspace_id
  LEFT JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=$2 AND pm.workspace_id=p.workspace_id
  LEFT JOIN workspace_roles pr ON pr.id=pm.role_id AND pr.workspace_id=p.workspace_id
  WHERE p.id=$1`,[projectId,userId])
 const row=rows[0];if(!row)throw notFound()
 if(row.workspace_role==='owner')return access(row.workspace_id,userId,db)
 if(!row.id||!row.role_key||!row.name)throw notFound()
 const granted=await db.query<{permission:string}>('SELECT permission FROM role_permissions WHERE role_id=$1',[row.id])
 return {roleId:row.id,roleKey:row.role_key,roleName:row.name,permissions:new Set(granted.rows.map(x=>x.permission))}
}
export function allowed(a:Access,key:string){return a.roleKey==='owner'||a.permissions.has(key)}
export function requirePermission(a:Access,key:string){if(!allowed(a,key))throw new DomainError(`Permiso requerido: ${key}`,403)}
export function requireValidPermissions(keys:unknown):string[]{
 if(!Array.isArray(keys)||keys.length>PERMISSIONS.length||!keys.every(x=>typeof x==='string'&&catalog.has(x)))throw new DomainError('Catálogo de permisos inválido',400)
 return [...new Set(keys as string[])]
}
export async function initializeWorkspaceRoles(db:PoolClient,workspaceId:string){
 for(const preset of ROLE_PRESETS){
  // Seeding defaults MUST NOT restore grants removed by an administrator.
  const created=await db.query<{id:string}>(
   'INSERT INTO workspace_roles(workspace_id,role_key,name,system_role) VALUES ($1,$2,$3,$4) ON CONFLICT (workspace_id,role_key) DO NOTHING RETURNING id',
   [workspaceId,preset.key,preset.name,preset.key==='owner'])
  if(!created.rows[0])continue
  await db.query('INSERT INTO role_permissions(role_id,permission) SELECT $1,unnest($2::text[]) ON CONFLICT DO NOTHING',[created.rows[0].id,preset.permissions])
 }
}
