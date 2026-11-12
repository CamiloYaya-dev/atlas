import {pool} from '../../../db/pool'
import type {Project,ProjectDocument} from '@atlas/contracts'
import {projectAccess,requirePermission} from '../../../security/roles'
import {applyAuthorizedChange} from '../application/document-policy'
import {notFound,DomainError} from '../../../domain/errors'
import {mergeProjectDocuments,MergeConflict} from '@atlas/contracts'
import {projectVisible} from '../application/document-policy'
export class ProjectsRepository {
 async list(workspaceId:string,userId:string):Promise<Project[]>{const {rows}=await pool.query<Project>(`SELECT DISTINCT p.id,p.workspace_id,p.name,p.description FROM projects p
 JOIN workspace_members wm ON wm.workspace_id=p.workspace_id AND wm.user_id=$2
 JOIN workspace_roles wr ON wr.id=wm.role_id AND wr.workspace_id=p.workspace_id
 LEFT JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=$2
 WHERE p.workspace_id=$1 AND (wr.role_key='owner' OR pm.user_id IS NOT NULL) ORDER BY p.name`,[workspaceId,userId]);return rows}
 async create(workspaceId:string,name:string,document:ProjectDocument,userId:string):Promise<Project>{
  const c=await pool.connect();try{await c.query('BEGIN')
   const {rows}=await c.query<Project>('INSERT INTO projects(workspace_id,name,created_by) VALUES($1,$2,$3) RETURNING id,workspace_id,name,description',[workspaceId,name,userId]);
   const ownerRole=await c.query<{id:string}>("SELECT id FROM workspace_roles WHERE workspace_id=$1 AND role_key='owner'",[workspaceId])
   await c.query('INSERT INTO project_members(project_id,workspace_id,user_id,role_id) VALUES($1,$2,$3,$4)',[rows[0].id,workspaceId,userId,ownerRole.rows[0].id])
   await c.query('INSERT INTO project_documents(project_id,document,updated_by) VALUES ($1,$2::jsonb,$3)',[rows[0].id,JSON.stringify(document),userId]);
   await c.query('INSERT INTO project_document_versions(project_id,version,document,updated_by) VALUES($1,1,$2::jsonb,$3)',[rows[0].id,JSON.stringify(document),userId]);
   await c.query('INSERT INTO audit_events(workspace_id,actor_id,event_type,resource_id) VALUES ($1,$2,$3,$4)',[workspaceId,userId,'project.created',rows[0].id]);
   await c.query('COMMIT');return rows[0]
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
 }
 async rename(projectId:string,name:string,userId:string):Promise<Project>{
  const c=await pool.connect()
  try{
   await c.query('BEGIN')
   const scope=await c.query<{workspace_id:string}>('SELECT workspace_id FROM projects WHERE id=$1 FOR UPDATE',[projectId])
   if(!scope.rows[0])throw notFound()
   const permission=await projectAccess(projectId,userId,c)
   requirePermission(permission,'project.rename')
   const {rows}=await c.query<Project>(`UPDATE projects p SET name=$3,updated_at=now()
    WHERE p.id=$1 AND EXISTS (SELECT 1 FROM workspace_members m WHERE m.workspace_id=p.workspace_id AND m.user_id=$2)
    RETURNING p.id,p.workspace_id,p.name,p.description`,[projectId,userId,name])
   if(!rows[0])throw notFound()
   await c.query(`INSERT INTO audit_events(workspace_id,actor_id,event_type,resource_id,detail)
    VALUES($1,$2,'project.renamed',$3,$4::jsonb)`,[rows[0].workspace_id,userId,projectId,JSON.stringify({name})])
   await c.query('COMMIT')
   return rows[0]
  }catch(error){await c.query('ROLLBACK');throw error}finally{c.release()}
 }
 async delete(projectId:string,userId:string){
  const c=await pool.connect()
  try{await c.query('BEGIN')
   const scope=await c.query<{workspace_id:string}>('SELECT workspace_id FROM projects WHERE id=$1 FOR UPDATE',[projectId]);if(!scope.rows[0])throw notFound()
   requirePermission(await projectAccess(projectId,userId,c),'project.delete')
   await c.query(`INSERT INTO audit_events(workspace_id,actor_id,event_type,resource_id) VALUES($1,$2,'project.deleted',$3)`,[scope.rows[0].workspace_id,userId,projectId])
   await c.query('DELETE FROM projects WHERE id=$1',[projectId]);await c.query('COMMIT');return {ok:true}
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
 }
 async scope(projectId:string,userId:string):Promise<{workspaceId:string}|null>{
  const {rows}=await pool.query<{workspaceId:string}>(`SELECT p.workspace_id AS "workspaceId" FROM projects p
    JOIN workspace_members m ON m.workspace_id=p.workspace_id AND m.user_id=$2
    JOIN workspace_roles wr ON wr.id=m.role_id AND wr.workspace_id=p.workspace_id
    LEFT JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=$2
    WHERE p.id=$1 AND (wr.role_key='owner' OR pm.user_id IS NOT NULL)`,[projectId,userId]);return rows[0]||null
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
 async saveAuthorized(projectId:string,incoming:ProjectDocument,expectedVersion:number,userId:string,operation:'save'|'import'|'restore',sourceVersion?:number){
  const saved=await this.saveInternal(projectId,incoming,expectedVersion,userId,operation,false,sourceVersion)
  return saved?.version??null
 }
 async saveCollaborative(projectId:string,incoming:ProjectDocument,baseVersion:number,userId:string){
  return this.saveInternal(projectId,incoming,baseVersion,userId,'save',true)
 }
 private async saveInternal(projectId:string,incoming:ProjectDocument,baseVersion:number,userId:string,operation:'save'|'import'|'restore',collaborative:boolean,sourceVersion?:number){
  const c=await pool.connect()
  try{
   await c.query('BEGIN')
   const current=await c.query<{document:ProjectDocument,version:number,workspaceId:string}>(`
    SELECT d.document,d.version,p.workspace_id AS "workspaceId" FROM project_documents d
    JOIN projects p ON p.id=d.project_id
    JOIN workspace_members m ON m.workspace_id=p.workspace_id AND m.user_id=$2
    JOIN workspace_roles wr ON wr.id=m.role_id AND wr.workspace_id=p.workspace_id
    LEFT JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=$2
    WHERE d.project_id=$1 AND (wr.role_key='owner' OR pm.user_id IS NOT NULL) FOR UPDATE OF d`,[projectId,userId])
   if(!current.rows[0])throw notFound()
   const {workspaceId,document,version}=current.rows[0]
   const ac=await projectAccess(projectId,userId,c)
   requirePermission(ac,'project.read')
   if(operation==='restore'&&ac.roleKey!=='owner')throw new DomainError('Solo el propietario puede restaurar un proyecto completo',403)
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
   await c.query('INSERT INTO audit_events(workspace_id,actor_id,event_type,resource_id,detail) VALUES ($1,$2,$3,$4,$5::jsonb)',[workspaceId,userId,`project.document_${operation}`,projectId,JSON.stringify({version:next,role:ac.roleKey,collaborative,...(sourceVersion?{sourceVersion}:{})})])
   await c.query('COMMIT')
   return {version:next,document:projectVisible(merged,ac)}
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
 }
}
