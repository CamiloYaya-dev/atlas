import {pool} from '../../../db/pool'
import type {Project,ProjectDocument} from '@atlas/contracts'
import {projectAccess,requirePermission} from '../../../security/roles'
import {applyAuthorizedChange,ensureUniqueIds} from '../application/document-policy'
import {notFound,DomainError} from '../../../domain/errors'
import {mergeProjectDocuments,previewProjectMerge,MergeConflict,isProjectDocument} from '@atlas/contracts'
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
   // Restore is an owner-authorized, immutable FULL snapshot. The normal projection
   // omits orphaned elements; passing a historical full snapshot through it
   // wrongly raises 'Intento de modificar un elemento oculto'.
   const merged=operation==='restore' ? structuredClone(submitted) : applyAuthorizedChange(document,submitted,ac)
   if(operation==='restore'){if(!isProjectDocument(merged))throw new DomainError('Instantánea histórica inválida',400);ensureUniqueIds(merged)}
   const updated=await c.query<{version:number}>(`UPDATE project_documents SET document=$1::jsonb,version=version+1,updated_by=$2,updated_at=now() WHERE project_id=$3 RETURNING version`,[JSON.stringify(merged),userId,projectId])
   const next=updated.rows[0].version
   await c.query('INSERT INTO project_document_versions(project_id,version,document,updated_by) VALUES ($1,$2,$3::jsonb,$4)',[projectId,next,JSON.stringify(merged),userId])
   await c.query('INSERT INTO audit_events(workspace_id,actor_id,event_type,resource_id,detail) VALUES ($1,$2,$3,$4,$5::jsonb)',[workspaceId,userId,`project.document_${operation}`,projectId,JSON.stringify({version:next,role:ac.roleKey,collaborative,...(sourceVersion?{sourceVersion}:{})})])
   await c.query('COMMIT')
   return {version:next,document:projectVisible(merged,ac)}
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
 }
 /** Branches reference IMMUTABLE historical revisions; they never replace the working document on creation. */
 async listRestoreBranches(projectId:string,userId:string){
  const ac=await projectAccess(projectId,userId);if(ac.roleKey!=='owner')throw new DomainError('Solo el propietario puede revisar ramas de restauración',403)
  const {rows}=await pool.query<{id:string;source_version:number;base_version:number;created_at:string;status:string;creator_name:string|null}>(`SELECT b.id,b.source_version,b.base_version,b.created_at,b.status,u.display_name AS creator_name
   FROM project_restore_branches b LEFT JOIN atlas_users u ON u.id=b.created_by
   WHERE b.project_id=$1 ORDER BY b.created_at DESC LIMIT 40`,[projectId]);return rows
 }
 async createRestoreBranch(projectId:string,sourceVersion:number,userId:string){
  const c=await pool.connect();try{await c.query('BEGIN')
   const current=await c.query<{workspace_id:string;version:number}>(`SELECT p.workspace_id,d.version FROM projects p JOIN project_documents d ON d.project_id=p.id WHERE p.id=$1 FOR UPDATE OF d`,[projectId]);if(!current.rows[0])throw notFound()
   const ac=await projectAccess(projectId,userId,c);if(ac.roleKey!=='owner')throw new DomainError('Solo el propietario puede proponer restauraciones',403)
   const exists=await c.query('SELECT 1 FROM project_document_versions WHERE project_id=$1 AND version=$2',[projectId,sourceVersion]);if(!exists.rowCount)throw notFound()
   const {rows}=await c.query<{id:string;source_version:number;base_version:number;status:string}>(`INSERT INTO project_restore_branches(project_id,source_version,base_version,created_by)
     VALUES($1,$2,$3,$4) RETURNING id,source_version,base_version,status`,[projectId,sourceVersion,current.rows[0].version,userId])
   await c.query(`INSERT INTO audit_events(workspace_id,actor_id,event_type,resource_id,detail) VALUES($1,$2,'project.restore_branch_created',$3,$4::jsonb)`,[current.rows[0].workspace_id,userId,projectId,JSON.stringify({branchId:rows[0].id,sourceVersion})])
   await c.query('COMMIT');return rows[0]
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
 }
 async previewRestoreBranch(projectId:string,branchId:string,userId:string){
  const ac=await projectAccess(projectId,userId);if(ac.roleKey!=='owner')throw new DomainError('Solo el propietario puede revisar restauraciones',403)
  const {rows}=await pool.query<{id:string;source_version:number;base_version:number;status:string;current_version:number;base:ProjectDocument;historical:ProjectDocument;current:ProjectDocument}>(`
    SELECT b.id,b.source_version,b.base_version,b.status,d.version AS current_version,
      base.document AS base,src.document AS historical,d.document AS current
    FROM project_restore_branches b JOIN project_documents d ON d.project_id=b.project_id
    JOIN project_document_versions base ON base.project_id=b.project_id AND base.version=b.base_version
    JOIN project_document_versions src ON src.project_id=b.project_id AND src.version=b.source_version
    WHERE b.id=$1 AND b.project_id=$2`,[branchId,projectId])
  const item=rows[0];if(!item)throw notFound()
  const plan=previewProjectMerge(item.base,item.historical,item.current)
  return {id:item.id,sourceVersion:item.source_version,baseVersion:item.base_version,currentVersion:item.current_version,status:item.status,conflicts:plan.conflicts,
    historicalDiagrams:item.historical.diagrams.length,currentDiagrams:item.current.diagrams.length}
 }
 async applyRestoreBranch(projectId:string,branchId:string,userId:string,expectedVersion:number,choices:Record<string,'current'|'historical'>,mode:'merge'|'replace'){
  const c=await pool.connect();try{await c.query('BEGIN')
   const result=await c.query<{workspace_id:string;version:number;document:ProjectDocument}>(`
    SELECT p.workspace_id,d.version,d.document FROM projects p JOIN project_documents d ON d.project_id=p.id WHERE p.id=$1 FOR UPDATE OF d`,[projectId]);if(!result.rows[0])throw notFound()
   const ac=await projectAccess(projectId,userId,c);if(ac.roleKey!=='owner')throw new DomainError('Solo el propietario puede aplicar restauraciones',403)
   const row=result.rows[0]
   if(row.version!==expectedVersion)throw new DomainError('Conflicto: el proyecto cambió durante la revisión. Actualiza la propuesta antes de aplicar.',409)
   const branches=await c.query<{source_version:number;base_version:number;status:string}>(`SELECT source_version,base_version,status FROM project_restore_branches WHERE id=$1 AND project_id=$2 FOR UPDATE`,[branchId,projectId]);const branch=branches.rows[0]
   if(!branch||branch.status!=='open')throw new DomainError('La rama de restauración no está disponible',409)
   const snaps=await c.query<{version:number;document:ProjectDocument}>('SELECT version,document FROM project_document_versions WHERE project_id=$1 AND version=ANY($2::int[])',[projectId,[branch.base_version,branch.source_version]])
   const base=snaps.rows.find(x=>x.version===branch.base_version)?.document,historical=snaps.rows.find(x=>x.version===branch.source_version)?.document
   if(!base||!historical)throw notFound()
   const merged=mode==='replace'?structuredClone(historical):previewProjectMerge(base,historical,row.document,choices)
   if(mode==='merge'&&'conflicts' in merged&&merged.conflicts.length)throw new DomainError(`Conflictos sin resolver: ${merged.conflicts.slice(0,5).join(', ')}`,409)
   const resolved=mode==='replace'?historical:(merged as {document:ProjectDocument}).document
   if(!isProjectDocument(resolved))throw new DomainError('Documento inválido',400)
   ensureUniqueIds(resolved)
   if(Buffer.byteLength(JSON.stringify(resolved),'utf8')>4*1024*1024)throw new DomainError('Documento demasiado grande',413)
   const updated=await c.query<{version:number}>('UPDATE project_documents SET document=$1::jsonb,version=version+1,updated_by=$2,updated_at=now() WHERE project_id=$3 RETURNING version',[JSON.stringify(resolved),userId,projectId])
   const version=updated.rows[0].version
   await c.query('INSERT INTO project_document_versions(project_id,version,document,updated_by) VALUES($1,$2,$3::jsonb,$4)',[projectId,version,JSON.stringify(resolved),userId])
   await c.query("UPDATE project_restore_branches SET status='applied',resolved_at=now() WHERE project_id=$1 AND id=$2",[projectId,branchId])
   await c.query(`INSERT INTO audit_events(workspace_id,actor_id,event_type,resource_id,detail) VALUES($1,$2,'project.restore_branch_applied',$3,$4::jsonb)`,[row.workspace_id,userId,projectId,JSON.stringify({branchId,sourceVersion:branch.source_version,mode,version})])
   await c.query('COMMIT');return {version,restoredFrom:branch.source_version,mode}
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
 }
 async discardRestoreBranch(projectId:string,branchId:string,userId:string){
  const c=await pool.connect();try{await c.query('BEGIN')
   const ac=await projectAccess(projectId,userId,c);if(ac.roleKey!=='owner')throw new DomainError('Solo el propietario puede descartar ramas',403)
   const {rows}=await c.query<{id:string}>("UPDATE project_restore_branches SET status='discarded',resolved_at=now() WHERE id=$1 AND project_id=$2 AND status='open' RETURNING id",[branchId,projectId]);if(!rows[0])throw notFound()
   await c.query('COMMIT');return {ok:true}
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
 }
}
