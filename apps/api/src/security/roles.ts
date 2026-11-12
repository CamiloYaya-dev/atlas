import type {PoolClient} from 'pg'
import {pool} from '../db/pool'
import {PERMISSIONS,ROLE_PRESETS} from '@atlas/contracts'
import {forbidden,DomainError} from '../domain/errors'
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
