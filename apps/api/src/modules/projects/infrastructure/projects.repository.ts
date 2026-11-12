import {pool} from '../../../db/pool'
import type {Project,ProjectDocument} from '@atlas/contracts'
import {access,requirePermission} from '../../../security/roles'
import {applyAuthorizedChange} from '../application/document-policy'
import {notFound,DomainError} from '../../../domain/errors'
export class ProjectsRepository {
 async list(workspaceId:string):Promise<Project[]>{const {rows}=await pool.query<Project>('SELECT id,workspace_id,name,description FROM projects WHERE workspace_id=$1 ORDER BY created_at',[workspaceId]);return rows}
 async create(workspaceId:string,name:string,document:ProjectDocument,userId:string):Promise<Project>{
  const c=await pool.connect();try{await c.query('BEGIN')
   const {rows}=await c.query<Project>('INSERT INTO projects(workspace_id,name,created_by) VALUES($1,$2,$3) RETURNING id,workspace_id,name,description',[workspaceId,name,userId]);
   await c.query('INSERT INTO project_documents(project_id,document,updated_by) VALUES ($1,$2::jsonb,$3)',[rows[0].id,JSON.stringify(document),userId]);
   await c.query('INSERT INTO project_document_versions(project_id,version,document,updated_by) VALUES($1,1,$2::jsonb,$3)',[rows[0].id,JSON.stringify(document),userId]);
   await c.query('INSERT INTO audit_events(workspace_id,actor_id,event_type,resource_id) VALUES ($1,$2,$3,$4)',[workspaceId,userId,'project.created',rows[0].id]);
   await c.query('COMMIT');return rows[0]
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
 }
 async scope(projectId:string,userId:string):Promise<{workspaceId:string}|null>{
  const {rows}=await pool.query<{workspaceId:string}>(`SELECT p.workspace_id AS "workspaceId" FROM projects p
    JOIN workspace_members m ON m.workspace_id=p.workspace_id WHERE p.id=$1 AND m.user_id=$2`,[projectId,userId]);return rows[0]||null
 }
 async listVersions(projectId:string):Promise<{version:number;created_at:string;updated_by:string}[]>{
  const {rows}=await pool.query<{version:number;created_at:string;updated_by:string}>('SELECT version,created_at,updated_by FROM project_document_versions WHERE project_id=$1 ORDER BY version DESC LIMIT 50',[projectId]);return rows
 }
 async loadDocument(projectId:string):Promise<{document:ProjectDocument,version:number}|null>{const {rows}=await pool.query<{document:ProjectDocument,version:number}>('SELECT document,version FROM project_documents WHERE project_id=$1',[projectId]);return rows[0]||null}
 async saveAuthorized(projectId:string,incoming:ProjectDocument,expectedVersion:number,userId:string,operation:'save'|'import'){
  const c=await pool.connect()
  try{
   await c.query('BEGIN')
   const current=await c.query<{document:ProjectDocument,version:number,workspaceId:string}>(`
    SELECT d.document,d.version,p.workspace_id AS "workspaceId" FROM project_documents d
    JOIN projects p ON p.id=d.project_id
    JOIN workspace_members m ON m.workspace_id=p.workspace_id AND m.user_id=$2
    WHERE d.project_id=$1 FOR UPDATE OF d`,[projectId,userId])
   if(!current.rows[0])throw notFound()
   const {workspaceId,document,version}=current.rows[0]
   const ac=await access(workspaceId,userId,c)
   requirePermission(ac,'project.read')
   if(operation==='import')requirePermission(ac,'artifact.import')
   if(version!==expectedVersion){await c.query('ROLLBACK');return null}
   const merged=applyAuthorizedChange(document,incoming,ac)
   const updated=await c.query<{version:number}>(`UPDATE project_documents SET document=$1::jsonb,version=version+1,updated_by=$2,updated_at=now() WHERE project_id=$3 RETURNING version`,[JSON.stringify(merged),userId,projectId])
   const next=updated.rows[0].version
   await c.query('INSERT INTO project_document_versions(project_id,version,document,updated_by) VALUES ($1,$2,$3::jsonb,$4)',[projectId,next,JSON.stringify(merged),userId])
   await c.query('INSERT INTO audit_events(workspace_id,actor_id,event_type,resource_id,detail) VALUES ($1,$2,$3,$4,$5::jsonb)',[workspaceId,userId,`project.document_${operation}`,projectId,JSON.stringify({version:next,role:ac.roleKey})])
   await c.query('COMMIT');return next
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
 }
}
