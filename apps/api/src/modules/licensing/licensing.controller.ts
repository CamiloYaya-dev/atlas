import type {FastifyInstance} from 'fastify'
import {identity} from '../../security/identity'
import {assertUUID,forbidden} from '../../domain/errors'
import {getEntitlementsForMember,setLicense} from './licensing'
export async function registerLicensingController(app:FastifyInstance){
 app.get<{Params:{workspaceId:string}}>('/api/v1/workspaces/:workspaceId/license',async req=>{
  assertUUID(req.params.workspaceId);return getEntitlementsForMember(req.params.workspaceId,(await identity(req)).id)
 })
 app.put<{Params:{workspaceId:string}}>('/api/v1/admin/workspaces/:workspaceId/license',async req=>{
  assertUUID(req.params.workspaceId)
  const actor=await identity(req)
  if(!actor.platformAdmin)throw forbidden()
  return setLicense(req.params.workspaceId,actor.id,req.body)
 })
}
