import type {FastifyInstance} from 'fastify'
import {randomUUID} from 'node:crypto'
import {pool} from '../../db/pool'
import {env} from '../../config/env'
import {DomainError,assertUUID,notFound} from '../../domain/errors'
import {identity} from '../../security/identity'
import {access,projectAccess,requirePermission} from '../../security/roles'
import {getEntitlements,featureAllowed,requireFeature} from '../licensing/licensing'
import {ProjectsService} from '../projects/application/projects.service'
import {encodeCapturedDiagram} from './raster-export'
import {embedProvenance,readProvenance,sha256,signature,signaturesMatch} from './provenance'
import type {Provenance} from './provenance'
import {buildDiagramDictionary,zipFiles} from './advanced-document'
import {validateAdvancedExport} from '@atlas/contracts'
import type {AdvancedExportRequest} from '@atlas/contracts'

const projects=new ProjectsService()
const bodyObject=(x:unknown)=>{if(!x||typeof x!=='object'||Array.isArray(x))throw new DomainError('Se requiere objeto JSON',400);return x as Record<string,unknown>}
const safeFile=(name:string)=>name.normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,60)||'diagrama'
export async function registerExportsController(app:FastifyInstance){
 app.post<{Params:{projectId:string;diagramId:string}}>('/api/v1/projects/:projectId/diagrams/:diagramId/export-image',{bodyLimit:19_000_000},async(req,reply)=>{
  assertUUID(req.params.projectId)
  if(!/^[a-zA-Z0-9_-]{1,150}$/.test(req.params.diagramId))throw new DomainError('ID de diagrama inválido',400)
  const user=await identity(req),body=bodyObject(req.body)
  const fmt=body.format
  if(fmt!=='png'&&fmt!=='jpg')throw new DomainError('El formato debe ser png o jpg',400)
  if(!Number.isSafeInteger(body.expectedVersion)||Number(body.expectedVersion)<1)throw new DomainError('Versión esperada inválida',400)
  const a=await projectAccess(req.params.projectId,user.id);requirePermission(a,'artifact.export')
  // La versión y el diagrama se validan contra PostgreSQL con ACL; el navegador aporta píxeles no confiables.
  const saved=await projects.loadDocument(req.params.projectId,user.id)
  if(!saved)throw notFound()
  if(saved.version!==body.expectedVersion)throw new DomainError('Hay cambios recientes: recarga antes de exportar el diagrama',409)
  const d=saved.document.diagrams.find(v=>v.id===req.params.diagramId)
  if(!d)throw notFound()
  const scope=await pool.query<{workspace_id:string}>('SELECT workspace_id FROM projects WHERE id=$1',[req.params.projectId])
  const workspaceId=scope.rows[0]?.workspace_id
  if(!workspaceId)throw notFound()
  const rights=await getEntitlements(workspaceId)
  requireFeature(rights,fmt==='png'?'diagram.export.png':'diagram.export.jpg')
  const watermarkApplied=!featureAllowed(rights,'diagram.export.clean')
  // La exportación con inspector se autoriza por feature independiente (no basta PRO visual).
  let advanced:AdvancedExportRequest|undefined
  if(body.advanced!==undefined){
   requireFeature(rights,'diagram.export.advanced')
   try{advanced=validateAdvancedExport(saved.document,d,body.advanced)}catch(error){throw new DomainError((error as Error).message,400)}
   if(advanced.mode==='simple')throw new DomainError('Usa exportación básica para el modo simple',400)
  }
  // Captura del navegador: la firma certifica emisión e integridad de píxeles, no equivalencia semántica con el modelo.
  // Solo el servidor decide y aplica la marca, la firma y la auditoría.
  if(typeof body.imageBase64!=='string')throw new DomainError('Captura visual requerida; actualiza ATLAS para exportar fielmente',400)
  const raw=await encodeCapturedDiagram(body.imageBase64,fmt,watermarkApplied)
  const createdAt=new Date().toISOString(),exportId=randomUUID()
  const proof:Provenance={version:1,exportId,workspaceId,projectId:req.params.projectId,diagramId:d.id,actorId:user.id,documentVersion:saved.version,format:fmt,planCode:rights.planCode,licenseActive:rights.licenseActive,watermarkApplied,exportedAt:createdAt,imageSha256:sha256(raw)}
  const sig=signature(proof,env.exportSigningKey),finalImage=embedProvenance(raw,fmt,proof,env.exportSigningKey)
  // Confirmación atómica de evidencia y actividad; la imagen no se entrega si falla la auditoría.
  const tx=await pool.connect()
  try{
   await tx.query('BEGIN')
   await tx.query(`INSERT INTO export_audit_logs(id,workspace_id,project_id,diagram_id,actor_id,document_version,format,plan_code,license_active,watermark_applied,image_sha256,signature,file_bytes,created_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,[exportId,workspaceId,req.params.projectId,d.id,user.id,saved.version,fmt,rights.planCode,rights.licenseActive,watermarkApplied,proof.imageSha256,sig,finalImage.length,createdAt])
   await tx.query('INSERT INTO audit_events(workspace_id,actor_id,event_type,resource_id,detail) VALUES($1,$2,$3,$4,$5::jsonb)',[workspaceId,user.id,'diagram.exported',req.params.projectId,JSON.stringify({exportId,diagramId:d.id,format:fmt,documentVersion:saved.version,planCode:rights.planCode,watermarkApplied,mode:advanced?.mode||'simple'})])
   await tx.query('COMMIT')
  }catch(error){await tx.query('ROLLBACK');throw error}finally{tx.release()}
  if(advanced&&['dictionary','both'].includes(advanced.mode)){
   const html=buildDiagramDictionary(saved.document,d,advanced,exportId)
   const zip=zipFiles([
    {name:`ATLAS_${safeFile(d.name)}.${fmt}`,bytes:finalImage},
    {name:`ATLAS_${safeFile(d.name)}_Diccionario.html`,bytes:Buffer.from(html,'utf8')}
   ])
   return reply.header('X-ATLAS-Export-Id',exportId).header('Content-Disposition',`attachment; filename="ATLAS_${safeFile(d.name)}_Documentacion.zip"`).type('application/zip').send(zip)
  }
  return reply.header('X-ATLAS-Export-Id',exportId).header('Content-Disposition',`attachment; filename="ATLAS_${safeFile(d.name)}.${fmt}"`).type(fmt==='png'?'image/png':'image/jpeg').send(finalImage)
 })
 // Verifica integridad binaria, firma criptográfica y emisión registrada; ediciones invalidan la firma.
 app.post('/api/v1/exports/verify',{bodyLimit:19_000_000},async(req)=>{
  const user=await identity(req),body=bodyObject(req.body)
  if(typeof body.imageBase64!=='string'||body.imageBase64.length>18_000_000||!/^[A-Za-z0-9+/=]+$/.test(body.imageBase64))throw new DomainError('Imagen en base64 inválida (máximo 13,5 MB)',400)
  const bytes=Buffer.from(body.imageBase64,'base64')
  if(bytes.length>13_500_000)throw new DomainError('Imagen demasiado grande para verificación por API',413)
  const parsed=readProvenance(bytes)
  if(!parsed)return {verified:false,reason:'sin_firma_atlas'}
  const proof=parsed.proof
  if(typeof proof.exportId!=='string'||!/^[a-f0-9-]{36}$/i.test(proof.exportId))return {verified:false,reason:'firma_invalida'}
  const rows=await pool.query<{workspace_id:string;image_sha256:string;signature:string;watermark_applied:boolean;license_active:boolean}>('SELECT workspace_id,image_sha256,signature,watermark_applied,license_active FROM export_audit_logs WHERE id=$1',[proof.exportId])
  const record=rows.rows[0]
  if(!record)return {verified:false,reason:'exportacion_no_registrada'}
  await access(record.workspace_id,user.id)
  const valid=proof.workspaceId===record.workspace_id&&proof.watermarkApplied===record.watermark_applied&&proof.licenseActive===record.license_active&&proof.imageSha256===record.image_sha256&&sha256(parsed.unsignedImage)===record.image_sha256&&signaturesMatch(parsed.sig,record.signature)&&signaturesMatch(parsed.sig,signature(proof,env.exportSigningKey))
  return {verified:valid,reason:valid?'ok':'imagen_modificada_o_firma_invalida',exportId:proof.exportId,licensed:valid?proof.licenseActive:undefined,watermarkApplied:valid?proof.watermarkApplied:undefined}
 })
 app.get<{Params:{projectId:string}}>('/api/v1/projects/:projectId/export-history',async req=>{
  assertUUID(req.params.projectId);const actor=await identity(req)
  const p=await projectAccess(req.params.projectId,actor.id)
  requirePermission(p,'artifact.export')
  const {rows}=await pool.query(`SELECT id,diagram_id,format,plan_code,watermark_applied,document_version,created_at FROM export_audit_logs WHERE project_id=$1 ORDER BY created_at DESC LIMIT 100`,[req.params.projectId])
  return rows
 })
}
