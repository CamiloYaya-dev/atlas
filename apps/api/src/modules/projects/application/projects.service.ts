import {isProjectDocument,emptyDoc} from '@atlas/contracts'
import {ProjectsRepository} from '../infrastructure/projects.repository'
import {DomainError,notFound,cleanName} from '../../../domain/errors'
import {access,requirePermission} from '../../../security/roles'
import {pool} from '../../../db/pool'
import {projectVisible} from './document-policy'
export class ProjectsService {
 constructor(private readonly repo=new ProjectsRepository()){}
 async list(workspaceId:string,userId:string){const a=await access(workspaceId,userId);requirePermission(a,'project.read');return this.repo.list(workspaceId)}
 async create(workspaceId:string,name:unknown,document:unknown,userId:string){
  const a=await access(workspaceId,userId);requirePermission(a,'project.create')
  if(!isProjectDocument(document))throw new DomainError('Documento ATLAS inválido',400)
  if(Object.keys(document.elements).length||document.diagrams.length)throw new DomainError('Crea primero un proyecto vacío. Usa la importación autorizada para traer modelos.',400)
  return this.repo.create(workspaceId,cleanName(name),emptyDoc(),userId)
 }
 async assertReadable(projectId:string,userId:string){
  const scope=await this.repo.scope(projectId,userId);if(!scope)throw notFound()
  const a=await access(scope.workspaceId,userId);requirePermission(a,'project.read')
 }
 async loadDocument(projectId:string,userId:string){
  const scope=await this.repo.scope(projectId,userId);if(!scope)throw notFound()
  const a=await access(scope.workspaceId,userId);requirePermission(a,'project.read')
  const data=await this.repo.loadDocument(projectId)
  return data?{version:data.version,document:projectVisible(data.document,a)}:null
 }
 async listVersions(projectId:string,userId:string){
  const scope=await this.repo.scope(projectId,userId);if(!scope)throw notFound()
  const a=await access(scope.workspaceId,userId);requirePermission(a,'project.read')
  return this.repo.listVersions(projectId)
 }
 async loadVersion(projectId:string,version:number,userId:string){
  const scope=await this.repo.scope(projectId,userId);if(!scope)throw notFound()
  const a=await access(scope.workspaceId,userId);requirePermission(a,'project.read')
  const data=await this.repo.loadVersion(projectId,version);if(!data)throw notFound()
  return {...data,document:projectVisible(data.document,a)}
 }
 async exportDocument(projectId:string,userId:string){
  const scope=await this.repo.scope(projectId,userId);if(!scope)throw notFound()
  const a=await access(scope.workspaceId,userId);requirePermission(a,'project.read');requirePermission(a,'artifact.export')
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
}
