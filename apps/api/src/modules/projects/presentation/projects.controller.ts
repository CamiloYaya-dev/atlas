import type {FastifyInstance} from 'fastify'
import {identity} from '../../../security/identity'
import {assertUUID,DomainError} from '../../../domain/errors'
import {ProjectsService} from '../application/projects.service'
const service=new ProjectsService()
const object=(v:unknown):Record<string,unknown>=>{if(!v||Array.isArray(v)||typeof v!=='object')throw new DomainError('JSON requerido',400);return v as Record<string,unknown>}
export async function registerProjectController(app:FastifyInstance){
 app.get<{Params:{projectId:string}}>('/api/v1/projects/:projectId/document',async req=>{assertUUID(req.params.projectId);return service.loadDocument(req.params.projectId,(await identity(req)).id)})
 app.get<{Params:{projectId:string}}>('/api/v1/projects/:projectId/versions',async req=>{assertUUID(req.params.projectId);return service.listVersions(req.params.projectId,(await identity(req)).id)})
 app.get<{Params:{projectId:string}}>('/api/v1/projects/:projectId/export',async req=>{assertUUID(req.params.projectId);return service.exportDocument(req.params.projectId,(await identity(req)).id)})
 app.put<{Params:{projectId:string}}>('/api/v1/projects/:projectId/document',async req=>{assertUUID(req.params.projectId);const b=object(req.body);const version=await service.saveDocument(req.params.projectId,b.document,b.expectedVersion,(await identity(req)).id);return {version}})
 app.post<{Params:{projectId:string}}>('/api/v1/projects/:projectId/import',async req=>{assertUUID(req.params.projectId);const b=object(req.body);const version=await service.saveDocument(req.params.projectId,b.document,b.expectedVersion,(await identity(req)).id,'import');return {version}})
}
