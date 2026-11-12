import {pool} from '../../../db/pool'
import type {Workspace,Role} from '@atlas/contracts'
import {initializeWorkspaceRoles,access,requirePermission} from '../../../security/roles'
import {DomainError,notFound} from '../../../domain/errors'
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
 async rename(workspaceId:string,name:string,userId:string){
  const c=await pool.connect()
  try{await c.query('BEGIN')
   const locked=await c.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE',[workspaceId]);if(!locked.rows[0])throw notFound()
   requirePermission(await access(workspaceId,userId,c),'workspace.rename')
   const {rows}=await c.query<{id:string;name:string}>(`UPDATE workspaces SET name=$2,updated_at=now() WHERE id=$1 RETURNING id,name`,[workspaceId,name])
   await c.query(`INSERT INTO audit_events(workspace_id,actor_id,event_type,detail) VALUES($1,$2,'workspace.renamed',$3::jsonb)`,[workspaceId,userId,JSON.stringify({name})])
   await c.query('COMMIT');return rows[0]
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
 }
 async delete(workspaceId:string,userId:string){
  const c=await pool.connect()
  try{await c.query('BEGIN')
   const locked=await c.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE',[workspaceId]);if(!locked.rows[0])throw notFound()
   requirePermission(await access(workspaceId,userId,c),'workspace.delete')
   const projects=await c.query('SELECT id FROM projects WHERE workspace_id=$1 LIMIT 1',[workspaceId]);if(projects.rows[0])throw new DomainError('El espacio tiene proyectos: elimínalos antes para evitar pérdida de información',409)
   await c.query('DELETE FROM workspaces WHERE id=$1',[workspaceId])
   await c.query('COMMIT');return {ok:true}
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
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
