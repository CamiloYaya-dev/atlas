import {pool} from '../../../db/pool'
import type {Project,ProjectDocument} from '@atlas/contracts'
import {access,requirePermission} from '../../../security/roles'
import {applyAuthorizedChange} from '../application/document-policy'
import {notFound,DomainError} from '../../../domain/errors'
import {mergeProjectDocuments,MergeConflict} from '@atlas/contracts'
import {projectVisible} from '../application/document-policy'
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
 async listVersions(projectId:string):Promise<{version:number;created_at:string;updated_by:string;editor_name:string|null}[]>{
  const {rows}=await pool.query<{version:number;created_at:string;updated_by:string;editor_name:string|null}>(`SELECT v.version,v.created_at,v.updated_by,u.display_name AS editor_name
   FROM project_document_versions v LEFT JOIN atlas_users u ON u.id=v.updated_by
   WHERE v.project_id=$1 ORDER BY v.version DESC LIMIT 50`,[projectId]);return rows
 }
 async loadVersion(projectId:string,version:number):Promise<{document:ProjectDocument;version:number;created_at:string;updated_by:string;editor_name:string|null}|null>{
  const {rows}=await pool.query<{document:ProjectDocument;version:number;created_at:string;updated_by:string;editor_name:string|null}>(`SELECT v.document,v.version,v.created_at,v.updated_by,u.display_name AS editor_name
   FROM project_document_versions v LEFT JOIN atlas_users u ON u.id=v.updated_by
   WHERE v.project_id=$1 AND v.version=$2`,[projectId,version]);return rows[0]||null
 }
 async loadDocument(projectId:string):Promise<{document:ProjectDocument,version:number}|null>{const {rows}=await pool.query<{document:ProjectDocument,version:number}>('SELECT document,version FROM project_documents WHERE project_id=$1',[projectId]);return rows[0]||null}
 async saveAuthorized(projectId:string,incoming:ProjectDocument,expectedVersion:number,userId:string,operation:'save'|'import'){
  const saved=await this.saveInternal(projectId,incoming,expectedVersion,userId,operation,false)
  return saved?.version??null
 }
 async saveCollaborative(projectId:string,incoming:ProjectDocument,baseVersion:number,userId:string){
  return this.saveInternal(projectId,incoming,baseVersion,userId,'save',true)
 }
 private async saveInternal(projectId:string,incoming:ProjectDocument,baseVersion:number,userId:string,operation:'save'|'import',collaborative:boolean){
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
   if(collaborative&&ac.roleKey!=='owner'&&![...ac.permissions].some(permission=>
    permission==='field.configure'||/^(diagram|element|relation)\.(create|edit|delete|layout)\./.test(permission)))
    throw new DomainError('No tienes permisos de edición colaborativa',403)
   let submitted=incoming
   if(version!==baseVersion){
    if(!collaborative||baseVersion>version){await c.query('ROLLBACK');return null}
    const storedBase=await c.query<{document:ProjectDocument}>(
     'SELECT document FROM project_document_versions WHERE project_id=$1 AND version=$2',
     [projectId,baseVersion])
    if(!storedBase.rows[0]){await c.query('ROLLBACK');return null}
    try{
     submitted=mergeProjectDocuments(
      projectVisible(storedBase.rows[0].document,ac),incoming,projectVisible(document,ac))
    }catch(e){if(e instanceof MergeConflict)throw new DomainError(e.message,409);throw e}
   }
   const merged=applyAuthorizedChange(document,submitted,ac)
   const updated=await c.query<{version:number}>(`UPDATE project_documents SET document=$1::jsonb,version=version+1,updated_by=$2,updated_at=now() WHERE project_id=$3 RETURNING version`,[JSON.stringify(merged),userId,projectId])
   const next=updated.rows[0].version
   await c.query('INSERT INTO project_document_versions(project_id,version,document,updated_by) VALUES ($1,$2,$3::jsonb,$4)',[projectId,next,JSON.stringify(merged),userId])
   await c.query('INSERT INTO audit_events(workspace_id,actor_id,event_type,resource_id,detail) VALUES ($1,$2,$3,$4,$5::jsonb)',[workspaceId,userId,`project.document_${operation}`,projectId,JSON.stringify({version:next,role:ac.roleKey,collaborative})])
   await c.query('COMMIT')
   return {version:next,document:projectVisible(merged,ac)}
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
 }
}
