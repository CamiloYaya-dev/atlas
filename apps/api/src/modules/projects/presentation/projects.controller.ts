import type {FastifyInstance} from 'fastify'
import {identity} from '../../../security/identity'
import {assertUUID,DomainError} from '../../../domain/errors'
import {ProjectsService} from '../application/projects.service'
import {projectEvents} from '../realtime/project-events'
import {projectAccess} from '../../../security/roles'
const service=new ProjectsService()
const object=(v:unknown):Record<string,unknown>=>{if(!v||Array.isArray(v)||typeof v!=='object')throw new DomainError('JSON requerido',400);return v as Record<string,unknown>}
export async function registerProjectController(app:FastifyInstance){
 app.get<{Params:{projectId:string}}>('/api/v1/projects/:projectId/document',async req=>{assertUUID(req.params.projectId);return service.loadDocument(req.params.projectId,(await identity(req)).id)})
 app.get<{Params:{projectId:string}}>('/api/v1/projects/:projectId/versions',async req=>{assertUUID(req.params.projectId);return service.listVersions(req.params.projectId,(await identity(req)).id)})
 app.get<{Params:{projectId:string;version:string}}>('/api/v1/projects/:projectId/versions/:version',async req=>{
  assertUUID(req.params.projectId)
  if(!/^[1-9]\d*$/.test(req.params.version))throw new DomainError('Versión inválida',400)
  const version=Number(req.params.version)
  if(!Number.isSafeInteger(version))throw new DomainError('Versión inválida',400)
  return service.loadVersion(req.params.projectId,version,(await identity(req)).id)
 })
 // Live collaboration: SSE uses the same session cookie and project authorization.
 app.get<{Params:{projectId:string},Querystring:{clientId?:string}}>('/api/v1/projects/:projectId/events',async(req,reply)=>{
  assertUUID(req.params.projectId)
  const clientId=req.query.clientId
  if(typeof clientId!=='string'||!/^[a-zA-Z0-9_-]{8,80}$/.test(clientId))throw new DomainError('Identificador de conexión inválido',400)
  const actor=await identity(req)
  const snapshot=await service.loadDocument(req.params.projectId,actor.id)
  if(!snapshot)throw new DomainError('Proyecto no encontrado',404)
  reply.hijack()
  reply.raw.writeHead(200,{
   'Content-Type':'text/event-stream; charset=utf-8',
   'Cache-Control':'no-store, no-transform',
   'X-Accel-Buffering':'no',
   'Connection':'keep-alive',
   'X-Content-Type-Options':'nosniff',
   'Access-Control-Allow-Credentials':'true',
  })
  reply.raw.write(': ATLAS live\n\n')
  projectEvents.subscribe(req.params.projectId,clientId,actor.id,actor.displayName,reply.raw,snapshot.version,async()=>{await identity(req);const current=await service.loadDocument(req.params.projectId,actor.id);if(!current)throw new DomainError('Proyecto no encontrado',404);projectEvents.updateVisibility(req.params.projectId,clientId,new Set(current.document.diagrams.map(d=>d.id)),new Set(Object.keys(current.document.elements)))},{diagrams:new Set(snapshot.document.diagrams.map(d=>d.id)),elements:new Set(Object.keys(snapshot.document.elements))})
 })
 app.post<{Params:{projectId:string}}>('/api/v1/projects/:projectId/presence',async req=>{
  assertUUID(req.params.projectId)
  const actor=await identity(req),body=object(req.body)
  const clientId=body.clientId
  if(typeof clientId!=='string'||!/^[a-zA-Z0-9_-]{8,80}$/.test(clientId))throw new DomainError('Identificador de conexión inválido',400)
  const diagramId=body.diagramId===null?null:body.diagramId
  const elementId=body.elementId===null?null:body.elementId
  if(diagramId!==null&&typeof diagramId!=='string'||elementId!==null&&typeof elementId!=='string')throw new DomainError('Presencia inválida',400)
  const snapshot=await service.loadDocument(req.params.projectId,actor.id)
  if(!snapshot)throw new DomainError('Proyecto no encontrado',404)
  if(diagramId!==null&&!snapshot.document.diagrams.some(d=>d.id===diagramId))throw new DomainError('Diagrama no visible',403)
  if(elementId!==null&&(!diagramId||!snapshot.document.elements[elementId]||!snapshot.document.diagrams.find(d=>d.id===diagramId)?.nodes.some(n=>n.elementId===elementId)))throw new DomainError('Elemento no visible',403)
  projectEvents.updatePresence(req.params.projectId,clientId,actor.id,diagramId as string|null,elementId as string|null)
  return {ok:true}
 })
 app.get<{Params:{projectId:string}}>('/api/v1/projects/:projectId/access',async req=>{
  assertUUID(req.params.projectId);const a=await projectAccess(req.params.projectId,(await identity(req)).id)
  return {roleId:a.roleId,roleKey:a.roleKey,roleName:a.roleName,permissions:[...a.permissions]}
 })
 app.delete<{Params:{projectId:string}}>('/api/v1/projects/:projectId',async req=>{
  assertUUID(req.params.projectId);return service.delete(req.params.projectId,(await identity(req)).id)
 })
 app.patch<{Params:{projectId:string}}>('/api/v1/projects/:projectId',async req=>{
  assertUUID(req.params.projectId)
  return service.rename(req.params.projectId,object(req.body).name,(await identity(req)).id)
 })
 app.post<{Params:{projectId:string}}>('/api/v1/projects/:projectId/restore',async req=>{
  assertUUID(req.params.projectId)
  const actor=await identity(req),b=object(req.body)
  const restored=await service.restoreVersion(req.params.projectId,b.sourceVersion,b.expectedVersion,actor.id)
  projectEvents.publishVersion(req.params.projectId,restored.version)
  return restored
 })
 app.get<{Params:{projectId:string}}>('/api/v1/projects/:projectId/export',async req=>{assertUUID(req.params.projectId);return service.exportDocument(req.params.projectId,(await identity(req)).id)})
 app.put<{Params:{projectId:string}}>('/api/v1/projects/:projectId/document',async req=>{
  assertUUID(req.params.projectId)
  const b=object(req.body),actor=await identity(req)
  if(b.collaborative===true){
   const saved=await service.saveCollaborative(req.params.projectId,b.document,b.expectedVersion,actor.id)
   projectEvents.publishVersion(req.params.projectId,saved.version)
   return saved
  }
  const version=await service.saveDocument(req.params.projectId,b.document,b.expectedVersion,actor.id)
  projectEvents.publishVersion(req.params.projectId,version)
  return {version}
 })
 app.post<{Params:{projectId:string}}>('/api/v1/projects/:projectId/import',async req=>{assertUUID(req.params.projectId);const b=object(req.body);const actor=await identity(req);const version=await service.saveDocument(req.params.projectId,b.document,b.expectedVersion,actor.id,'import');projectEvents.publishVersion(req.params.projectId,version);return {version}})
}
