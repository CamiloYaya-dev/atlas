/** Immutable, project-scoped AS-IS snapshots. Never reads a live diagram as historical content. */
import type {FastifyInstance,FastifyRequest} from 'fastify'
import type {ProjectDocument} from '@novzi/contracts'
import {snapshotDiagrams} from './functional-baseline-snapshot'
import {pool} from '../../db/pool'
import {DomainError,assertUUID,notFound} from '../../domain/errors'
import {identity} from '../../security/identity'
import {projectAccess,requirePermission} from '../../security/roles'

const uuid=(v:unknown)=>{if(typeof v!=='string')throw new DomainError('UUID requerido',400);assertUUID(v);return v}
const LIMIT_LINKS=200
const LIMIT_ATTACHMENTS=150
const rowItem=(r:Record<string,any>)=>({id:r.id,projectId:r.project_id,kind:r.kind,number:r.number,code:r.code,title:r.title,payload:r.payload,templateId:r.template_id||null,version:r.version,createdAt:r.created_at,updatedAt:r.updated_at,createdBy:r.created_by,updatedBy:r.updated_by,closedAt:r.closed_at||null})

export async function registerFunctionalBaselineRoutes(app:FastifyInstance){
 type P={projectId:string;itemId:string}
 type B=P&{baselineId:string}
 async function permission(req:FastifyRequest,projectId:string,write=false){
  const actor=await identity(req)
  const access=await projectAccess(projectId,actor.id)
  requirePermission(access,'project.read')
  requirePermission(access,write?'functional.edit':'functional.read')
  const project=await pool.query<{workspace_id:string}>('SELECT workspace_id FROM projects WHERE id=$1',[projectId])
  if(!project.rows[0])throw notFound()
  return {actor,access,workspaceId:project.rows[0].workspace_id}
 }
 const authorizeDiagrams=async(projectId:string,userId:string,document:ProjectDocument)=>{
  const access=await projectAccess(projectId,userId)
  for(const diagram of document.diagrams)requirePermission(access,`diagram.view.${diagram.type}`)
 }
 const storedBaseline=async(projectId:string,itemId:string,baselineId:string)=>{
  const r=await pool.query<Record<string,any>>('SELECT * FROM functional_baselines WHERE project_id=$1 AND item_id=$2 AND id=$3',[projectId,itemId,baselineId])
  if(!r.rows[0])throw notFound()
  return r.rows[0]
 }
 app.get<{Params:P}>('/api/v1/projects/:projectId/functional/items/:itemId/baselines',async req=>{
  const p=uuid(req.params.projectId),itemId=uuid(req.params.itemId),{actor}=await permission(req,p)
  const result=await pool.query<Record<string,any>>('SELECT id,number,created_at,created_by,project_document_version,document_snapshot FROM functional_baselines WHERE project_id=$1 AND item_id=$2 ORDER BY number DESC',[p,itemId])
  for(const r of result.rows)await authorizeDiagrams(p,actor.id,r.document_snapshot)
  return result.rows.map(r=>({id:r.id,number:r.number,createdAt:r.created_at,createdBy:r.created_by,projectDocumentVersion:r.project_document_version,diagramCount:r.document_snapshot.diagrams.length}))
 })
 app.post<{Params:P}>('/api/v1/projects/:projectId/functional/items/:itemId/close',async(req,reply)=>{
  const p=uuid(req.params.projectId),id=uuid(req.params.itemId),{actor,workspaceId,access}=await permission(req,p,true)
  const b=req.body as {expectedVersion?:unknown}|null
  const expectedVersion=b?.expectedVersion
  if(!Number.isSafeInteger(expectedVersion)||Number(expectedVersion)<1)throw new DomainError('Indica la versión del diagnóstico antes de cerrarlo',400)
  const c=await pool.connect()
  try{
   await c.query('BEGIN')
   const found=await c.query<Record<string,any>>('SELECT * FROM functional_items WHERE project_id=$1 AND id=$2 FOR UPDATE',[p,id])
   const item=found.rows[0]
   if(!item)throw notFound()
   if(item.kind!=='asis')throw new DomainError('Solo puedes cerrar diagnósticos AS-IS',400)
   if(item.closed_at)throw new DomainError('El diagnóstico ya está cerrado y no puede sobrescribirse',409)
   if(item.version!==expectedVersion)throw new DomainError('Diagnóstico desactualizado. Actualiza antes de generar la línea base.',409)
   const linkResult=await c.query<Record<string,any>>('SELECT id,target_type AS "targetType",target_id AS "targetId",diagram_id AS "diagramId",label,created_at AS "createdAt" FROM functional_links WHERE project_id=$1 AND source_id=$2 ORDER BY created_at,id',[p,id])
   if(linkResult.rows.length>LIMIT_LINKS)throw new DomainError('Demasiados vínculos para una línea base',400)
   const links=linkResult.rows
   const docQuery=await c.query<{document:ProjectDocument;version:number}>('SELECT document,version FROM project_documents WHERE project_id=$1 FOR SHARE',[p])
   const current=docQuery.rows[0]
   if(!current)throw notFound()
   const diagramIds=new Set(links.filter(x=>x.targetType!=='record').map(x=>x.targetType==='diagram'?x.targetId:x.diagramId).filter(Boolean) as string[])
   if(diagramIds.size===0)throw new DomainError('Vincula al menos un diagrama del proceso antes de cerrar el diagnóstico',400)
   const snapshot=snapshotDiagrams(current.document,diagramIds)
   if(snapshot.diagrams.length!==diagramIds.size)throw new DomainError('Uno de los diagramas ya no existe. Corrige los vínculos antes de cerrar.',409)
   for(const diagram of snapshot.diagrams)requirePermission(access,`diagram.view.${diagram.type}`)
   const targetIds=links.filter(x=>x.targetType==='record').map(x=>x.targetId)
   const others=targetIds.length?(await c.query<Record<string,any>>('SELECT * FROM functional_items WHERE project_id=$1 AND id=ANY($2::uuid[]) ORDER BY code',[p,targetIds])).rows:[]
   if(others.length!==new Set(targetIds).size)throw new DomainError('Hay un registro vinculado que ya no existe',409)
   const fieldKinds=[...new Set(['asis',...others.map(row=>String(row.kind))])]
   const historicFields=(await c.query<Record<string,any>>('SELECT id,kind,name,field_type AS "fieldType",required,options,scope FROM functional_fields WHERE project_id=$1 AND kind=ANY($2::text[]) ORDER BY kind,created_at',[p,fieldKinds])).rows
   const template=(await c.query<Record<string,any>>('SELECT id,name,kind,layout,paper,orientation,page_count,version FROM functional_templates WHERE project_id=$1 AND kind=$2 AND ($3::uuid IS NULL OR id=$3) ORDER BY is_default DESC,updated_at DESC LIMIT 1',[p,'asis',item.template_id])).rows[0]||null
   const saved=await c.query<{id:string;created_at:string}>(`INSERT INTO functional_baselines(project_id,item_id,number,item_snapshot,links_snapshot,records_snapshot,fields_snapshot,document_snapshot,template_snapshot,project_document_version,created_by)
    VALUES($1,$2,1,$3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10) RETURNING id,created_at`,
    [p,id,JSON.stringify(rowItem(item)),JSON.stringify(links),JSON.stringify(others.map(rowItem)),JSON.stringify(historicFields),JSON.stringify(snapshot),JSON.stringify(template),current.version,actor.id])
   const sourceIds=[id,...others.map(r=>String(r.id))]
   const total=await c.query<{total:string}>('SELECT count(*)::text AS total FROM functional_attachments WHERE project_id=$1 AND item_id=ANY($2::uuid[])',[p,sourceIds])
   if(Number(total.rows[0].total)>LIMIT_ATTACHMENTS)throw new DomainError('Máximo 150 archivos en una línea base. Reduce vínculos o evidencias.',400)
   await c.query(`INSERT INTO functional_baseline_attachments(baseline_id,source_item_id,original_attachment_id,file_name,mime_type,file_data,created_at)
    SELECT $3,item_id,id,file_name,mime_type,file_data,created_at FROM functional_attachments WHERE project_id=$1 AND item_id=ANY($2::uuid[])`,[p,sourceIds,saved.rows[0].id])
   const update=await c.query('UPDATE functional_items SET closed_at=now(),closed_by=$3,version=version+1,updated_at=now(),updated_by=$3 WHERE project_id=$1 AND id=$2 AND closed_at IS NULL RETURNING version,closed_at',[p,id,actor.id])
   await c.query('INSERT INTO audit_events(workspace_id,actor_id,event_type,resource_id,detail) VALUES($1,$2,$3,$4,$5::jsonb)',[workspaceId,actor.id,'functional.asis_closed',id,JSON.stringify({baselineId:saved.rows[0].id,projectVersion:current.version,diagrams:snapshot.diagrams.map(d=>d.id),linkedRecords:others.length})])
   await c.query('COMMIT')
   return reply.code(201).send({id:saved.rows[0].id,number:1,createdAt:saved.rows[0].created_at,projectDocumentVersion:current.version,version:update.rows[0].version,closedAt:update.rows[0].closed_at})
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
 })
 app.get<{Params:B}>('/api/v1/projects/:projectId/functional/items/:itemId/baselines/:baselineId',async req=>{
  const p=uuid(req.params.projectId),itemId=uuid(req.params.itemId),baselineId=uuid(req.params.baselineId),{actor}=await permission(req,p)
  const row=await storedBaseline(p,itemId,baselineId)
  await authorizeDiagrams(p,actor.id,row.document_snapshot)
  const attachments=await pool.query('SELECT id,source_item_id AS "sourceItemId",file_name AS "fileName",mime_type AS "mimeType",octet_length(file_data) AS size,created_at AS "createdAt" FROM functional_baseline_attachments WHERE baseline_id=$1 ORDER BY created_at,id',[baselineId])
  return {id:row.id,number:row.number,createdAt:row.created_at,createdBy:row.created_by,projectDocumentVersion:row.project_document_version,item:row.item_snapshot,links:row.links_snapshot,records:row.records_snapshot,fields:row.fields_snapshot,document:row.document_snapshot,template:row.template_snapshot,attachments:attachments.rows}
 })
 app.get<{Params:B&{attachmentId:string}}>('/api/v1/projects/:projectId/functional/items/:itemId/baselines/:baselineId/attachments/:attachmentId',async req=>{
  const p=uuid(req.params.projectId),itemId=uuid(req.params.itemId),baselineId=uuid(req.params.baselineId),attachmentId=uuid(req.params.attachmentId),{actor}=await permission(req,p)
  const baseline=await storedBaseline(p,itemId,baselineId)
  await authorizeDiagrams(p,actor.id,baseline.document_snapshot)
  const result=await pool.query<{file_name:string;mime_type:string;file_data:Buffer}>('SELECT file_name,mime_type,file_data FROM functional_baseline_attachments WHERE baseline_id=$1 AND id=$2',[baselineId,attachmentId])
  if(!result.rows[0])throw notFound()
  return {fileName:result.rows[0].file_name,mimeType:result.rows[0].mime_type,base64:result.rows[0].file_data.toString('base64')}
 })
}
