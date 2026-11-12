import {isProjectDocument,emptyDoc} from '@atlas/contracts'
import {ProjectsRepository} from '../infrastructure/projects.repository'
import {DomainError,notFound,cleanName} from '../../../domain/errors'
import {access,projectAccess,requirePermission} from '../../../security/roles'
import {pool} from '../../../db/pool'
import {projectVisible} from './document-policy'
export class ProjectsService {
 constructor(private readonly repo=new ProjectsRepository()){}
 async list(workspaceId:string,userId:string){await access(workspaceId,userId);return this.repo.list(workspaceId,userId)}
 async create(workspaceId:string,name:unknown,document:unknown,userId:string){
  const a=await access(workspaceId,userId);requirePermission(a,'project.create')
  if(!isProjectDocument(document))throw new DomainError('Documento ATLAS inválido',400)
  if(Object.keys(document.elements).length||document.diagrams.length)throw new DomainError('Crea primero un proyecto vacío. Usa la importación autorizada para traer modelos.',400)
  return this.repo.create(workspaceId,cleanName(name),emptyDoc(),userId)
 }
 async rename(projectId:string,name:unknown,userId:string){
  const scope=await this.repo.scope(projectId,userId);if(!scope)throw notFound()
  const ac=await projectAccess(projectId,userId);requirePermission(ac,'project.rename')
  return this.repo.rename(projectId,cleanName(name),userId)
 }
 async delete(projectId:string,userId:string){const a=await projectAccess(projectId,userId);requirePermission(a,'project.delete');return this.repo.delete(projectId,userId)}
 /** Only the owner can restore a full historical document. This creates a NEW version,
  * and the expected current version prevents lost updates during collaboration. */
 async restoreVersion(projectId:string,sourceVersion:unknown,expectedVersion:unknown,userId:string){
  const scope=await this.repo.scope(projectId,userId);if(!scope)throw notFound()
  const ac=await projectAccess(projectId,userId)
  if(ac.roleKey!=='owner')throw new DomainError('Solo el propietario puede restaurar un proyecto completo',403)
  if(typeof sourceVersion!=='number'||!Number.isSafeInteger(sourceVersion)||sourceVersion<1)throw new DomainError('Versión de origen inválida',400)
  if(typeof expectedVersion!=='number'||!Number.isSafeInteger(expectedVersion)||expectedVersion<1)throw new DomainError('Versión actual inválida',400)
  const snapshot=await this.repo.loadVersion(projectId,sourceVersion)
  if(!snapshot)throw notFound()
  const next=await this.repo.saveAuthorized(projectId,snapshot.document,expectedVersion,userId,'restore',sourceVersion)
  if(next===null)throw new DomainError('Conflicto: hay cambios más recientes. Actualiza el historial antes de restaurar.',409)
  return {version:next,restoredFrom:sourceVersion}
 }
 async assertReadable(projectId:string,userId:string){
  const scope=await this.repo.scope(projectId,userId);if(!scope)throw notFound()
  const a=await projectAccess(projectId,userId);requirePermission(a,'project.read')
 }
 async loadDocument(projectId:string,userId:string){
  const scope=await this.repo.scope(projectId,userId);if(!scope)throw notFound()
  const a=await projectAccess(projectId,userId);requirePermission(a,'project.read')
  const data=await this.repo.loadDocument(projectId)
  return data?{version:data.version,document:projectVisible(data.document,a)}:null
 }
 async listVersions(projectId:string,userId:string){
  const scope=await this.repo.scope(projectId,userId);if(!scope)throw notFound()
  const a=await projectAccess(projectId,userId);requirePermission(a,'project.read')
  return this.repo.listVersions(projectId)
 }
 async loadVersion(projectId:string,version:number,userId:string){
  const scope=await this.repo.scope(projectId,userId);if(!scope)throw notFound()
  const a=await projectAccess(projectId,userId);requirePermission(a,'project.read')
  const data=await this.repo.loadVersion(projectId,version);if(!data)throw notFound()
  return {...data,document:projectVisible(data.document,a)}
 }
 async exportDocument(projectId:string,userId:string){
  const scope=await this.repo.scope(projectId,userId);if(!scope)throw notFound()
  const a=await projectAccess(projectId,userId);requirePermission(a,'project.read');requirePermission(a,'artifact.export')
  const data=await this.repo.loadDocument(projectId)
  if(!data)throw notFound()
  return {format:'ATLAS-V4.2',exportedAt:new Date().toISOString(),document:projectVisible(data.document,a)}
 }
 async saveDocument(projectId:string,document:unknown,expectedVersion:unknown,userId:string,operation:'save'|'import'='save'){
  if(!isProjectDocument(document))throw new DomainError('Documento ATLAS inválido',400)
  if(Buffer.byteLength(JSON.stringify(document),'utf8')>4*1024*1024)throw new DomainError('Documento demasiado grande (máximo 4 MB)',413)
  if(typeof expectedVersion!=='number'||!Number.isSafeInteger(expectedVersion)||expectedVersion<1)throw new DomainError('Versión esperada inválida',400)
  const version=await this.repo.saveAuthorized(projectId,document,expectedVersion,userId,operation)
  if(version===null)throw new DomainError('Conflicto: otro usuario guardó antes. Recarga antes de modificar.',409)
  return version
 }
 async saveCollaborative(projectId:string,document:unknown,baseVersion:unknown,userId:string){
  if(!isProjectDocument(document))throw new DomainError('Documento ATLAS inválido',400)
  if(Buffer.byteLength(JSON.stringify(document),'utf8')>4*1024*1024)throw new DomainError('Documento demasiado grande (máximo 4 MB)',413)
  if(typeof baseVersion!=='number'||!Number.isSafeInteger(baseVersion)||baseVersion<1)throw new DomainError('Versión base inválida',400)
  const result=await this.repo.saveCollaborative(projectId,document,baseVersion,userId)
  if(!result)throw new DomainError('Versión base no disponible. Conserva tu copia local y recarga el proyecto.',409)
  return result
 }
 async listRestoreBranches(projectId:string,userId:string){await this.assertReadable(projectId,userId);return this.repo.listRestoreBranches(projectId,userId)}
 async createRestoreBranch(projectId:string,sourceVersion:unknown,userId:string){await this.assertReadable(projectId,userId);if(typeof sourceVersion!=='number'||!Number.isSafeInteger(sourceVersion)||sourceVersion<1)throw new DomainError('Versión histórica inválida',400);return this.repo.createRestoreBranch(projectId,sourceVersion,userId)}
 async previewRestoreBranch(projectId:string,branchId:string,userId:string){await this.assertReadable(projectId,userId);return this.repo.previewRestoreBranch(projectId,branchId,userId)}
 async applyRestoreBranch(projectId:string,branchId:string,userId:string,body:Record<string,unknown>){
  await this.assertReadable(projectId,userId)
  const version=body.expectedVersion,mode=body.mode,resolutions=body.resolutions??{}
  if(typeof version!=='number'||!Number.isSafeInteger(version)||version<1)throw new DomainError('Versión esperada inválida',400)
  if(mode!=='merge'&&mode!=='replace')throw new DomainError('Modo de restauración inválido',400)
  if(!resolutions||typeof resolutions!=='object'||Array.isArray(resolutions)||Object.keys(resolutions).length>500||Object.entries(resolutions).some(([k,v])=>!k.startsWith('document.')||k.length>500||(v!=='current'&&v!=='historical')))throw new DomainError('Resoluciones de conflicto inválidas',400)
  return this.repo.applyRestoreBranch(projectId,branchId,userId,version,resolutions as Record<string,'current'|'historical'>,mode)
 }
 async discardRestoreBranch(projectId:string,branchId:string,userId:string){await this.assertReadable(projectId,userId);return this.repo.discardRestoreBranch(projectId,branchId,userId)}

}
