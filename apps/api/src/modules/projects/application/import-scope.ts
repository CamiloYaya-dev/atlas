import {deploymentRegistry,deploymentRefs,deploymentDetailRefs,remapDeploymentDetail,remapDeploymentRecord} from '@atlas/contracts'
import {componentReferences,remapComponentDetail,componentRegistry,componentRelationRefs,componentRelationDependencies,remapComponentRecord} from '@atlas/contracts'
import {randomUUID} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {emptyDoc,adaptUseCaseDocument,useCaseRegistry,activityReferences,sequenceReferences,diagramLabels,elementLabels} from '@atlas/contracts'
import type {ProjectDocument,ModelElement} from '@atlas/contracts'
import {DomainError} from '../../../domain/errors'
import {projectVisible,applyAuthorizedChange,ensureUniqueIds} from './document-policy'
import type {Access} from '../../../security/roles'
import {requirePermission} from '../../../security/roles'
export type ImportScope={mode:'project'}|{mode:'diagram';targetDiagramId:string;sourceDiagramId:string}
const invalid=(message:string):never=>{throw new DomainError(message,400)}
export function parseImportScope(value:unknown):ImportScope|undefined{
 if(value===undefined)return undefined // legacy API clients
 if(!value||typeof value!=='object'||Array.isArray(value))return invalid('Alcance de importación inválido')
 const v=value as Record<string,unknown>
 if(v.mode==='project'&&Object.keys(v).length===1)return {mode:'project'}
 if(v.mode==='diagram'&&Object.keys(v).length===3&&typeof v.targetDiagramId==='string'&&v.targetDiagramId.length>0&&v.targetDiagramId.length<=200&&typeof v.sourceDiagramId==='string'&&v.sourceDiagramId.length>0&&v.sourceDiagramId.length<=200)return {mode:'diagram',targetDiagramId:v.targetDiagramId,sourceDiagramId:v.sourceDiagramId}
 return invalid('Alcance de importación inválido')
}
/** Run under the repository lock/CAS. Replace one occurrence graph, never overwrite shared fichas.
 * New copies have fresh IDs. Existing diagrams, catalog records and semantic relationships remain intact.
 * Cross-diagram dependencies must already exist in the authorized destination; otherwise import the project. */
export function applyScopedImport(original:ProjectDocument,source:ProjectDocument,scope:ImportScope,a:Access):ProjectDocument{
 requirePermission(a,'artifact.import');requirePermission(a,'project.read')
 ensureUniqueIds(source)
 if(source.diagrams.some(d=>!Object.hasOwn(diagramLabels,d.type))||source.diagrams.some(d=>!d.id)||Object.entries(source.elements).some(([key,e])=>key!==e.id||!Object.hasOwn(elementLabels,e.type)))return invalid('Identificadores o tipos de importación inválidos')
 if(scope.mode==='project'){
  if(a.roleKey!=='owner')throw new DomainError('Solo el propietario puede reemplazar el proyecto completo',403)
  // Validate the replacement as a complete new model, not as edits to unrelated old identities.
  return applyAuthorizedChange({...emptyDoc(),fieldDefinitions:[]},source,a)
 }
 const visible=projectVisible(original,a),target=visible.diagrams.find(d=>d.id===scope.targetDiagramId),stored=original.diagrams.find(d=>d.id===scope.targetDiagramId)
 if(!target||!stored||target.nodes.length!==stored.nodes.length||target.edges.length!==stored.edges.length)throw new DomainError('Diagrama destino no disponible para reemplazo completo',403)
 requirePermission(a,`diagram.edit.${target.type}`);requirePermission(a,`diagram.layout.${target.type}`)
 const from=source.diagrams.find(d=>d.id===scope.sourceDiagramId)
 if(!from)return invalid('Diagrama de origen inexistente')
 if(from.type!==target.type)return invalid('El tipo del diagrama importado no coincide con el diagrama activo')
 // Never delete an inbound granular drill-down link; allow whole diagram links to survive.
 if(Object.values(original.elements).some(e=>e.childDiagramId===target.id&&e.childNodeId))throw new DomainError('El diagrama contiene referencias a cajas que impiden reemplazarlo sin desvincularlas',409)
 const next=structuredClone(visible),src=adaptUseCaseDocument(source),d=src.diagrams.find(x=>x.id===from.id)!
 const required=new Set<string>(d.nodes.map(n=>n.elementId))
 const add=(id:string|undefined)=>{if(id)required.add(id)}
 for(const p of [...d.activity?.parameters||[],...d.interaction?.parameters||[]])add(p.typeId)
 add(d.interaction?.contextId)
 for(const edge of d.edges){add(edge.sequenceEdge?.signatureOwnerId);for(const a of edge.sequenceEdge?.arguments||[])add(a.typeId);add(edge.associationClassId);for(const b of edge.templateBindings||[])add(b.elementId);add(edge.activityEdge?.interruptingRegionId);for(const id of edge.activityEdge?.exceptionTypeIds||[])add(id)}
 const cmpIds=new Map<string,string>(),cmpEnds=new Map<string,string>(),cmp=componentRegistry(src);if(d.type==='uml-component'){const ids=new Set(d.edges.flatMap(e=>e.componentRelationId?[e.componentRelationId]:[])),represented=new Set(src.diagrams.flatMap(v=>v.edges.flatMap(e=>e.componentRelationId?[e.componentRelationId]:[])));for(const r of Object.values(cmp))if(!represented.has(r.id)&&required.has(r.sourceElementId)&&required.has(r.targetElementId))ids.add(r.id);for(const id of ids){const r=cmp[id];if(!r)return invalid('Relación de componentes ausente');cmpIds.set(id,randomUUID());for(const end of r.connector?.ends||[])cmpEnds.set(end.id,randomUUID());for(const dep of componentRelationDependencies(r))ids.add(dep);for(const ref of componentRelationRefs(r))add(ref)}}
 const depIds=new Map<string,string>(),dep=deploymentRegistry(src);if(d.type==='uml-deployment'){const ids=new Set(d.edges.flatMap(e=>e.deploymentRelationId?[e.deploymentRelationId]:[])),represented=new Set(src.diagrams.flatMap(v=>v.edges.flatMap(e=>e.deploymentRelationId?[e.deploymentRelationId]:[])));for(const r of Object.values(dep))if(!represented.has(r.id)&&deploymentRefs(r).some(id=>required.has(id)))ids.add(r.id);for(const id of ids){const r=dep[id];if(!r)return invalid('Registro de despliegue ausente');depIds.set(id,randomUUID());for(const ref of deploymentRefs(r))add(ref)}}
 for(const id of required){const e=Object.hasOwn(src.elements,id)?src.elements[id]:undefined;if(!e)return invalid('El archivo no contiene una ficha referenciada');add(e.semanticOwnerId);for(const ref of deploymentDetailRefs(e.uml?.deployment))add(ref);add(e.useCaseDetail?.classifierId);for(const s of e.useCaseDetail?.subjectIds||[])add(s);for(const r of [...activityReferences(e.activityDetail),...sequenceReferences(e.sequenceDetail,src),...componentReferences(e.uml?.component)])add(r);for(const p of e.uml?.attributes||[])add(p.typeId);for(const op of e.uml?.operations||[]){add(op.returnTypeId);for(const p of op.parameters)add(p.typeId)}for(const p of e.uml?.templateParameters||[])add(p.typeId)}
 const elementIds=new Map<string,string>([...required].map(id=>[id,randomUUID()]))
 const nodes=new Map(d.nodes.map(n=>[n.id,randomUUID()])),edges=new Map(d.edges.map(e=>[e.id,randomUUID()]));const parameters=new Map([...d.activity?.parameters||[],...d.interaction?.parameters||[]].map(p=>[p.id,randomUUID()]));const occurrences=new Map((d.interaction?.occurrences||[]).map(o=>[o.id,randomUUID()])),operands=new Map(d.nodes.flatMap(n=>src.elements[n.elementId]?.sequenceDetail?.operands||[]).map(o=>[o.id,randomUUID()]))
 const ref=(id:string|undefined,ids:Map<string,string>)=>{if(id===undefined)return undefined;return ids.get(id)||invalid('Referencia interna ausente en el diagrama importado')}
 const elementRef=(id:string|undefined)=>ref(id,elementIds)
 const diagramRef=(id:string|undefined)=>{if(!id)return undefined;if(id===d.id)return target.id;const dest=visible.diagrams.find(x=>x.id===id),sourceDest=src.diagrams.find(x=>x.id===id);if(!dest||!sourceDest||dest.type!==sourceDest.type)return invalid('El diagrama tiene dependencias externas no disponibles. Importa el proyecto completo.');return id}
 const ownNodeIds=new Set(d.nodes.map(n=>n.elementId))
 // Detached dependencies may be reused only if the authorized destination has the identical catalog record.
 // Activity type references and use-case contexts are allowed detached by their existing projection rules.
 for(const id of required){if(ownNodeIds.has(id))continue;const e=src.elements[id],existing=visible.elements[id];if(existing&&isDeepStrictEqual(e,existing))elementIds.set(id,id);else if(src.diagrams.some(x=>x.id!==d.id&&x.nodes.some(n=>n.elementId===id)))return invalid('El diagrama depende de una ficha de otra vista. Importa el proyecto completo o conserva esa ficha en destino.')}
 const imported:ModelElement[]=[]
 for(const id of required){const e=structuredClone(src.elements[id]);if(elementIds.get(id)===id)continue;e.id=elementIds.get(id)!;delete e.useCaseCatalog;delete e.activityCatalogDiagramId
  if(e.semanticOwnerId)e.semanticOwnerId=elementRef(e.semanticOwnerId)
  if(e.childDiagramId){const old=e.childDiagramId;e.childDiagramId=diagramRef(old);if(e.childNodeId){if(old===d.id)e.childNodeId=ref(e.childNodeId,nodes);else if(!visible.diagrams.find(x=>x.id===old)?.nodes.some(n=>n.id===e.childNodeId))return invalid('Caja vinculada de otra vista no disponible')}}
  if(e.useCaseDetail){const u=e.useCaseDetail;if(u.classifierId)u.classifierId=elementRef(u.classifierId);if(u.subjectIds)u.subjectIds=u.subjectIds.map(id=>elementRef(id)!)}
  if(e.activityDetail){const x=e.activityDetail;const owner=x.ownerActionId?src.elements[x.ownerActionId]?.activityDetail:undefined;if(e.type==='uml-activity-parameter'&&x.parameterId)x.parameterId=ref(x.parameterId,parameters);if(x.argumentParameterId&&owner?.kind==='callBehavior'&&owner.callDiagramId===d.id)x.argumentParameterId=ref(x.argumentParameterId,parameters);for(const k of ['typeId','referenceId','ownerActionId','represents'] as const)if(x[k])x[k]=elementRef(x[k]);for(const k of ['partitionIds','regionIds'] as const)if(x[k])x[k]=x[k]!.map(id=>elementRef(id)!);if(x.callDiagramId)x.callDiagramId=diagramRef(x.callDiagramId);for(const k of ['decisionInputBehaviorId','selectionBehaviorId'] as const)if(x[k])x[k]=diagramRef(x[k]);if(x.decisionInputFlowId)x.decisionInputFlowId=ref(x.decisionInputFlowId,edges)}
  if(e.sequenceDetail){const x=e.sequenceDetail;const referenced=x.interactionId;for(const k of ['classifierId','representsId','executionActionId'] as const)if(x[k])x[k]=elementRef(x[k]);if(x.signatureIds)x.signatureIds=x.signatureIds.map(id=>elementRef(id)!);if(x.signatureRefs)x.signatureRefs=x.signatureRefs.map(r=>({...r,ownerId:elementRef(r.ownerId)!}));for(const k of ['interactionId','decompositionId','executionBehaviorId'] as const)if(x[k])x[k]=diagramRef(x[k]);for(const k of ['lifelineId','matchId','continuationMatchId'] as const)if(x[k])x[k]=ref(x[k],nodes);if(x.matchIds)x.matchIds=x.matchIds.map(id=>ref(id,nodes)!);if(x.ownerId)x.ownerId=x.ownerId===d.id?target.id:ref(x.ownerId,nodes);for(const k of ['startOccurrenceId','finishOccurrenceId','occurrenceId'] as const)if(x[k])x[k]=ref(x[k],occurrences);if(x.occurrenceIds)x.occurrenceIds=x.occurrenceIds.map(id=>ref(id,occurrences)!);if(x.coregions)x.coregions=x.coregions.map(c=>({startId:ref(c.startId,occurrences)!,finishId:ref(c.finishId,occurrences)!}));if(x.coveredLifelineIds)x.coveredLifelineIds=x.coveredLifelineIds.map(id=>ref(id,nodes)!);if(x.parentOperandId)x.parentOperandId=ref(x.parentOperandId,operands);if(x.operands)x.operands=x.operands.map(o=>({...o,id:ref(o.id,operands)!}));if(x.roleMappings)x.roleMappings=x.roleMappings.map(m=>({from:referenced===d.id?ref(m.from,nodes)!:m.from,to:ref(m.to,nodes)!}));for(const field of ['arguments','results'] as const)if(x[field])x[field]=x[field]!.map(a=>({...a,...(a.typeId?{typeId:elementRef(a.typeId)}:{}),...(a.parameterId&&referenced===d.id?{parameterId:ref(a.parameterId,parameters)}:{})}))}
  if(e.uml){if(e.uml.deployment)e.uml.deployment=remapDeploymentDetail(e.uml.deployment,id=>elementRef(id)!);if(e.uml.component)e.uml.component=remapComponentDetail(e.uml.component,id=>elementRef(id)!);for(const p of e.uml.attributes||[])if(p.typeId)p.typeId=elementRef(p.typeId);for(const o of e.uml.operations||[]){if(o.returnTypeId)o.returnTypeId=elementRef(o.returnTypeId);for(const p of o.parameters)if(p.typeId)p.typeId=elementRef(p.typeId)}for(const p of e.uml.templateParameters||[])if(p.typeId)p.typeId=elementRef(p.typeId)}
  imported.push(e);next.elements[e.id]=e
 }
 // Field definitions are global: do not edit them as a side effect of importing one view.
 for(const e of imported)for(const id of Object.keys(e.fields)){const field=src.fieldDefinitions.find(x=>x.id===id);if(!field)continue;const old=next.fieldDefinitions.find(x=>x.id===id);if(old&&!isDeepStrictEqual(old,field))return invalid('Definición de campo incompatible con el proyecto destino');if(!old)next.fieldDefinitions.push(structuredClone(field))}
 const semIds=new Map<string,string>(),registry=useCaseRegistry(src),represented=new Set(src.diagrams.flatMap(x=>x.edges.flatMap(e=>e.semanticRelationId?[e.semanticRelationId]:[])))
 if(d.type==='uml-usecase'){
  for(const e of d.edges)if(e.semanticRelationId)semIds.set(e.semanticRelationId,randomUUID())
  for(const [id,r] of Object.entries(registry))if(!represented.has(id)&&required.has(r.sourceElementId)&&required.has(r.targetElementId))semIds.set(id,randomUUID())
  next.useCaseRelations={...useCaseRegistry(next)}
  for(const [id,newId] of semIds){const r=registry[id];if(!r)return invalid('Relación semántica ausente');next.useCaseRelations[newId]={...structuredClone(r),id:newId,sourceElementId:elementRef(r.sourceElementId)!,targetElementId:elementRef(r.targetElementId)!}}
 }
 if(depIds.size){next.deploymentRelations={...deploymentRegistry(next)};for(const [old,id] of depIds)next.deploymentRelations[id]=remapDeploymentRecord(dep[old],x=>elementRef(x)!,id)}
 if(cmpIds.size){next.componentRelations={...componentRegistry(next)};for(const [old,id] of cmpIds){const r=remapComponentRecord(cmp[old],x=>elementRef(x)!,x=>ref(x,cmpIds)!);if(r.connector)r.connector.ends=r.connector.ends.map(e=>({...e,id:ref(e.id,cmpEnds)!}));next.componentRelations[id]=r}}
 const replacement=structuredClone(d);replacement.id=target.id;replacement.createdAt=target.createdAt
 replacement.nodes=replacement.nodes.map(n=>({...n,id:ref(n.id,nodes)!,elementId:elementRef(n.elementId)!,...(n.parentNodeId?{parentNodeId:ref(n.parentNodeId,nodes)}:{})}))
 replacement.edges=replacement.edges.map(e=>({...e,id:ref(e.id,edges)!,source:ref(e.source,nodes)!,target:ref(e.target,nodes)!,...(e.semanticRelationId?{semanticRelationId:ref(e.semanticRelationId,semIds)}:{}),...(e.deploymentRelationId?{deploymentRelationId:ref(e.deploymentRelationId,depIds)!}:{}),...(e.componentRelationId?{componentRelationId:ref(e.componentRelationId,cmpIds)}:{}),...(e.componentEnds?{componentEnds:e.componentEnds.map(x=>({...x,id:ref(x.id,cmpEnds)!,nodeId:ref(x.nodeId,nodes)!}))}:{}),...(e.annotationTargetEdgeId?{annotationTargetEdgeId:ref(e.annotationTargetEdgeId,edges)}:{}),...(e.associationClassId?{associationClassId:elementRef(e.associationClassId)}:{}),...(e.associationEnds?{associationEnds:e.associationEnds.map((x,i)=>{const old=e.deploymentRelationId?dep[e.deploymentRelationId]:undefined,r=e.deploymentRelationId?next.deploymentRelations?.[depIds.get(e.deploymentRelationId)||'']:undefined;const index=old?.kind==='communication-path'?old.ends.findIndex(end=>end.id===x.id):i;if(r?.kind==='communication-path'&&index<0)throw new DomainError('Extremo de despliegue inexistente',400);return {...x,...(r&&r.kind==='communication-path'?{id:r.ends[index].id}:{}),nodeId:ref(x.nodeId,nodes)!}})}:{}),...(e.templateBindings?{templateBindings:e.templateBindings.map(b=>({...b,elementId:elementRef(b.elementId)!}))}:{}),...(e.activityEdge?{activityEdge:{...e.activityEdge,...(e.activityEdge.selectionBehaviorId?{selectionBehaviorId:diagramRef(e.activityEdge.selectionBehaviorId)}:{}),...(e.activityEdge.transformationBehaviorId?{transformationBehaviorId:diagramRef(e.activityEdge.transformationBehaviorId)}:{}),...(e.activityEdge.interruptingRegionId?{interruptingRegionId:elementRef(e.activityEdge.interruptingRegionId)}:{}),...(e.activityEdge.exceptionTypeIds?{exceptionTypeIds:e.activityEdge.exceptionTypeIds.map(x=>elementRef(x)!)}:{})}}:{})}))
 if(replacement.interaction){const r=replacement.interaction;r.id=target.id;r.occurrences=r.occurrences.map(o=>({...o,id:ref(o.id,occurrences)!,nodeId:ref(o.nodeId,nodes)!,...(o.operandId?{operandId:ref(o.operandId,operands)}:{})}));if(r.contextId)r.contextId=elementRef(r.contextId);for(const e of replacement.edges){const x=e.sequenceEdge;if(!x)continue;for(const k of ['sendId','receiveId','beforeId','afterId'] as const)if(x[k])x[k]=ref(x[k],occurrences);if(x.replyToId)x.replyToId=ref(x.replyToId,edges);if(x.signatureOwnerId){if(x.signatureId===x.signatureOwnerId)x.signatureId=elementRef(x.signatureId);x.signatureOwnerId=elementRef(x.signatureOwnerId)}for(const a of x.arguments||[])if(a.typeId)a.typeId=elementRef(a.typeId)}}
 for(const p of [...replacement.activity?.parameters||[],...replacement.interaction?.parameters||[]]){p.id=ref(p.id,parameters)!;if(p.typeId)p.typeId=elementRef(p.typeId)}
 next.diagrams=next.diagrams.map(x=>x.id===target.id?replacement:x)
 return applyAuthorizedChange(original,next,a)
}
