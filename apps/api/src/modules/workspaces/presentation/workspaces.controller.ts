import type {FastifyInstance} from 'fastify'
import {identity} from '../../../security/identity'
import {assertUUID,forbidden} from '../../../domain/errors'
import {WorkspacesService} from '../application/workspaces.service'
import {ProjectsService} from '../../projects/application/projects.service'
const service=new WorkspacesService(),projects=new ProjectsService()
const object=(v:unknown):Record<string,unknown>=>{if(!v||Array.isArray(v)||typeof v!=='object')throw Object.assign(new Error('JSON requerido'),{statusCode:400});return v as Record<string,unknown>}
export async function registerWorkspaceController(app:FastifyInstance){
 app.get('/api/v1/workspaces',async req=>service.list((await identity(req)).id))
 app.post('/api/v1/workspaces',async(req,reply)=>{
  const a=await identity(req);if(!a.platformAdmin)throw forbidden()
  const id=await service.create(object(req.body).name,a.id);return reply.code(201).send({id})
 })
 app.get<{Params:{workspaceId:string}}>('/api/v1/workspaces/:workspaceId/projects',async req=>{assertUUID(req.params.workspaceId);return projects.list(req.params.workspaceId,(await identity(req)).id)})
 app.post<{Params:{workspaceId:string}}>('/api/v1/workspaces/:workspaceId/projects',async(req,reply)=>{assertUUID(req.params.workspaceId);const b=object(req.body);const p=await projects.create(req.params.workspaceId,b.name,b.document,(await identity(req)).id);return reply.code(201).send(p)})
 app.patch<{Params:{workspaceId:string}}>('/api/v1/workspaces/:workspaceId',async req=>{assertUUID(req.params.workspaceId);return service.rename(req.params.workspaceId,object(req.body).name,(await identity(req)).id)})
 app.delete<{Params:{workspaceId:string}}>('/api/v1/workspaces/:workspaceId',async req=>{assertUUID(req.params.workspaceId);return service.delete(req.params.workspaceId,(await identity(req)).id)})
 // Registro e invitaciones públicas deshabilitados en modo acceso cerrado.
}
