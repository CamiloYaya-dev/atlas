import {newUseCaseIssues,adaptUseCaseDocument,useCaseRegistry,validUseCaseRegistry,repairStoredUseCaseAnnotations,retainUseCaseCatalog,isUseCaseCatalogType,useCaseElementIsReferenced} from '@atlas/contracts'
import {newClassIssues,classSelfAllowed,umlRelationNameLocked} from '@atlas/contracts'
import {isDeepStrictEqual} from 'node:util'
import type {Diagram,DiagramNode,DiagramEdge,ModelElement,ProjectDocument,FieldDefinition} from '@atlas/contracts'
import {sequenceSnapChild,sequenceActivationHandleValid,isUmlDiagram,validUmlEdgeNotation,umlAncestryValid,atlasNodeSize,validNodeDimension,umlNodeDepth,umlRelationEndpointValid} from '@atlas/contracts'
import {relationScope,umlElementAllowed,umlRelationAllowed,validUmlDetail} from '@atlas/contracts'
import type {Access} from '../../../security/roles'
import {allowed,requirePermission} from '../../../security/roles'
import {DomainError} from '../../../domain/errors'
const equal=(a:unknown,b:unknown)=>isDeepStrictEqual(a,b)
const fail=(message:string):never=>{throw new DomainError(message,403)}
const isObj=(o:unknown):o is Record<string,unknown>=>!!o&&typeof o==='object'&&!Array.isArray(o)
export function projectVisible(document:ProjectDocument,a:Access):ProjectDocument{
 document=repairStoredUseCaseAnnotations(adaptUseCaseDocument(document))
 const diagrams=document.diagrams.filter(d=>allowed(a,`diagram.view.${d.type}`))
 const visibleIds=new Set(diagrams.flatMap(d=>d.nodes.map(n=>n.elementId)))
 // Dormant endpoints remain reusable; never surface endpoints appearing exclusively in hidden views.
 if(allowed(a,'diagram.view.uml-usecase')){
  const placed=new Set(document.diagrams.flatMap(d=>d.nodes.map(n=>n.elementId)))
  // Provenance is computed from FULL stored views, not from the client projection.
  for(const [id,e] of Object.entries(document.elements))if(!placed.has(id)&&e.useCaseCatalog===true&&isUseCaseCatalogType(e.type))visibleIds.add(id)
  for(const r of Object.values(useCaseRegistry(document)))for(const id of [r.sourceElementId,r.targetElementId])if(!placed.has(id))visibleIds.add(id)
  // Subject applicability survives loss of the last visual boundary, too.
  for(const id of visibleIds){const e=document.elements[id];if(!e||!allowed(a,`element.view.${e.type}`))continue;for(const ref of [...e.useCaseDetail?.subjectIds||[],...(e.useCaseDetail?.classifierId?[e.useCaseDetail.classifierId]:[])])if(!placed.has(ref))visibleIds.add(ref)}
 }
 const elements:Record<string,ModelElement>={}
 for(const [id,e] of Object.entries(document.elements)){
  if(!visibleIds.has(id)||!allowed(a,`element.view.${e.type}`))continue
  const copy={...e}
  if(!allowed(a,'diagram.view.uml-usecase'))delete copy.useCaseCatalog
  if(!allowed(a,'element.technical.view')){delete copy.technical;delete copy.uml}
  if(e.childDiagramId&&!diagrams.some(d=>d.id===e.childDiagramId)){delete copy.childDiagramId;delete copy.childNodeId}
  else if(e.childNodeId&&!diagrams.find(d=>d.id===e.childDiagramId)?.nodes.some(n=>n.id===e.childNodeId&&!!document.elements[n.elementId]&&allowed(a,`element.view.${document.elements[n.elementId].type}`)))delete copy.childNodeId
  elements[id]=copy
 }
 // An ACL-projected document must not expose semantic reference IDs into hidden elements.
 for(const e of Object.values(elements)){
  if(e.semanticOwnerId&&!elements[e.semanticOwnerId])delete e.semanticOwnerId
  if(e.useCaseDetail){e.useCaseDetail=structuredClone(e.useCaseDetail);if(e.useCaseDetail.classifierId&&!elements[e.useCaseDetail.classifierId])delete e.useCaseDetail.classifierId;if(e.useCaseDetail.subjectIds)e.useCaseDetail.subjectIds=e.useCaseDetail.subjectIds.filter(id=>!!elements[id])}
  if(e.uml){e.uml=structuredClone(e.uml);for(const a of e.uml.attributes||[])if(a.typeId&&!elements[a.typeId])delete a.typeId;for(const o of e.uml.operations||[]){if(o.returnTypeId&&!elements[o.returnTypeId])delete o.returnTypeId;for(const p of o.parameters)if(p.typeId&&!elements[p.typeId])delete p.typeId}for(const p of e.uml.templateParameters||[])if(p.typeId&&!elements[p.typeId])delete p.typeId}
 }
 const redacted=diagrams.map(d=>{
  const nodes=d.nodes.filter(n=>!!elements[n.elementId]), ids=new Set(nodes.map(n=>n.id))
  const edges=d.edges.filter(e=>ids.has(e.source)&&ids.has(e.target)&&(!e.associationClassId||!!elements[e.associationClassId])&&(!e.associationEnds||e.associationEnds.every(end=>ids.has(end.nodeId)))&&(!e.templateBindings||e.templateBindings.every(b=>!!elements[b.elementId])))
  return {...d,nodes,edges:edges.filter(e=>!e.annotationTargetEdgeId||edges.some(x=>x.id===e.annotationTargetEdgeId))}
 })
 const registry=allowed(a,'diagram.view.uml-usecase')?Object.fromEntries(Object.entries(useCaseRegistry(document)).filter(([,r])=>!!elements[r.sourceElementId]&&!!elements[r.targetElementId])):{}
 return structuredClone({schema:1,elements,diagrams:redacted,...(document.useCaseRelations!==undefined&&allowed(a,'diagram.view.uml-usecase')?{useCaseRelations:registry}:{}),fieldDefinitions:document.fieldDefinitions.filter(f=>allowed(a,'field.configure')||f.forType==='all'||Object.values(elements).some(e=>e.type===f.forType))})
}
function edgeKind(edge:DiagramEdge,diagram:Diagram,doc:ProjectDocument){
 const source=diagram.nodes.find(n=>n.id===edge.source),target=diagram.nodes.find(n=>n.id===edge.target)
 if(!source||!target||!doc.elements[source.elementId]||!doc.elements[target.elementId])throw new DomainError('Relación con nodos inexistentes',400)
 return relationScope(doc.elements[source.elementId].type,doc.elements[target.elementId].type)
}
export function ensureUniqueIds(doc:ProjectDocument){
 const usedDiagrams=new Set<string>()
 for(const d of doc.diagrams){
  if(usedDiagrams.has(d.id))throw new DomainError('IDs de diagrama duplicados',400)
  usedDiagrams.add(d.id)
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
    const size=atlasNodeSize(d.type,doc.elements[parent.elementId],parent,umlNodeDepth(d,parent),d.nodes.some(x=>x.parentNodeId===parent.id))
    const port=doc.elements[n.elementId].type==='uml-port'
    const destruction=d.type==='uml-sequence'&&doc.elements[n.elementId].type==='uml-destruction'
    // A destruction occurrence is centered on the endpoint and intentionally
    // straddles the lower edge of the participant or activation.
    const anchor=destruction?sequenceSnapChild(parentKind,'uml-destruction',size,atlasNodeSize(d.type,doc.elements[n.elementId],n),n.y):undefined
    const anchored=!!anchor&&n.x===anchor.x&&n.y===anchor.y
    if(!anchored&&(n.x<(port?-100:0)||n.y<(port?-45:0)||n.x>size.width+(port?0:-20)||n.y>size.height+(port?0:-20)))throw new DomainError('Caja fuera de contenedor UML',400)
   }
   const element=doc.elements[n.elementId]
   if((n.width!==undefined||n.height!==undefined)&&d.nodes.some(child=>child.parentNodeId===n.id)&&element){
    const size=atlasNodeSize(d.type,element,n,umlNodeDepth(d,n),true)
    for(const child of d.nodes.filter(child=>child.parentNodeId===n.id)){
     const childElement=doc.elements[child.elementId]
     if(!childElement||childElement.type==='uml-port')continue
     const childSize=atlasNodeSize(d.type,childElement,child,umlNodeDepth(d,child),d.nodes.some(x=>x.parentNodeId===child.id))
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
   if(edges.has(e.id)||!nodes.has(e.source)||!nodes.has(e.target)||e.source===e.target&&!(d.type==='uml-class'&&classSelfAllowed(e.relationKind)))throw new DomainError('Relación duplicada o inválida',400)
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
  if(!validUmlDetail(e.uml))throw new DomainError('Atributos, métodos o valores UML inválidos',400)
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
  if(!stored){
   if(created.useCaseCatalog){requirePermission(a,'diagram.view.uml-usecase');requirePermission(a,'diagram.layout.uml-usecase')}
   requirePermission(a,`element.create.${created.type}`)
   requirePermission(a,`element.view.${created.type}`)
   if((created.technical||created.uml)&&!allowed(a,'element.technical.edit'))fail('No puedes crear detalles técnicos UML')
   full.elements[id]=created;continue
  }
  if(created.type!==stored.type){
   requirePermission(a,`element.edit.${stored.type}`)
   requirePermission(a,`element.create.${created.type}`)
   requirePermission(a,`element.view.${created.type}`)
  }
  // The client cannot grant catalog visibility on an existing element. The server derives it below.
  const {useCaseCatalog:_,...rest}=created
  const proposed=before.useCaseCatalog?{...rest,useCaseCatalog:true as const}:rest
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
   if(!equal(before.useCaseDetail,created.useCaseDetail)&&!equal(before.useCaseDetail,stored.useCaseDetail))fail('No puedes modificar detalles funcionales con referencias ocultas')
   full.elements[id]={...stored,...proposed,
     ...(equal(before.useCaseDetail,created.useCaseDetail)&&!equal(before.useCaseDetail,stored.useCaseDetail)?{useCaseDetail:stored.useCaseDetail}:{}),
     ...(stored.semanticOwnerId&&!before.semanticOwnerId?{semanticOwnerId:stored.semanticOwnerId}:{}),
     ...(!allowed(a,'element.technical.edit')||equal(before.uml,created.uml)&&!equal(before.uml,stored.uml)?{technical:stored.technical,uml:stored.uml}:{}),
     ...(!allowed(a,`diagram.view.${storedDiagrams.get(stored.childDiagramId||'')?.type}`)?{childDiagramId:stored.childDiagramId,childNodeId:stored.childNodeId}:{}),
   }
  }
 }
 for(const [id,before] of Object.entries(visible.elements)){
  if(id in incoming.elements)continue
  requirePermission(a,`element.delete.${before.type}`)
  if(isUseCaseCatalogType(before.type)&&allowed(a,'diagram.view.uml-usecase')&&useCaseElementIsReferenced(original,id))throw new DomainError('No puedes eliminar un elemento con referencias en el modelo',409)
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
   for(const n of d.nodes){const e=full.elements[n.elementId];if(!e)throw new DomainError('Elemento no encontrado',400);if(d.type==='uml-usecase'&&original.elements[n.elementId]&&!visible.elements[n.elementId])fail('Referencia UML oculta');requirePermission(a,`element.view.${e.type}`)}
   for(const edge of d.edges){if(d.type==='uml-usecase'&&edge.annotationTargetEdgeId&&!d.edges.some(x=>x.id===edge.annotationTargetEdgeId))throw new DomainError('Relación anotada no disponible',400);requirePermission(a,`relation.create.${edgeKind(edge,d,full)}`);if(isUmlDiagram(d.type)&&!validUmlEdgeNotation(d.type,edge))throw new DomainError('La relación UML no coincide con su dirección o trazo normativo',400)}
   full.diagrams.push(d);continue
  }
  const stored=storedDiagrams.get(d.id)!
  if(d.type!==stored.type){requirePermission(a,`diagram.edit.${stored.type}`);requirePermission(a,`diagram.create.${d.type}`);requirePermission(a,`diagram.view.${d.type}`)}
  if(d.name!==stored.name||d.description!==stored.description||d.type!==stored.type||!equal(d.filters||[],stored.filters||[]))requirePermission(a,`diagram.edit.${stored.type}`)
  const previousNodes=new Map(old.nodes.map(x=>[x.id,x])),nextNodes=new Map(d.nodes.map(x=>[x.id,x]))
  if(!equal(old.nodes,d.nodes)){
   requirePermission(a,`diagram.layout.${stored.type}`)
   for(const n of d.nodes){
    const el=full.elements[n.elementId]
    if(!el)throw new DomainError('Elemento no encontrado',400)
    if(d.type==='uml-usecase'&&original.elements[n.elementId]&&!visible.elements[n.elementId])fail('Referencia UML oculta')
    requirePermission(a,`element.view.${el.type}`)
    const oldNode=previousNodes.get(n.id)
    if(oldNode&&!equal(oldNode.elementId,n.elementId))fail('No se permite reemplazar la identidad de un nodo')
   }
   // Removing a node implicitly removes edges, check all removed relations below.
  }
  const originalEdges=new Map(old.edges.map(x=>[x.id,x])),nextEdges=new Map(d.edges.map(x=>[x.id,x]))
  for(const e of d.edges){
   if(!nextNodes.has(e.source)||!nextNodes.has(e.target))throw new DomainError('Relación sin sus nodos',400)
   const oldE=originalEdges.get(e.id)
   if(d.type==='uml-usecase'&&e.annotationTargetEdgeId&&!d.edges.some(x=>x.id===e.annotationTargetEdgeId))throw new DomainError('Relación anotada no disponible',400)
   if(d.type==='uml-usecase'&&oldE?.semanticRelationId&&oldE.semanticRelationId!==e.semanticRelationId)fail('No se puede reemplazar la identidad semántica de una relación')
   if(!oldE){requirePermission(a,`relation.create.${edgeKind(e,d,full)}`);if(isUmlDiagram(d.type)&&!validUmlEdgeNotation(d.type,e))throw new DomainError('La relación UML no coincide con su dirección o trazo normativo',400)
    if(isUmlDiagram(d.type)&&e.relationKind){
     const s=d.nodes.find(n=>n.id===e.source),t=d.nodes.find(n=>n.id===e.target)
     if(s&&t&&!umlRelationEndpointValid(d.type,e.relationKind,full.elements[s.elementId].type,full.elements[t.elementId].type))throw new DomainError('Extremos incompatibles con la relación UML',400)
    }}
   else if(!equal(oldE,e)){
    if((oldE.source!==e.source||oldE.target!==e.target)&&!(['uml-class','uml-usecase'].includes(d.type)&&(oldE.source===e.target&&oldE.target===e.source||oldE.source===e.source&&oldE.relationKind==='annotation'&&(d.type==='uml-usecase'&&e.relationKind==='annotation'||e.annotationTargetEdgeId&&d.edges.some(target=>target.id===e.annotationTargetEdgeId&&target.source===e.target)))))fail('Para cambiar extremos, elimina y recrea la relación')
    requirePermission(a,`relation.edit.${edgeKind(oldE,old,original)}`)
    requirePermission(a,`relation.edit.${edgeKind(e,d,full)}`)
    if(isUmlDiagram(d.type)&&!validUmlEdgeNotation(d.type,e))throw new DomainError('La relación UML no coincide con su dirección o trazo normativo',400)
    if(isUmlDiagram(d.type)&&e.relationKind){
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
  const merged={...stored,...d,nodes:combinedNodes,edges:combinedEdges}
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
 full=retainUseCaseCatalog(original,full)
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
   if(old){authorizeRecord(old,'edit');authorizeRecord(r,'edit');if(old.sourceElementId!==r.sourceElementId||old.targetElementId!==r.targetElementId)fail('No se pueden cambiar extremos semánticos de una relación')}
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
 const issues=[...newClassIssues(original,full),...newUseCaseIssues(original,full)]
 if(issues.length)throw new DomainError(issues[0].message,400)
 // References crossing ACL boundaries cannot be introduced from a partial projection.
 const requireReference=(id:string|undefined)=>{if(!id)return;const target=full.elements[id];if(!target)throw new DomainError('Referencia UML inválida',400);requirePermission(a,`element.view.${target.type}`);if(!visible.elements[id]&&!incoming.elements[id])fail('Referencia UML oculta')}
 for(const e of Object.values(full.elements)){
  const old=original.elements[e.id];if(!equal(old?.useCaseDetail,e.useCaseDetail)){requireReference(e.useCaseDetail?.classifierId);for(const id of e.useCaseDetail?.subjectIds||[])requireReference(id)}if(old?.semanticOwnerId!==e.semanticOwnerId){requirePermission(a,old?`element.edit.${e.type}`:`element.create.${e.type}`);requirePermission(a,'element.technical.edit');requireReference(e.semanticOwnerId)}
  if(!equal(old?.uml,e.uml)){for(const member of e.uml?.attributes||[])requireReference(member.typeId);for(const op of e.uml?.operations||[]){requireReference(op.returnTypeId);for(const param of op.parameters)requireReference(param.typeId)};for(const param of e.uml?.templateParameters||[])requireReference(param.typeId)}
 }
 for(const d of full.diagrams)for(const e of d.edges){const old=original.diagrams.find(x=>x.id===d.id)?.edges.find(x=>x.id===e.id);if(!equal(old,e)&&umlRelationNameLocked(d.type,e.relationKind||'')&&e.label&&e.label!==old?.label)throw new DomainError('El nombre de la relación UML es reservado',400);if(!equal(old,e)){for(const binding of e.templateBindings||[])requireReference(binding.elementId);requireReference(e.associationClassId);if(d.type==='uml-class'&&e.associationClassId!==old?.associationClassId){for(const id of [old?.associationClassId,e.associationClassId])if(id){requireReference(id);requirePermission(a,'element.edit.uml-association-class');requirePermission(a,'element.technical.edit')}}for(const end of e.associationEnds||[]){const el=d.nodes.find(n=>n.id===end.nodeId)?.elementId;requireReference(el);const source=d.nodes.find(n=>n.id===e.source)?.elementId;if(el&&source&&full.elements[el]&&full.elements[source])requirePermission(a,`relation.${old?'edit':'create'}.${relationScope(full.elements[source].type,full.elements[el].type)}`)}}}
 return full
}
