import {newDeploymentIssues,deploymentRegistry,deploymentRefs,deploymentDetailRefs,validDeploymentRegistry} from '@novzi/contracts'
import {newComponentIssues,componentReferences,componentRegistry,componentRelationRefs,componentRelationDependencies,validComponentRegistry,validComponentEdgeShape} from '@novzi/contracts'
import {newSequenceIssues,validSequenceRoot,validSequenceDetail,validSequenceEdgeDetail,sequenceReferences,sequenceGatePair,sequenceGateMatchIds} from '@novzi/contracts'
import {newActivityIssues,retainActivityCatalog,activityCatalogReferenced,ACTIVITY_TYPES,activityReferences,validActivityRoot,validActivityDetail,validActivityEdgeDetail} from '@novzi/contracts'
import {newUseCaseIssues,adaptUseCaseDocument,useCaseRegistry,validUseCaseRegistry,repairStoredUseCaseAnnotations,retainUseCaseCatalog,isUseCaseCatalogType,useCaseElementIsReferenced} from '@novzi/contracts'
import {newClassIssues,classSelfAllowed,umlRelationNameLocked} from '@novzi/contracts'
import {isDeepStrictEqual} from 'node:util'
import type {Diagram,DiagramNode,DiagramEdge,ModelElement,ProjectDocument,FieldDefinition} from '@novzi/contracts'
import {sequenceSnapChild,sequenceActivationHandleValid,isUmlDiagram,validUmlEdgeNotation,umlAncestryValid,novziNodeSize,validNodeDimension,umlNodeDepth,umlRelationEndpointValid} from '@novzi/contracts'
import {relationScope,umlElementAllowed,umlRelationAllowed,validUmlDetail} from '@novzi/contracts'
import type {Access} from '../../../security/roles'
import {allowed,requirePermission} from '../../../security/roles'
import {DomainError} from '../../../domain/errors'
const equal=(a:unknown,b:unknown)=>isDeepStrictEqual(a,b)
const fail=(message:string):never=>{throw new DomainError(message,403)}
const isObj=(o:unknown):o is Record<string,unknown>=>!!o&&typeof o==='object'&&!Array.isArray(o)
export function projectVisible(document:ProjectDocument,a:Access):ProjectDocument{
 // Proyectar el subconjunto ANTES de resolver catálogos o referencias cruzadas.
 // Un editor restringido nunca recibe fichas compartidas exclusivas de diagramas ocultos.
 if(a.diagramIds){
  const selected=document.diagrams.filter(d=>a.diagramIds!.has(d.id))
  const kept=new Set(selected.flatMap(d=>d.nodes.map(n=>n.elementId)))
  const selectedDiagramIds=new Set(selected.map(d=>d.id))
  document={...document,diagrams:selected,
   elements:Object.fromEntries(Object.entries(document.elements).filter(([id])=>kept.has(id)).map(([id,e])=>[id,{
    ...e,...(e.childDiagramId&&!selectedDiagramIds.has(e.childDiagramId)?{childDiagramId:undefined,childNodeId:undefined}:{}),
    ...(e.semanticOwnerId&&!kept.has(e.semanticOwnerId)?{semanticOwnerId:undefined}:{})
   }])),
   componentRelations:Object.fromEntries(Object.entries(document.componentRelations||{}).filter(([,r])=>componentRelationRefs(r).every(id=>kept.has(id)))),
   deploymentRelations:Object.fromEntries(Object.entries(document.deploymentRelations||{}).filter(([,r])=>deploymentRefs(r).every(id=>kept.has(id)))),
   useCaseRelations:Object.fromEntries(Object.entries(document.useCaseRelations||{}).filter(([,r])=>kept.has(r.sourceElementId)&&kept.has(r.targetElementId))),
   fieldDefinitions:document.fieldDefinitions}
 }
 document=repairStoredUseCaseAnnotations(adaptUseCaseDocument(document))
 const diagrams=document.diagrams.filter(d=>allowed(a,`diagram.view.${d.type}`))
 const visibleIds=new Set(diagrams.flatMap(d=>d.nodes.map(n=>n.elementId)))
 if(allowed(a,'diagram.view.uml-component')&&allowed(a,'element.technical.view')){const placed=new Set(document.diagrams.flatMap(d=>d.nodes.map(n=>n.elementId)));for(const r of Object.values(componentRegistry(document)))if(componentRelationRefs(r).every(id=>!placed.has(id)||visibleIds.has(id)))for(const id of componentRelationRefs(r))visibleIds.add(id);for(const id of visibleIds){const e=document.elements[id];if(e&&allowed(a,`element.view.${e.type}`))for(const ref of [e.semanticOwnerId,...componentReferences(e.uml?.component)])if(ref&&!placed.has(ref))visibleIds.add(ref)}}
 if(allowed(a,'diagram.view.uml-deployment')&&allowed(a,'element.technical.view')){const placed=new Set(document.diagrams.flatMap(d=>d.nodes.map(n=>n.elementId)));for(const r of Object.values(deploymentRegistry(document)))if(deploymentRefs(r).every(id=>!placed.has(id)||visibleIds.has(id)))for(const id of deploymentRefs(r))visibleIds.add(id);for(const id of visibleIds){const e=document.elements[id];if(e&&allowed(a,`element.view.${e.type}`))for(const ref of [e.semanticOwnerId,...deploymentDetailRefs(e.uml?.deployment)])if(ref&&!placed.has(ref))visibleIds.add(ref)}}
 // Dormant endpoints remain reusable; never surface endpoints appearing exclusively in hidden views.
 if(allowed(a,'diagram.view.uml-usecase')){
  const placed=new Set(document.diagrams.flatMap(d=>d.nodes.map(n=>n.elementId)))
  // Provenance is computed from FULL stored views, not from the client projection.
  for(const [id,e] of Object.entries(document.elements))if(!placed.has(id)&&e.useCaseCatalog===true&&isUseCaseCatalogType(e.type))visibleIds.add(id)
  for(const r of Object.values(useCaseRegistry(document)))for(const id of [r.sourceElementId,r.targetElementId])if(!placed.has(id))visibleIds.add(id)
  // Subject applicability survives loss of the last visual boundary, too.
  for(const id of visibleIds){const e=document.elements[id];if(!e||!allowed(a,`element.view.${e.type}`))continue;for(const ref of [...e.useCaseDetail?.subjectIds||[],...(e.useCaseDetail?.classifierId?[e.useCaseDetail.classifierId]:[])])if(!placed.has(ref))visibleIds.add(ref)}
 }
 if(allowed(a,'diagram.view.uml-activity')){const placed=new Set(document.diagrams.flatMap(d=>d.nodes.map(n=>n.elementId)));for(const e of Object.values(document.elements))if(!placed.has(e.id)&&e.activityCatalogDiagramId&&(diagrams.some(d=>d.type==='uml-activity'&&d.id===e.activityCatalogDiagramId)||a.roleKey==='owner'&&!document.diagrams.some(d=>d.id===e.activityCatalogDiagramId)))visibleIds.add(e.id);for(const d of diagrams.filter(d=>d.type==='uml-activity')){for(const p of d.activity?.parameters||[])if(p.typeId&&!placed.has(p.typeId))visibleIds.add(p.typeId);for(const n of d.nodes){const e=document.elements[n.elementId];if(e&&allowed(a,`element.view.${e.type}`))for(const ref of activityReferences(e.activityDetail))if(!placed.has(ref))visibleIds.add(ref)}for(const edge of d.edges){if(!d.nodes.filter(n=>[edge.source,edge.target].includes(n.id)).every(n=>document.elements[n.elementId]&&allowed(a,`element.view.${document.elements[n.elementId].type}`)))continue;for(const ref of edge.activityEdge?.exceptionTypeIds||[])if(!placed.has(ref))visibleIds.add(ref)}}}
 // Only detached references of actually visible sequence nodes/edges may enter the catalog.
 if(allowed(a,'diagram.view.uml-sequence')){const placed=new Set(document.diagrams.flatMap(d=>d.nodes.map(n=>n.elementId)));for(const d of diagrams.filter(d=>d.type==='uml-sequence')){const refs=[d.interaction?.contextId,...(d.interaction?.parameters||[]).map(p=>p.typeId)];for(const n of d.nodes){const e=document.elements[n.elementId];if(e&&allowed(a,`element.view.${e.type}`))refs.push(...sequenceReferences(e.sequenceDetail,document))}for(const e of d.edges)if([e.source,e.target].every(id=>{const n=d.nodes.find(n=>n.id===id);return n&&document.elements[n.elementId]&&allowed(a,`element.view.${document.elements[n.elementId].type}`)}))refs.push(e.sequenceEdge?.signatureOwnerId,...(e.sequenceEdge?.arguments||[]).map(a=>a.typeId));for(const ref of refs)if(ref&&!placed.has(ref))visibleIds.add(ref)}}
 const elements:Record<string,ModelElement>={}
 for(const [id,e] of Object.entries(document.elements)){
  if(!visibleIds.has(id)||!allowed(a,`element.view.${e.type}`))continue
  const copy={...e}
  if(!allowed(a,'diagram.view.uml-usecase'))delete copy.useCaseCatalog
  if(!allowed(a,'diagram.view.uml-activity')||copy.activityCatalogDiagramId&&a.roleKey!=='owner'&&!diagrams.some(d=>d.type==='uml-activity'&&d.id===copy.activityCatalogDiagramId))delete copy.activityCatalogDiagramId
  if(!allowed(a,'element.technical.view')){delete copy.technical;delete copy.uml}
  if(e.childDiagramId&&!diagrams.some(d=>d.id===e.childDiagramId)){delete copy.childDiagramId;delete copy.childNodeId}
  else if(e.childNodeId&&!diagrams.find(d=>d.id===e.childDiagramId)?.nodes.some(n=>n.id===e.childNodeId&&!!document.elements[n.elementId]&&allowed(a,`element.view.${document.elements[n.elementId].type}`)))delete copy.childNodeId
  elements[id]=copy
 }
 // An ACL-projected document must not expose semantic reference IDs into hidden elements.
 for(const e of Object.values(elements)){
  if(e.semanticOwnerId&&!elements[e.semanticOwnerId])delete e.semanticOwnerId
  if(e.useCaseDetail){e.useCaseDetail=structuredClone(e.useCaseDetail);if(e.useCaseDetail.classifierId&&!elements[e.useCaseDetail.classifierId])delete e.useCaseDetail.classifierId;if(e.useCaseDetail.subjectIds)e.useCaseDetail.subjectIds=e.useCaseDetail.subjectIds.filter(id=>!!elements[id])}
  if(e.activityDetail){e.activityDetail=structuredClone(e.activityDetail);const a=e.activityDetail;for(const k of ['typeId','referenceId','ownerActionId','represents'] as const)if(a[k]&&!elements[a[k]!]){delete a[k];if(k==='referenceId')delete a.operationId}for(const k of ['partitionIds','regionIds'] as const)if(a[k])a[k]=a[k]!.filter(id=>!!elements[id]);if(a.callDiagramId&&!diagrams.some(d=>d.id===a.callDiagramId))delete a.callDiagramId;for(const k of ['decisionInputBehaviorId','selectionBehaviorId'] as const)if(a[k]&&!diagrams.some(d=>d.id===a[k]))delete a[k];if(a.operationId&&!elements[a.referenceId||'']?.uml?.operations?.some(op=>op.id===a.operationId))delete a.operationId;if(a.decisionInputFlowId&&!diagrams.some(d=>d.edges.some(edge=>edge.id===a.decisionInputFlowId&&d.nodes.some(n=>n.id===edge.source&&elements[n.elementId]))))delete a.decisionInputFlowId}
  if(e.uml){e.uml=structuredClone(e.uml);if(e.uml.deployment&&(!allowed(a,'diagram.view.uml-deployment')||deploymentDetailRefs(e.uml.deployment).some(id=>!elements[id])||document.elements[e.id]?.semanticOwnerId&&!elements[document.elements[e.id].semanticOwnerId!]))delete e.uml.deployment;if(e.uml.component&&(!allowed(a,'diagram.view.uml-component')||componentReferences(e.uml.component).some(id=>!elements[id])||document.elements[e.id]?.semanticOwnerId&&!elements[document.elements[e.id].semanticOwnerId!]))delete e.uml.component;for(const a of e.uml.attributes||[])if(a.typeId&&!elements[a.typeId])delete a.typeId;for(const o of e.uml.operations||[]){if(o.returnTypeId&&!elements[o.returnTypeId])delete o.returnTypeId;for(const p of o.parameters)if(p.typeId&&!elements[p.typeId])delete p.typeId}for(const p of e.uml.templateParameters||[])if(p.typeId&&!elements[p.typeId])delete p.typeId}
 }
 // A pin's argument ID refers to the called signature, not to its own element. Do not expose hidden parameter IDs.
 for(const e of Object.values(elements)){const a=e.activityDetail;if(!a?.argumentParameterId)continue;const owner=elements[a.ownerActionId||'']?.activityDetail;const visibleSignature=owner?.kind==='callBehavior'&&diagrams.some(d=>d.id===owner.callDiagramId)||owner?.kind==='callOperation'&&!!elements[owner.referenceId||'']?.uml?.operations?.some(op=>op.id===owner.operationId);if(!visibleSignature)delete a.argumentParameterId}
 // Redact the whole typed semantic layer if a sequence has inaccessible endpoints or references.
 // Never expose an occurrence ID or a derived signature label with a hidden owner.
 const incompleteSequence=new Set(diagrams.filter(d=>d.type==='uml-sequence'&&d.interaction&&(!allowed(a,'element.technical.view')||d.nodes.some(n=>!elements[n.elementId]||sequenceReferences(document.elements[n.elementId]?.sequenceDetail,document).some(id=>!elements[id])||[document.elements[n.elementId]?.sequenceDetail?.interactionId,document.elements[n.elementId]?.sequenceDetail?.decompositionId,document.elements[n.elementId]?.sequenceDetail?.executionBehaviorId].some(id=>id&&!diagrams.some(v=>v.id===id&&v.nodes.every(n=>!!elements[n.elementId]))))||[d.interaction.contextId,...(d.interaction.parameters||[]).map(p=>p.typeId)].some(id=>id&&!elements[id])||d.edges.some(e=>[e.sequenceEdge?.signatureOwnerId,...(e.sequenceEdge?.arguments||[]).map(a=>a.typeId)].some(id=>id&&!elements[id])))).map(d=>d.id))
 // Gate correspondence is also a semantic dependency across interactions. Propagate redaction
 // until no visible gate points to a missing or redacted counterpart.
 let changedSequenceScope=true
 while(changedSequenceScope){changedSequenceScope=false;for(const d of diagrams.filter(d=>d.type==='uml-sequence'&&d.interaction&&!incompleteSequence.has(d.id))){for(const n of d.nodes){const matches=sequenceGateMatchIds(document.elements[n.elementId]?.sequenceDetail);if(matches.some(match=>{const pair=sequenceGatePair(document,d,n.id,match);return !pair||!diagrams.some(v=>v.id===pair.diagram.id)||!elements[pair.node.elementId]||incompleteSequence.has(pair.diagram.id)})){incompleteSequence.add(d.id);changedSequenceScope=true;break}}}}
 for(const d of document.diagrams.filter(d=>d.type==='uml-sequence'))for(const n of d.nodes)if(elements[n.elementId]&&(!diagrams.some(v=>v.id===d.id)||incompleteSequence.has(d.id)))delete elements[n.elementId].sequenceDetail
 const cmpRegistry=allowed(a,'diagram.view.uml-component')&&allowed(a,'element.technical.view')?Object.fromEntries(Object.entries(componentRegistry(document)).filter(([,r])=>componentRelationRefs(r).every(id=>!!elements[id]))):{}
 let cmChanged=true;while(cmChanged){cmChanged=false;for(const [id,r] of Object.entries(cmpRegistry))if(componentRelationDependencies(r).some(ref=>!Object.hasOwn(cmpRegistry,ref))){delete cmpRegistry[id];cmChanged=true}}
 const depRegistry=allowed(a,'diagram.view.uml-deployment')&&allowed(a,'element.technical.view')?Object.fromEntries(Object.entries(deploymentRegistry(document)).filter(([,r])=>deploymentRefs(r).every(id=>!!elements[id]))):{}
 const redacted=diagrams.map(d=>{
  const nodes=d.nodes.filter(n=>!!elements[n.elementId]).map(n=>{
   if(n.childDiagramId===undefined)return n // vínculo heredado desde la ficha
   const dest=diagrams.find(item=>item.id===n.childDiagramId)
   if(!dest)return {...n,childDiagramId:null,childNodeId:null}
   if(n.childNodeId&&!dest.nodes.some(target=>target.id===n.childNodeId&&!!elements[target.elementId]))return {...n,childNodeId:null}
   return n
  }), ids=new Set(nodes.map(n=>n.id))
  const edges=d.edges.filter(e=>(!e.deploymentRelationId||Object.hasOwn(depRegistry,e.deploymentRelationId))&&(!e.componentRelationId||Object.hasOwn(cmpRegistry,e.componentRelationId))&&(!e.componentEnds||e.componentEnds.every(end=>ids.has(end.nodeId)))&&(!e.activityEdge?.selectionBehaviorId||diagrams.some(v=>v.id===e.activityEdge?.selectionBehaviorId))&&(!e.activityEdge?.transformationBehaviorId||diagrams.some(v=>v.id===e.activityEdge?.transformationBehaviorId))&&(!e.activityEdge?.interruptingRegionId||!!elements[e.activityEdge.interruptingRegionId])&&(!e.activityEdge?.exceptionTypeIds||e.activityEdge.exceptionTypeIds.every(id=>!!elements[id]))&&ids.has(e.source)&&ids.has(e.target)&&(!e.associationClassId||!!elements[e.associationClassId])&&(!e.associationEnds||e.associationEnds.every(end=>ids.has(end.nodeId)))&&(!e.templateBindings||e.templateBindings.every(b=>!!elements[b.elementId])))
  if(incompleteSequence.has(d.id)){const {interaction:_,...safe}=d;return {...safe,nodes,edges:edges.filter(e=>!e.sequenceEdge&&!e.annotationTargetEdgeId)}}
  return {...d,...(d.activity?{activity:{...d.activity,parameters:d.activity.parameters?.map(p=>p.typeId&&!elements[p.typeId]?{...p,typeId:undefined}:p)}}:{}),nodes,edges:edges.filter(e=>!e.annotationTargetEdgeId||edges.some(x=>x.id===e.annotationTargetEdgeId))}
 })
 const registry=allowed(a,'diagram.view.uml-usecase')?Object.fromEntries(Object.entries(useCaseRegistry(document)).filter(([,r])=>!!elements[r.sourceElementId]&&!!elements[r.targetElementId])):{}
 return structuredClone({schema:1,elements,diagrams:redacted,...(document.deploymentRelations!==undefined&&allowed(a,'diagram.view.uml-deployment')&&allowed(a,'element.technical.view')?{deploymentRelations:depRegistry}:{}),...(document.componentRelations!==undefined&&allowed(a,'diagram.view.uml-component')&&allowed(a,'element.technical.view')?{componentRelations:cmpRegistry}:{}),...(document.useCaseRelations!==undefined&&allowed(a,'diagram.view.uml-usecase')?{useCaseRelations:registry}:{}),fieldDefinitions:document.fieldDefinitions.filter(f=>allowed(a,'field.configure')||f.forType==='all'||Object.values(elements).some(e=>e.type===f.forType))})
}
function edgeKind(edge:DiagramEdge,diagram:Diagram,doc:ProjectDocument){
 const source=diagram.nodes.find(n=>n.id===edge.source),target=diagram.nodes.find(n=>n.id===edge.target)
 if(!source||!target||!doc.elements[source.elementId]||!doc.elements[target.elementId])throw new DomainError('Relación con nodos inexistentes',400)
 return relationScope(doc.elements[source.elementId].type,doc.elements[target.elementId].type)
}
export function ensureUniqueIds(doc:ProjectDocument){
 if(!validDeploymentRegistry(doc.deploymentRelations))throw new DomainError('Registro de despliegue inválido',400)
 if(!validComponentRegistry(doc.componentRelations))throw new DomainError('Registro de componentes inválido',400)
 const usedDiagrams=new Set<string>()
 for(const d of doc.diagrams){
  if(usedDiagrams.has(d.id))throw new DomainError('IDs de diagrama duplicados',400)
  usedDiagrams.add(d.id)
  if(!validSequenceRoot(d.interaction)||d.type!=='uml-sequence'&&d.interaction!==undefined)throw new DomainError('Interaction inválida',400)
  if(d.type==='uml-sequence'&&!d.interaction&&(d.edges.some(e=>e.sequenceEdge)||d.nodes.some(n=>doc.elements[n.elementId]?.sequenceDetail)))throw new DomainError('La semántica de secuencia requiere una Interaction',400)
  if(!validActivityRoot(d.activity)||d.type!=='uml-activity'&&d.activity!==undefined)throw new DomainError('Detalle de actividad inválido',400)
  const filters=d.filters||[]
  if(filters.length>100||new Set(filters.map(f=>f.id)).size!==filters.length||filters.some(f=>f.id.length<1||f.id.length>100||f.label.trim().length<1||f.label.length>80))throw new DomainError('Filtros de diagrama inválidos',400)
  const filterIds=new Set(filters.map(f=>f.id))
  const nodes=new Set<string>(),edges=new Set<string>()
  for(const n of d.nodes){
   if(nodes.has(n.id)||!doc.elements[n.elementId])throw new DomainError('Nodo duplicado o sin elemento',400)
   if(n.filterIds?.some(id=>!filterIds.has(id)))throw new DomainError('Nodo con filtro inexistente',400)
   if(n.width!==undefined&&!validNodeDimension(n.width)||n.height!==undefined&&!validNodeDimension(n.height))throw new DomainError('Dimensiones de caja inválidas',400)
   if(!umlElementAllowed(d.type,doc.elements[n.elementId].type))throw new DomainError('Elemento no permitido para este tipo de diagrama UML',400)
   if(d.type==='uml-package'&&doc.elements[n.elementId].type==='uml-subpackage'&&!n.parentNodeId)throw new DomainError('Un subpaquete debe estar contenido en un paquete o modelo UML',400)
   if(n.parentNodeId){
    if(!umlAncestryValid(d,n,doc.elements))throw new DomainError('Contención UML inválida: jerarquía o ciclo',400)
    const parent=d.nodes.find(p=>p.id===n.parentNodeId)!
    const parentKind=doc.elements[parent.elementId].type
    const size=novziNodeSize(d.type,doc.elements[parent.elementId],parent,umlNodeDepth(d,parent),d.nodes.some(x=>x.parentNodeId===parent.id))
    const port=['uml-port','uml-activity-pin'].includes(doc.elements[n.elementId].type)
    const destruction=d.type==='uml-sequence'&&doc.elements[n.elementId].type==='uml-destruction'
    // A destruction occurrence is centered on the endpoint and intentionally
    // straddles the lower edge of the participant or activation.
    const anchor=destruction?sequenceSnapChild(parentKind,'uml-destruction',size,novziNodeSize(d.type,doc.elements[n.elementId],n),n.y):undefined
    const anchored=!!anchor&&n.x===anchor.x&&n.y===anchor.y
    if(!anchored&&(n.x<(port?-100:0)||n.y<(port?-45:0)||n.x>size.width+(port?0:-20)||n.y>size.height+(port?0:-20)))throw new DomainError('Caja fuera de contenedor UML',400)
   }
   // Los enlaces por ocurrencia deben apuntar a una vista y caja existentes.
   if(n.childDiagramId!==undefined&&n.childDiagramId!==null&&(!doc.diagrams.some(target=>target.id===n.childDiagramId)||n.childDiagramId.length>150))throw new DomainError('Vista vinculada del nodo inexistente',400)
   if(n.childNodeId&&(!n.childDiagramId||!doc.diagrams.find(target=>target.id===n.childDiagramId)?.nodes.some(target=>target.id===n.childNodeId)))throw new DomainError('Caja vinculada del nodo inexistente',400)
   const element=doc.elements[n.elementId]
   if((n.width!==undefined||n.height!==undefined)&&d.nodes.some(child=>child.parentNodeId===n.id)&&element){
    const size=novziNodeSize(d.type,element,n,umlNodeDepth(d,n),true)
    for(const child of d.nodes.filter(child=>child.parentNodeId===n.id)){
     const childElement=doc.elements[child.elementId]
     if(!childElement||['uml-port','uml-activity-pin'].includes(childElement.type))continue
     const childSize=novziNodeSize(d.type,childElement,child,umlNodeDepth(d,child),d.nodes.some(x=>x.parentNodeId===child.id))
     if(d.type==='uml-sequence'&&childElement.type==='uml-destruction'){
      const anchor=sequenceSnapChild(element.type,childElement.type,size,childSize,child.y)
      if(child.x===anchor.x&&child.y===anchor.y)continue
     }
     if(child.x+childSize.width>size.width||child.y+childSize.height>size.height)
      throw new DomainError('El contenedor no puede cortar sus elementos internos',400)
    }
   }
   nodes.add(n.id)
  }
  for(const e of d.edges){
   if(e.deploymentRelationId!==undefined&&(typeof e.deploymentRelationId!=='string'||d.type!=='uml-deployment'))throw new DomainError('Proyección de despliegue inválida',400)
   if(!validComponentEdgeShape(e as unknown as Record<string,unknown>)||d.type!=='uml-component'&&(e.componentRelationId!==undefined||e.componentEnds!==undefined)||e.componentEnds?.some(end=>!nodes.has(end.nodeId)))throw new DomainError('Extremos de componente inválidos',400)
   if(!validSequenceEdgeDetail(e.sequenceEdge)||d.type!=='uml-sequence'&&e.sequenceEdge!==undefined)throw new DomainError('Mensaje de secuencia inválido',400)
   if(!validActivityEdgeDetail(e.activityEdge)||d.type!=='uml-activity'&&e.activityEdge!==undefined)throw new DomainError('Detalle de flujo inválido',400)
   if(edges.has(e.id)||!nodes.has(e.source)||!nodes.has(e.target)||e.source===e.target&&!(d.type==='uml-class'&&classSelfAllowed(e.relationKind)||d.type==='uml-activity'&&['control-flow','object-flow'].includes(e.relationKind||'')||d.type==='uml-sequence'&&!!e.sequenceEdge||d.type==='uml-deployment'&&['communication-path','composition'].includes(e.relationKind||'')&&!!e.deploymentRelationId))throw new DomainError('Relación duplicada o inválida',400)
   if(e.direction&&!['forward','reverse','both','none'].includes(e.direction))throw new DomainError('Dirección de relación inválida',400)
   if(e.lineStyle&&!['solid','dashed','dotted'].includes(e.lineStyle))throw new DomainError('Trazo de relación inválido',400)
   if(e.pathStyle&&!['smoothstep','straight','step','bezier'].includes(e.pathStyle))throw new DomainError('Tipo de recorrido de relación inválido',400)
   const legacyHandles=['left','right','top-1','top-2','top-3','bottom-1','bottom-2','bottom-3']
   const sequenceActivationAt=(nodeId:string)=>d.type==='uml-sequence'&&doc.elements[d.nodes.find(n=>n.id===nodeId)?.elementId||'']?.type==='uml-activation'
   const validHandle=(nodeId:string,handle:string|undefined)=>!handle||legacyHandles.includes(handle)||
    (sequenceActivationAt(nodeId)&&sequenceActivationHandleValid(handle))
   if(!validHandle(e.source,e.sourceHandle))throw new DomainError('Puerto de salida inválido',400)
   if(!validHandle(e.target,e.targetHandle))throw new DomainError('Puerto de entrada inválido',400)
   if(e.relationKind&&d.type!=='uml-class'&&!umlRelationAllowed(d.type,e.relationKind))throw new DomainError('Relación no permitida para este diagrama UML',400)
   if(['sourceMultiplicity','targetMultiplicity','sourceRole','targetRole'].some(k=>{const v=e[k as keyof DiagramEdge];return v!==undefined&&(typeof v!=='string'||v.length>80)}))throw new DomainError('Extremos UML inválidos',400)
   edges.add(e.id)
  }
 }
 for(const e of Object.values(doc.elements)){
  if(!validSequenceDetail(e.sequenceDetail)||!validActivityDetail(e.activityDetail)||!validUmlDetail(e.uml))throw new DomainError('Atributos, métodos o valores UML inválidos',400)
  if(e.childDiagramId&&!usedDiagrams.has(e.childDiagramId))throw new DomainError('Vista vinculada inexistente',400)
  if(e.childNodeId&&(!e.childDiagramId||!doc.diagrams.find(d=>d.id===e.childDiagramId)?.nodes.some(n=>n.id===e.childNodeId)))throw new DomainError('Caja vinculada inexistente',400)
 }
}
export function applyAuthorizedChange(original:ProjectDocument,incoming:ProjectDocument,a:Access):ProjectDocument{
 // Compare only the authorized projection, merge mutations back into the FULL document.
 // A client cannot delete, change or replace material it was not permitted to receive.
 const rawOriginal=original;original=repairStoredUseCaseAnnotations(adaptUseCaseDocument(original))
 // Require identity on new PUT edges. Existing legacy edges receive the same deterministic identity on both sides.
 for(const d of incoming.diagrams.filter(d=>d.type==='uml-usecase'))for(const e of d.edges){if(e.relationKind==='annotation')continue;if(!e.semanticRelationId){const old=rawOriginal.diagrams.find(x=>x.id===d.id)?.edges.find(x=>x.id===e.id);if(!old||old.semanticRelationId)throw new DomainError('Identidad semántica requerida',400)}}
 if(!validDeploymentRegistry(incoming.deploymentRelations))throw new DomainError('Registro de despliegue inválido',400)
 if(!validComponentRegistry(incoming.componentRelations))throw new DomainError('Registro de componentes inválido',400)
 const providedRegistry=incoming.useCaseRelations!==undefined
 if(!validUseCaseRegistry(incoming.useCaseRelations))throw new DomainError('Registro semántico inválido',400)
 incoming=adaptUseCaseDocument(incoming)
 // An older client may submit an untouched legacy annotation. Normalize only that exact stored record.
 if(rawOriginal!==original){
  incoming={...incoming,diagrams:incoming.diagrams.map(d=>{
   if(d.type!=='uml-usecase')return d
   const raw=rawOriginal.diagrams.find(x=>x.id===d.id),fixed=original.diagrams.find(x=>x.id===d.id)
   return {...d,edges:d.edges.map(e=>{const old=raw?.edges.find(x=>x.id===e.id),canonical=fixed?.edges.find(x=>x.id===e.id);return old?.annotationTargetEdgeId&&canonical&&equal(old,e)&&!equal(old,canonical)?canonical:e})}
  })}
 }
 const visible=projectVisible(original,a)
 const originalVisibleDiagrams=new Map(visible.diagrams.map(d=>[d.id,d]))
 const storedDiagrams=new Map(original.diagrams.map(d=>[d.id,d]))
 const submittedDiagrams=new Map(incoming.diagrams.map(d=>[d.id,d]))
 let full:ProjectDocument=structuredClone(original)
 if(incoming.schema!==1)throw new DomainError('Versión de documento no soportada',400)
 if(!equal(visible.fieldDefinitions,incoming.fieldDefinitions)){
  requirePermission(a,'field.configure')
  const subset=new Set(visible.fieldDefinitions.map(f=>f.id))
  const already=new Set(original.fieldDefinitions.map(f=>f.id))
  for(const f of incoming.fieldDefinitions){if(already.has(f.id)&&!subset.has(f.id))fail('No puedes modificar campos ocultos')}
  full.fieldDefinitions=[...original.fieldDefinitions.filter(f=>!subset.has(f.id)),...incoming.fieldDefinitions]
 }
 for(const [id,created] of Object.entries(incoming.elements)){
  const stored=original.elements[id],before=visible.elements[id]
  if(stored&&!before)fail('Intento de modificar un elemento oculto')
  if(created.useCaseCatalog!==undefined&&(created.useCaseCatalog!==true||!isUseCaseCatalogType(created.type)))throw new DomainError('Procedencia de catálogo inválida',400)
  if(created.activityCatalogDiagramId!==undefined&&(!ACTIVITY_TYPES.includes(created.type as typeof ACTIVITY_TYPES[number])||typeof created.activityCatalogDiagramId!=='string'||!created.activityCatalogDiagramId||created.activityCatalogDiagramId.length>256))throw new DomainError('Procedencia de actividad inválida',400)
  if(!stored){
   if(created.activityCatalogDiagramId&&a.roleKey!=='owner')fail('No puedes asignar procedencia de actividad')
   if(created.useCaseCatalog){requirePermission(a,'diagram.view.uml-usecase');requirePermission(a,'diagram.layout.uml-usecase')}
   requirePermission(a,`element.create.${created.type}`)
   requirePermission(a,`element.view.${created.type}`)
   if((created.technical||created.uml||created.sequenceDetail)&&!allowed(a,'element.technical.edit'))fail('No puedes crear detalles técnicos UML')
   full.elements[id]=created;continue
  }
  if(created.type!==stored.type){
   requirePermission(a,`element.edit.${stored.type}`)
   requirePermission(a,`element.create.${created.type}`)
   requirePermission(a,`element.view.${created.type}`)
  }
  // The client cannot grant catalog visibility on an existing element. The server derives it below.
  const {useCaseCatalog:_,activityCatalogDiagramId:__,...rest}=created
  const proposed={...rest,...(before.useCaseCatalog?{useCaseCatalog:true as const}:{}),...(before.activityCatalogDiagramId?{activityCatalogDiagramId:before.activityCatalogDiagramId}:{})}
  if(!equal(before,proposed)){
   requirePermission(a,`element.edit.${stored.type}`)
   // A granular link must never become a pointer into an inaccessible diagram or node.
   if((created.childDiagramId!==stored.childDiagramId||created.childNodeId!==stored.childNodeId)&&created.childDiagramId){
    const target=incoming.diagrams.find(d=>d.id===created.childDiagramId)||original.diagrams.find(d=>d.id===created.childDiagramId)
    if(target){
     requirePermission(a,`diagram.view.${target.type}`)
     if(created.childNodeId){
      const node=target.nodes.find(n=>n.id===created.childNodeId),element=node&&(incoming.elements[node.elementId]||original.elements[node.elementId])
      if(element)requirePermission(a,`element.view.${element.type}`)
     }
    }
   }
   if(created.technical!==undefined&&created.technical!==stored.technical)requirePermission(a,'element.technical.edit')
   if(!equal(created.uml,before.uml)&&allowed(a,'element.technical.view')){requirePermission(a,'element.technical.edit');if(!equal(before.uml,stored.uml))fail('No puedes modificar detalles UML con referencias ocultas')}
   if(!equal(before.sequenceDetail,created.sequenceDetail)){requirePermission(a,'element.technical.edit');if(!equal(before.sequenceDetail,stored.sequenceDetail))fail('No puedes modificar detalle de secuencia oculto')}
   if(!equal(before.activityDetail,created.activityDetail)&&!equal(before.activityDetail,stored.activityDetail))fail('No puedes modificar detalles de actividad con referencias ocultas')
   if(!equal(before.useCaseDetail,created.useCaseDetail)&&!equal(before.useCaseDetail,stored.useCaseDetail))fail('No puedes modificar detalles funcionales con referencias ocultas')
   full.elements[id]={...stored,...proposed,
     ...(equal(before.sequenceDetail,created.sequenceDetail)&&!equal(before.sequenceDetail,stored.sequenceDetail)?{sequenceDetail:stored.sequenceDetail}:{}),
     ...(equal(before.activityDetail,created.activityDetail)&&!equal(before.activityDetail,stored.activityDetail)?{activityDetail:stored.activityDetail}:{}),
     ...(equal(before.useCaseDetail,created.useCaseDetail)&&!equal(before.useCaseDetail,stored.useCaseDetail)?{useCaseDetail:stored.useCaseDetail}:{}),
     ...(stored.semanticOwnerId&&!before.semanticOwnerId?{semanticOwnerId:stored.semanticOwnerId}:{}),
     ...(!allowed(a,'element.technical.edit')||equal(before.uml,created.uml)&&!equal(before.uml,stored.uml)?{technical:stored.technical,uml:stored.uml}:{}),
     ...(!allowed(a,`diagram.view.${storedDiagrams.get(stored.childDiagramId||'')?.type}`)?{childDiagramId:stored.childDiagramId,childNodeId:stored.childNodeId}:{}),
   }
  }
 }
 // The client cannot change a stored node's Activity provenance.
 for(const [id,e] of Object.entries(full.elements))if(original.elements[id]){const former=original.elements[id].activityCatalogDiagramId;if(former)full.elements[id]={...e,activityCatalogDiagramId:former};else if(e.activityCatalogDiagramId!==undefined){const copy={...e};delete copy.activityCatalogDiagramId;full.elements[id]=copy}}
 for(const [id,before] of Object.entries(visible.elements)){
  if(id in incoming.elements)continue
  requirePermission(a,`element.delete.${before.type}`)
  if(isUseCaseCatalogType(before.type)&&allowed(a,'diagram.view.uml-usecase')&&useCaseElementIsReferenced(original,id))throw new DomainError('No puedes eliminar un elemento con referencias en el modelo',409)
  if(before.activityCatalogDiagramId&&(activityCatalogReferenced(original,id)||useCaseElementIsReferenced(original,id)))throw new DomainError('No puedes eliminar un elemento de actividad con referencias',409)
  if(original.diagrams.some(d=>d.nodes.some(n=>n.elementId===id)))throw new DomainError('No puedes eliminar un elemento utilizado en una vista',409)
  delete full.elements[id]
 }
 for(const d of incoming.diagrams){
  const old=originalVisibleDiagrams.get(d.id)
  if(!old){
   if(storedDiagrams.has(d.id))fail('Intento de modificar vista oculta')
   requirePermission(a,`diagram.create.${d.type}`)
   requirePermission(a,`diagram.view.${d.type}`)
   // New diagram edges must be explicitly authorized too.
   for(const n of d.nodes){const e=full.elements[n.elementId];if(!e)throw new DomainError('Elemento no encontrado',400);if(['uml-usecase','uml-activity','uml-sequence','uml-deployment'].includes(d.type)&&original.elements[n.elementId]&&!visible.elements[n.elementId])fail('Referencia UML oculta');requirePermission(a,`element.view.${e.type}`)}
   for(const edge of d.edges){if(d.type==='uml-usecase'&&edge.annotationTargetEdgeId&&!d.edges.some(x=>x.id===edge.annotationTargetEdgeId))throw new DomainError('Relación anotada no disponible',400);requirePermission(a,`relation.create.${edgeKind(edge,d,full)}`);if(isUmlDiagram(d.type)&&!validUmlEdgeNotation(d.type,edge))throw new DomainError('La relación UML no coincide con su dirección o trazo normativo',400)}
   full.diagrams.push(d);continue
  }
  const stored=storedDiagrams.get(d.id)!
  if(d.type!==stored.type){requirePermission(a,`diagram.edit.${stored.type}`);requirePermission(a,`diagram.create.${d.type}`);requirePermission(a,`diagram.view.${d.type}`)}
  if(d.name!==stored.name||d.description!==stored.description||d.type!==stored.type||!equal(d.filters||[],stored.filters||[])||!equal(d.activity,old.activity)||!equal(d.interaction,old.interaction))requirePermission(a,`diagram.edit.${stored.type}`)
  if(stored.type==='uml-sequence'&&stored.interaction&&!old.interaction&&!equal(old,d))fail('No puedes modificar una interacción con contenido oculto')
  if(stored.interaction&&old.interaction&&!d.interaction)throw new DomainError('No se puede eliminar el modelo de ocurrencias',400)
  if(d.interaction&&old.interaction&&!equal(old.interaction,d.interaction)){const before=new Map(old.interaction.occurrences.map(o=>[o.id,o])),after=new Map(d.interaction.occurrences.map(o=>[o.id,o]));for(const e of old.edges){const x=e.sequenceEdge;if(x&&d.edges.some(v=>v.id===e.id)&&[x.sendId,x.receiveId,x.beforeId,x.afterId].some(id=>id&&!equal(before.get(id),after.get(id))))requirePermission(a,`relation.edit.${edgeKind(e,stored,full)}`)}}
  const previousNodes=new Map(old.nodes.map(x=>[x.id,x])),nextNodes=new Map(d.nodes.map(x=>[x.id,x]))
  if(!equal(old.nodes,d.nodes)){
   requirePermission(a,`diagram.layout.${stored.type}`)
   for(const n of d.nodes){
    const el=full.elements[n.elementId]
    if(!el)throw new DomainError('Elemento no encontrado',400)
    if(['uml-usecase','uml-activity','uml-sequence','uml-deployment'].includes(d.type)&&original.elements[n.elementId]&&!visible.elements[n.elementId])fail('Referencia UML oculta')
    requirePermission(a,`element.view.${el.type}`)
    const oldNode=previousNodes.get(n.id)
    if(oldNode&&(oldNode.childDiagramId!==n.childDiagramId||oldNode.childNodeId!==n.childNodeId)){
     requirePermission(a,`element.edit.${el.type}`)
     if(n.childDiagramId){const target=incoming.diagrams.find(v=>v.id===n.childDiagramId)||original.diagrams.find(v=>v.id===n.childDiagramId);if(target){requirePermission(a,`diagram.view.${target.type}`);if(n.childNodeId){const child=target.nodes.find(x=>x.id===n.childNodeId);if(child){const referenced=full.elements[child.elementId];if(referenced)requirePermission(a,`element.view.${referenced.type}`)}}}}
    }
    if(oldNode&&!equal(oldNode.elementId,n.elementId)){const historicalActor=stored.type==='uml-sequence'&&!stored.interaction&&!!d.interaction&&original.elements[oldNode.elementId]?.type==='actor'&&el.type==='uml-lifeline'&&!original.elements[n.elementId]&&el.sequenceDetail?.classifierId===oldNode.elementId&&equal(original.elements[oldNode.elementId],full.elements[oldNode.elementId]);if(!historicalActor)fail('No se permite reemplazar la identidad de un nodo');requirePermission(a,'element.view.actor')}
   }
   // Removing a node implicitly removes edges, check all removed relations below.
  }
  const originalEdges=new Map(old.edges.map(x=>[x.id,x])),nextEdges=new Map(d.edges.map(x=>[x.id,x]))
  for(const e of d.edges){
   if(!nextNodes.has(e.source)||!nextNodes.has(e.target))throw new DomainError('Relación sin sus nodos',400)
   const oldE=originalEdges.get(e.id)
   if(d.type==='uml-usecase'&&e.annotationTargetEdgeId&&!d.edges.some(x=>x.id===e.annotationTargetEdgeId))throw new DomainError('Relación anotada no disponible',400)
   if(d.type==='uml-deployment'&&oldE?.deploymentRelationId&&oldE.deploymentRelationId!==e.deploymentRelationId)throw new DomainError('Identidad de despliegue inmutable',400)
   if(d.type==='uml-usecase'&&oldE?.semanticRelationId&&oldE.semanticRelationId!==e.semanticRelationId)fail('No se puede reemplazar la identidad semántica de una relación')
   if(!oldE){requirePermission(a,`relation.create.${edgeKind(e,d,full)}`);if(isUmlDiagram(d.type)&&!validUmlEdgeNotation(d.type,e))throw new DomainError('La relación UML no coincide con su dirección o trazo normativo',400)
    if(isUmlDiagram(d.type)&&d.type!=='uml-activity'&&!(d.type==='uml-sequence'&&e.sequenceEdge)&&e.relationKind){
     const s=d.nodes.find(n=>n.id===e.source),t=d.nodes.find(n=>n.id===e.target)
     if(s&&t&&!umlRelationEndpointValid(d.type,e.relationKind,full.elements[s.elementId].type,full.elements[t.elementId].type))throw new DomainError('Extremos incompatibles con la relación UML',400)
    }}
   else if(!equal(oldE,e)){
    // A note attached to the same visible relation may change its auxiliary anchor,
    // not its semantic target or source. The shared deployment policy below validates
    // the new anchor against the actual endpoints; edit permissions still apply.
    // UX-REL: reattachment retains the edge ID but NEVER bypasses the ACL.
    // Both old and new scopes require edit rights (below); new endpoint nodes
    // must be explicitly visible to this caller. Shared UML registries are
    // validated independently after the full document is merged.
    if(oldE.source!==e.source||oldE.target!==e.target){
     for(const id of [oldE.source,oldE.target,e.source,e.target]){
      const node=old.nodes.find(n=>n.id===id)||d.nodes.find(n=>n.id===id)
      if(!node||!visible.elements[node.elementId])fail('No se puede reconectar una caja oculta')
      const element=full.elements[node!.elementId]
      if(!element)fail('El extremo de la relación no existe')
      requirePermission(a,`element.view.${element!.type}`)
     }
     if(e.source===e.target&&!(d.type==='uml-class'&&classSelfAllowed(e.relationKind)))fail('Autoconexión no permitida')
    }
    requirePermission(a,`relation.edit.${edgeKind(oldE,old,original)}`)
    requirePermission(a,`relation.edit.${edgeKind(e,d,full)}`)
    if(d.type==='uml-deployment'&&oldE.deploymentRelationId&&(oldE.source!==e.source||oldE.target!==e.target)){
     const isPathFlip=oldE.relationKind==='communication-path'&&e.relationKind==='communication-path'&&e.source===oldE.target&&e.target===oldE.source
     if(!isPathFlip)throw new DomainError('Para cambiar extremos, elimina y recrea la relación',403)
    }
    if(isUmlDiagram(d.type)&&!validUmlEdgeNotation(d.type,e))throw new DomainError('La relación UML no coincide con su dirección o trazo normativo',400)
    if(isUmlDiagram(d.type)&&d.type!=='uml-activity'&&!(d.type==='uml-sequence'&&e.sequenceEdge)&&e.relationKind){
     const src=d.nodes.find(n=>n.id===e.source),dst=d.nodes.find(n=>n.id===e.target)
     if(src&&dst&&!umlRelationEndpointValid(d.type,e.relationKind,full.elements[src.elementId].type,full.elements[dst.elementId].type))
      throw new DomainError('Extremos incompatibles con la relación UML',400)
    }
   }
  }
  for(const e of old.edges)if(!nextEdges.has(e.id))requirePermission(a,`relation.delete.${edgeKind(e,old,original)}`)
  // preserve hidden nodes/edges (if element visibility does not allow displaying them)
  const hiddenNodes=stored.nodes.filter(n=>!previousNodes.has(n.id)),hiddenIds=new Set(hiddenNodes.map(n=>n.id))
  const hiddenEdges=stored.edges.filter(e=>!originalEdges.has(e.id))
  for(const n of d.nodes)if(hiddenIds.has(n.id))fail('ID de nodo reservado')
  const combinedNodes=[...d.nodes,...hiddenNodes]
  const combinedEdges=[...d.edges,...hiddenEdges]
  if(!equal(old.activity,d.activity)&&!equal(old.activity,stored.activity))fail('No puedes modificar parámetros con referencias ocultas')
  const merged={...stored,...d,...(equal(old.activity,d.activity)&&!equal(old.activity,stored.activity)?{activity:stored.activity}:{}),...(stored.interaction&&!old.interaction?{interaction:stored.interaction}:{}),nodes:combinedNodes,edges:combinedEdges}
  const ix=full.diagrams.findIndex(x=>x.id===d.id);full.diagrams[ix]=merged
 }
 for(const d of visible.diagrams){
  if(submittedDiagrams.has(d.id))continue
  requirePermission(a,`diagram.delete.${d.type}`)
  if(d.type==='uml-usecase'){const stored=storedDiagrams.get(d.id)!;if(stored.nodes.length!==d.nodes.length||stored.edges.length!==d.edges.length)fail('No puedes eliminar una vista con referencias ocultas');for(const edge of d.edges)requirePermission(a,`relation.delete.${edgeKind(edge,d,original)}`)}
  // A hidden element could link into this diagram; do not auto-delete it.
  if(Object.values(original.elements).some(e=>e.childDiagramId===d.id))throw new DomainError('El diagrama está vinculado desde otro elemento',409)
  full.diagrams=full.diagrams.filter(x=>x.id!==d.id)
 }
 // Only the complete, authorized result can establish a detached catalog record.
 full=retainActivityCatalog(original,retainUseCaseCatalog(original,full))
 // Deleting nodes cannot silently delete an edge from the hidden slice.
 ensureUniqueIds(full)
 // An explicit unlink is a semantic change, not merely removal of a visual occurrence.
 // Check against the unprojected document, with a generic error that does not disclose hidden views.
 for(const d of original.diagrams.filter(x=>x.type==='uml-class'))for(const e of d.edges){
  if(!e.associationClassId)continue
  const updated=full.diagrams.find(x=>x.id===d.id)?.edges.find(x=>x.id===e.id)
  if(updated&&updated.associationClassId!==e.associationClassId&&full.diagrams.some(x=>x.type==='uml-class'&&x.edges.some(y=>y.associationClassId===e.associationClassId)))throw new DomainError('No se puede modificar la asociación en todas sus apariciones',400)
 }
 // Merge registry through ACL, preserving records that the client could not see.
 const oldRegistry=useCaseRegistry(original),visibleRegistry=useCaseRegistry(visible),submittedRegistry=useCaseRegistry(incoming)
 const registry=new Map(Object.entries(oldRegistry))
 const authorizeRecord=(r:typeof oldRegistry[string],action:'create'|'edit'|'delete')=>{
  requirePermission(a,'diagram.view.uml-usecase');const src=full.elements[r.sourceElementId]||original.elements[r.sourceElementId],dst=full.elements[r.targetElementId]||original.elements[r.targetElementId]
  if(!src||!dst)throw new DomainError('Referencia semántica inválida',400)
  for(const el of [src,dst]){requirePermission(a,`element.view.${el.type}`);if(!visible.elements[el.id]&&!incoming.elements[el.id])fail('Referencia UML oculta')}
  requirePermission(a,`relation.${action}.${relationScope(src.type,dst.type)}`)
 }
 for(const [id,r] of Object.entries(submittedRegistry)){
  const old=Object.hasOwn(oldRegistry,id)?oldRegistry[id]:undefined
  if(old&&!Object.hasOwn(visibleRegistry,id))fail('No se puede acceder a la relación compartida')
  if(!old||!equal(old,r)){
   if(old){authorizeRecord(old,'edit');authorizeRecord(r,'edit');if(old.sourceElementId!==r.sourceElementId||old.targetElementId!==r.targetElementId){
      // Every occurrence must be submitted; do not silently diverge a shared relation.
      for(const view of original.diagrams.filter(v=>v.type==='uml-usecase'&&v.edges.some(e=>e.semanticRelationId===id))){
       const submitted=incoming.diagrams.find(v=>v.id===view.id)
       if(!submitted||!view.edges.filter(e=>e.semanticRelationId===id).every(e=>submitted.edges.some(x=>x.id===e.id&&x.semanticRelationId===id)))fail('Reconexion de relación compartida con apariciones no visibles')
      }
     }}
   else authorizeRecord(r,'create')
   registry.set(id,r)
  }
 }
 if(providedRegistry)for(const [id,r] of Object.entries(visibleRegistry))if(!Object.hasOwn(submittedRegistry,id)){
  authorizeRecord(r,'delete')
  if(full.diagrams.some(d=>d.type==='uml-usecase'&&d.edges.some(e=>e.semanticRelationId===id)))fail('No se puede eliminar la relación en todas sus apariciones')
  registry.delete(id)
 }
 // A removed node/diagram must not destroy registered meaning. A hidden occurrence also blocks divergent changes.
 if(registry.size||original.useCaseRelations!==undefined||providedRegistry)full.useCaseRelations=Object.fromEntries(registry)
 for(const d of incoming.diagrams.filter(d=>d.type==='uml-usecase'))for(const e of d.edges)if(e.semanticRelationId&&Object.hasOwn(oldRegistry,e.semanticRelationId)&&!Object.hasOwn(visibleRegistry,e.semanticRelationId))fail('No se puede acceder a la relación compartida')
 for(const d of full.diagrams.filter(d=>d.type==='uml-sequence'&&d.interaction)){const old=original.diagrams.find(v=>v.id===d.id);for(const e of d.edges)if(e.relationKind!=='annotation'&&!e.sequenceEdge&&!old?.edges.some(x=>equal(x,e)))throw new DomainError('Los mensajes nuevos requieren ocurrencias',400);const visibleD=incoming.diagrams.find(v=>v.id===d.id);if(visibleD?.interaction&&!equal(old?.interaction,d.interaction)){for(const ref of [d.interaction?.contextId,...(d.interaction?.parameters||[]).map(p=>p.typeId)])if(ref&&!incoming.elements[ref])fail('Referencia de Interaction oculta')}for(const e of d.edges)if(!equal(old?.edges.find(x=>x.id===e.id)?.sequenceEdge,e.sequenceEdge))for(const ref of [e.sequenceEdge?.signatureOwnerId,...(e.sequenceEdge?.arguments||[]).map(a=>a.typeId)])if(ref&&!incoming.elements[ref])fail('Firma de mensaje oculta')}
 for(const d of full.diagrams.filter(d=>d.type==='uml-sequence'&&d.interaction))for(const n of d.nodes){const detail=full.elements[n.elementId]?.sequenceDetail;if(equal(original.elements[n.elementId]?.sequenceDetail,detail))continue;for(const match of sequenceGateMatchIds(detail)){const pair=sequenceGatePair(full,d,n.id,match);if(pair&&(!incoming.diagrams.some(v=>v.id===pair.diagram.id&&v.interaction&&v.nodes.some(n=>n.id===pair.node.id))||!incoming.elements[pair.node.elementId]?.sequenceDetail))fail('Correspondencia de gate oculta')}}
 for(const e of Object.values(full.elements))if(!equal(original.elements[e.id]?.sequenceDetail,e.sequenceDetail)){for(const ref of sequenceReferences(e.sequenceDetail,full))if(!incoming.elements[ref])fail('Referencia de secuencia oculta');for(const id of [e.sequenceDetail?.interactionId,e.sequenceDetail?.decompositionId,e.sequenceDetail?.executionBehaviorId])if(id&&!incoming.diagrams.some(d=>d.id===id))fail('Interacción referenciada oculta')}
 const oldCmp=componentRegistry(original),visibleCmp=componentRegistry(visible),submittedCmp=componentRegistry(incoming),mergedCmp={...oldCmp}
 const authorizeCmp=(r:typeof oldCmp[string],action:'create'|'edit'|'delete')=>{requirePermission(a,'diagram.view.uml-component');requirePermission(a,'element.technical.edit');for(const id of componentRelationRefs(r)){const el=full.elements[id]||original.elements[id];if(!el)throw new DomainError('Referencia de componente inexistente',400);requirePermission(a,`element.view.${el.type}`);if(!visible.elements[id]&&!incoming.elements[id])fail('Referencia de componente oculta')}const src=(full.elements[r.sourceElementId]||original.elements[r.sourceElementId])!,dst=(full.elements[r.targetElementId]||original.elements[r.targetElementId])!;requirePermission(a,`relation.${action}.${relationScope(src.type,dst.type)}`);for(const d of original.diagrams.filter(d=>d.edges.some(e=>e.componentRelationId===r.id)))if(!visible.diagrams.some(v=>v.id===d.id&&d.edges.filter(e=>e.componentRelationId===r.id).every(e=>v.edges.some(x=>x.id===e.id))))fail('Relación de componentes con apariciones ocultas')}
 for(const [id,r] of Object.entries(submittedCmp)){const old=oldCmp[id];if(old&&!Object.hasOwn(visibleCmp,id))fail('Relación de componentes oculta');if(!equal(old,r)){if(old)authorizeCmp(old,'edit');authorizeCmp(r,old?'edit':'create');for(const dep of componentRelationDependencies(r))if(oldCmp[dep]&&!visibleCmp[dep]||!oldCmp[dep]&&!submittedCmp[dep])fail('Contrato de cableado no visible');mergedCmp[id]=r}}
 if(incoming.componentRelations!==undefined)for(const [id,r] of Object.entries(visibleCmp))if(!Object.hasOwn(submittedCmp,id)){authorizeCmp(r,'delete');if(full.diagrams.some(d=>d.edges.some(e=>e.componentRelationId===id)))fail('Elimina primero las apariciones de la relación');delete mergedCmp[id]}
 if(original.componentRelations!==undefined||incoming.componentRelations!==undefined)full.componentRelations=mergedCmp
 for(const d of incoming.diagrams)for(const e of d.edges)if(e.componentRelationId&&oldCmp[e.componentRelationId]&&!visibleCmp[e.componentRelationId])fail('Relación de componentes oculta')
 const oldDep=deploymentRegistry(original),visibleDep=deploymentRegistry(visible),submittedDep=deploymentRegistry(incoming),mergedDep={...oldDep}
 const authorizeDep=(r:typeof oldDep[string],action:'create'|'edit'|'delete')=>{requirePermission(a,'diagram.view.uml-deployment');requirePermission(a,'element.technical.edit');for(const id of deploymentRefs(r)){const el=full.elements[id]||original.elements[id];if(!el)throw new DomainError('Referencia de despliegue inexistente',400);requirePermission(a,`element.view.${el.type}`);if(!visible.elements[id]&&!incoming.elements[id])fail('Referencia de despliegue oculta')}requirePermission(a,`relation.${action}.technical`);for(const d of original.diagrams.filter(d=>d.edges.some(e=>e.deploymentRelationId===r.id)))if(!visible.diagrams.some(v=>v.id===d.id&&d.edges.filter(e=>e.deploymentRelationId===r.id).every(e=>v.edges.some(x=>x.id===e.id))))fail('Registro de despliegue con apariciones ocultas')}
 for(const [id,r] of Object.entries(submittedDep)){const old=oldDep[id];if(old&&!visibleDep[id])fail('Registro de despliegue oculto');if(!equal(old,r)){if(old)authorizeDep(old,'edit');authorizeDep(r,old?'edit':'create');mergedDep[id]=r}}
 if(incoming.deploymentRelations!==undefined)for(const [id,r] of Object.entries(visibleDep))if(!Object.hasOwn(submittedDep,id)){authorizeDep(r,'delete');if(full.diagrams.some(d=>d.edges.some(e=>e.deploymentRelationId===id)))throw new DomainError('Quita primero las apariciones de despliegue',400);delete mergedDep[id]}
 if(original.deploymentRelations!==undefined||incoming.deploymentRelations!==undefined)full.deploymentRelations=mergedDep
 for(const d of incoming.diagrams)for(const e of d.edges)if(e.deploymentRelationId&&oldDep[e.deploymentRelationId]&&!visibleDep[e.deploymentRelationId])fail('Registro de despliegue oculto')
 const issues=[...newDeploymentIssues(original,full),...newClassIssues(original,full),...newUseCaseIssues(original,full),...newActivityIssues(original,full),...newSequenceIssues(original,full),...newComponentIssues(original,full)]
 if(issues.length)throw new DomainError(issues[0].message,400)
 // References crossing ACL boundaries cannot be introduced from a partial projection.
 const requireReference=(id:string|undefined)=>{if(!id)return;const target=full.elements[id];if(!target)throw new DomainError('Referencia UML inválida',400);requirePermission(a,`element.view.${target.type}`);if(!visible.elements[id]&&!incoming.elements[id])fail('Referencia UML oculta')}
 for(const e of Object.values(full.elements)){
  const old=original.elements[e.id];if(!equal(old?.activityDetail,e.activityDetail)){for(const ref of activityReferences(e.activityDetail))requireReference(ref);if(e.activityDetail?.argumentParameterId){const caller=incoming.elements[e.activityDetail.ownerActionId||'']?.activityDetail;if(!caller||caller.kind==='callBehavior'&&!incoming.diagrams.some(d=>d.id===caller.callDiagramId)||caller.kind==='callOperation'&&!incoming.elements[caller.referenceId||'']?.uml?.operations?.some(op=>op.id===caller.operationId))fail('Firma de llamada no visible')}for(const behavior of [e.activityDetail?.decisionInputBehaviorId,e.activityDetail?.selectionBehaviorId])if(behavior&&!incoming.diagrams.some(d=>d.id===behavior&&d.type==='uml-activity'))fail('Comportamiento no visible');if(e.activityDetail?.callDiagramId){const dest=full.diagrams.find(d=>d.id===e.activityDetail?.callDiagramId);if(!dest||!incoming.diagrams.some(d=>d.id===dest.id))fail('Referencia de actividad oculta');requirePermission(a,`diagram.view.${dest!.type}`)}}if(!equal(old?.useCaseDetail,e.useCaseDetail)){requireReference(e.useCaseDetail?.classifierId);for(const id of e.useCaseDetail?.subjectIds||[])requireReference(id)}if(old?.semanticOwnerId!==e.semanticOwnerId){requirePermission(a,old?`element.edit.${e.type}`:`element.create.${e.type}`);requirePermission(a,'element.technical.edit');requireReference(e.semanticOwnerId)}
  if(!equal(old?.uml,e.uml)){if(!equal(old?.uml?.deployment,e.uml?.deployment)){requirePermission(a,'diagram.view.uml-deployment');requirePermission(a,'element.technical.edit');for(const ref of deploymentDetailRefs(e.uml?.deployment))requireReference(ref)}if(!equal(old?.uml?.component,e.uml?.component)){requirePermission(a,'diagram.view.uml-component');requirePermission(a,'element.technical.edit');for(const ref of componentReferences(e.uml?.component))requireReference(ref)}for(const member of e.uml?.attributes||[])requireReference(member.typeId);for(const op of e.uml?.operations||[]){requireReference(op.returnTypeId);for(const param of op.parameters)requireReference(param.typeId)};for(const param of e.uml?.templateParameters||[])requireReference(param.typeId)}
 }
 for(const d of full.diagrams){if(d.type==='uml-activity'){const old=original.diagrams.find(x=>x.id===d.id);if(!equal(old?.activity,d.activity))for(const p of d.activity?.parameters||[])requireReference(p.typeId);for(const e of d.edges){const before=old?.edges.find(x=>x.id===e.id);if(!equal(before?.activityEdge,e.activityEdge)){for(const behavior of [e.activityEdge?.selectionBehaviorId,e.activityEdge?.transformationBehaviorId])if(behavior&&!incoming.diagrams.some(d=>d.id===behavior&&d.type==='uml-activity'))fail('Comportamiento no visible');requireReference(e.activityEdge?.interruptingRegionId);for(const id of e.activityEdge?.exceptionTypeIds||[])requireReference(id)}}}}
 for(const d of full.diagrams)for(const e of d.edges){const old=original.diagrams.find(x=>x.id===d.id)?.edges.find(x=>x.id===e.id);if(!equal(old,e)&&umlRelationNameLocked(d.type,e.relationKind||'')&&e.label&&e.label!==old?.label)throw new DomainError('El nombre de la relación UML es reservado',400);if(!equal(old,e)){for(const binding of e.templateBindings||[])requireReference(binding.elementId);requireReference(e.associationClassId);if(d.type==='uml-class'&&e.associationClassId!==old?.associationClassId){for(const id of [old?.associationClassId,e.associationClassId])if(id){requireReference(id);requirePermission(a,'element.edit.uml-association-class');requirePermission(a,'element.technical.edit')}}for(const end of e.associationEnds||[]){const el=d.nodes.find(n=>n.id===end.nodeId)?.elementId;requireReference(el);const source=d.nodes.find(n=>n.id===e.source)?.elementId;if(el&&source&&full.elements[el]&&full.elements[source])requirePermission(a,`relation.${old?'edit':'create'}.${relationScope(full.elements[source].type,full.elements[el].type)}`)}}}
 return full
}
