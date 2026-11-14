import {isDeepStrictEqual} from 'node:util'
import type {Diagram,DiagramNode,DiagramEdge,ModelElement,ProjectDocument,FieldDefinition} from '@atlas/contracts'
import {isUmlDiagram,validUmlEdgeNotation,umlAncestryValid,atlasNodeSize,validNodeDimension,umlNodeDepth,umlRelationEndpointValid} from '@atlas/contracts'
import {relationScope,umlElementAllowed,umlRelationAllowed,validUmlDetail} from '@atlas/contracts'
import type {Access} from '../../../security/roles'
import {allowed,requirePermission} from '../../../security/roles'
import {DomainError} from '../../../domain/errors'
const equal=(a:unknown,b:unknown)=>isDeepStrictEqual(a,b)
const fail=(message:string):never=>{throw new DomainError(message,403)}
const isObj=(o:unknown):o is Record<string,unknown>=>!!o&&typeof o==='object'&&!Array.isArray(o)
export function projectVisible(document:ProjectDocument,a:Access):ProjectDocument{
 const diagrams=document.diagrams.filter(d=>allowed(a,`diagram.view.${d.type}`))
 const visibleIds=new Set(diagrams.flatMap(d=>d.nodes.map(n=>n.elementId)))
 const elements:Record<string,ModelElement>={}
 for(const [id,e] of Object.entries(document.elements)){
  if(!visibleIds.has(id)||!allowed(a,`element.view.${e.type}`))continue
  const copy={...e}
  if(!allowed(a,'element.technical.view')){delete copy.technical;delete copy.uml}
  if(e.childDiagramId&&!diagrams.some(d=>d.id===e.childDiagramId)){delete copy.childDiagramId;delete copy.childNodeId}
  else if(e.childNodeId&&!diagrams.find(d=>d.id===e.childDiagramId)?.nodes.some(n=>n.id===e.childNodeId&&!!document.elements[n.elementId]&&allowed(a,`element.view.${document.elements[n.elementId].type}`)))delete copy.childNodeId
  elements[id]=copy
 }
 const redacted=diagrams.map(d=>{
  const nodes=d.nodes.filter(n=>!!elements[n.elementId]), ids=new Set(nodes.map(n=>n.id))
  return {...d,nodes,edges:d.edges.filter(e=>ids.has(e.source)&&ids.has(e.target))}
 })
 return structuredClone({schema:1,elements,diagrams:redacted,fieldDefinitions:document.fieldDefinitions.filter(f=>allowed(a,'field.configure')||f.forType==='all'||Object.values(elements).some(e=>e.type===f.forType))})
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
   if(n.parentNodeId){
    if(!umlAncestryValid(d,n,doc.elements))throw new DomainError('Contención UML inválida: jerarquía o ciclo',400)
    const parent=d.nodes.find(p=>p.id===n.parentNodeId)!
    const parentKind=doc.elements[parent.elementId].type
    const size=atlasNodeSize(d.type,doc.elements[parent.elementId],parent,umlNodeDepth(d,parent),d.nodes.some(x=>x.parentNodeId===parent.id))
    const port=doc.elements[n.elementId].type==='uml-port'
    if(n.x<(port?-100:0)||n.y<(port?-45:0)||n.x>size.width+(port?0:-20)||n.y>size.height+(port?0:-20))throw new DomainError('Caja fuera de contenedor UML',400)
   }
   const element=doc.elements[n.elementId]
   if((n.width!==undefined||n.height!==undefined)&&d.nodes.some(child=>child.parentNodeId===n.id)&&element){
    const size=atlasNodeSize(d.type,element,n,umlNodeDepth(d,n),true)
    for(const child of d.nodes.filter(child=>child.parentNodeId===n.id)){
     const childElement=doc.elements[child.elementId]
     if(!childElement||childElement.type==='uml-port')continue
     const childSize=atlasNodeSize(d.type,childElement,child,umlNodeDepth(d,child),d.nodes.some(x=>x.parentNodeId===child.id))
     if(child.x+childSize.width>size.width||child.y+childSize.height>size.height)
      throw new DomainError('El contenedor no puede cortar sus elementos internos',400)
    }
   }
   nodes.add(n.id)
  }
  for(const e of d.edges){
   if(edges.has(e.id)||!nodes.has(e.source)||!nodes.has(e.target)||e.source===e.target)throw new DomainError('Relación duplicada o inválida',400)
   if(e.direction&&!['forward','reverse','both','none'].includes(e.direction))throw new DomainError('Dirección de relación inválida',400)
   if(e.lineStyle&&!['solid','dashed','dotted'].includes(e.lineStyle))throw new DomainError('Trazo de relación inválido',400)
   if(e.pathStyle&&!['smoothstep','straight','step','bezier'].includes(e.pathStyle))throw new DomainError('Tipo de recorrido de relación inválido',400)
   if(e.sourceHandle&&!['left','right','top-1','top-2','top-3','bottom-1','bottom-2','bottom-3'].includes(e.sourceHandle))throw new DomainError('Puerto de salida inválido',400)
   if(e.targetHandle&&!['left','right','top-1','top-2','top-3','bottom-1','bottom-2','bottom-3'].includes(e.targetHandle))throw new DomainError('Puerto de entrada inválido',400)
   if(e.relationKind&&!umlRelationAllowed(d.type,e.relationKind))throw new DomainError('Relación no permitida para este diagrama UML',400)
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
 const visible=projectVisible(original,a)
 const originalVisibleDiagrams=new Map(visible.diagrams.map(d=>[d.id,d]))
 const storedDiagrams=new Map(original.diagrams.map(d=>[d.id,d]))
 const submittedDiagrams=new Map(incoming.diagrams.map(d=>[d.id,d]))
 const full:ProjectDocument=structuredClone(original)
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
  if(!stored){
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
  if(!equal(before,created)){
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
   if(!equal(created.uml,stored.uml)&&allowed(a,'element.technical.view'))requirePermission(a,'element.technical.edit')
   full.elements[id]={...stored,...created,
     ...(!allowed(a,'element.technical.edit')?{technical:stored.technical,uml:stored.uml}:{}),
     ...(!allowed(a,`diagram.view.${storedDiagrams.get(stored.childDiagramId||'')?.type}`)?{childDiagramId:stored.childDiagramId,childNodeId:stored.childNodeId}:{}),
   }
  }
 }
 for(const [id,before] of Object.entries(visible.elements)){
  if(id in incoming.elements)continue
  requirePermission(a,`element.delete.${before.type}`)
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
   for(const n of d.nodes){const e=full.elements[n.elementId];if(!e)throw new DomainError('Elemento no encontrado',400);requirePermission(a,`element.view.${e.type}`)}
   for(const edge of d.edges){requirePermission(a,`relation.create.${edgeKind(edge,d,full)}`);if(isUmlDiagram(d.type)&&!validUmlEdgeNotation(d.type,edge))throw new DomainError('La relación UML no coincide con su dirección o trazo normativo',400)}
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
   if(!oldE){requirePermission(a,`relation.create.${edgeKind(e,d,full)}`);if(isUmlDiagram(d.type)&&!validUmlEdgeNotation(d.type,e))throw new DomainError('La relación UML no coincide con su dirección o trazo normativo',400)
    if(isUmlDiagram(d.type)&&e.relationKind){
     const s=d.nodes.find(n=>n.id===e.source),t=d.nodes.find(n=>n.id===e.target)
     if(s&&t&&!umlRelationEndpointValid(d.type,e.relationKind,full.elements[s.elementId].type,full.elements[t.elementId].type))throw new DomainError('Extremos incompatibles con la relación UML',400)
    }}
   else if(!equal(oldE,e)){
    if(oldE.source!==e.source||oldE.target!==e.target)fail('Para cambiar extremos, elimina y recrea la relación')
    requirePermission(a,`relation.edit.${edgeKind(oldE,old,original)}`)
    if(isUmlDiagram(d.type)&&!validUmlEdgeNotation(d.type,e))throw new DomainError('La relación UML no coincide con su dirección o trazo normativo',400)
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
  // A hidden element could link into this diagram; do not auto-delete it.
  if(Object.values(original.elements).some(e=>e.childDiagramId===d.id))throw new DomainError('El diagrama está vinculado desde otro elemento',409)
  full.diagrams=full.diagrams.filter(x=>x.id!==d.id)
 }
 // Deleting nodes cannot silently delete an edge from the hidden slice.
 ensureUniqueIds(full)
 return full
}
