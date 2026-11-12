import {pool} from '../../../db/pool'
import type {Workspace,Role} from '@atlas/contracts'
import {initializeWorkspaceRoles} from '../../../security/roles'
export class WorkspacesRepository {
 async listForUser(userId:string):Promise<Workspace[]>{
  const {rows}=await pool.query<Workspace>(`SELECT w.id,w.name,w.created_by,r.role_key AS role
   FROM workspaces w JOIN workspace_members m ON m.workspace_id=w.id
   JOIN workspace_roles r ON r.id=m.role_id WHERE m.user_id=$1 ORDER BY w.created_at`,[userId]);return rows
 }
 async role(workspaceId:string,userId:string):Promise<Role|null>{
  const {rows}=await pool.query<{role:Role}>(`SELECT r.role_key AS role FROM workspace_members m JOIN workspace_roles r ON r.id=m.role_id
   WHERE m.workspace_id=$1 AND m.user_id=$2`,[workspaceId,userId]);return rows[0]?.role||null
 }
 async create(name:string,userId:string):Promise<string>{
  const c=await pool.connect()
  try{
   await c.query('BEGIN')
   const result=await c.query<{id:string}>('INSERT INTO workspaces(name,created_by) VALUES($1,$2) RETURNING id',[name,userId])
   const id=result.rows[0].id
   await initializeWorkspaceRoles(c,id)
   const role=await c.query<{id:string}>("SELECT id FROM workspace_roles WHERE workspace_id=$1 AND role_key='owner'",[id])
   await c.query("INSERT INTO workspace_members(workspace_id,user_id,role,role_id) VALUES ($1,$2,'owner',$3)",[id,userId,role.rows[0].id])
   await c.query('COMMIT');return id
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
 }
}
