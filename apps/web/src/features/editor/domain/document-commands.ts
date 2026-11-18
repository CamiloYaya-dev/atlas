import {setDeploymentRelation,newDeploymentIssues,deploymentRegistry} from '@novzi/contracts'
import {setComponentRelation,newComponentIssues,componentPortSnap,componentPortResize,componentClassifier,componentRole} from '@novzi/contracts'
import {newSequenceIssues,pruneSequenceOccurrences,sequenceDefaults,SEQUENCE_TYPES,sequenceBox,sequenceLifeline,validSequenceRoot} from '@novzi/contracts'
import {activityDefaults,newActivityIssues,activitySnapPin,retainActivityCatalog,activityCatalogReferenced} from '@novzi/contracts'
import {adaptUseCaseDocument,canonicalSubjectId,diagramCreationEnabled,newUseCaseIssues,replaceUseCaseRelation,repairStoredUseCaseAnnotations,isUseCaseCatalogType,useCaseElementIsReferenced,retainUseCaseCatalog} from '@novzi/contracts'
import {classSelfAllowed,newClassIssues,replaceClassRelationAcrossViews,umlRelationEndpointValid,isUmlDiagram} from '@novzi/contracts'
/** Pure model operations used by the editor. Backend policy remains the authority. */
import type {Diagram,DiagramEdge,DiagramType,FieldDefinition,ModelElement,ProjectDocument} from '@novzi/contracts'
import {umlElementCreatable,umlElementReusable,umlContainerAllows,umlAbsolutePosition,umlAncestryValid,umlNodeDepth,umlSnapPort,novziNodeSize,novziNodeMinimum,validNodeDimension,sequenceSnapChild,sequenceIsAttachment,sequencePositionLocked} from '@novzi/contracts'

function validatedActivityRemoval(before:ProjectDocument,after:ProjectDocument,diagramId:string){
 if(before.diagrams.find(d=>d.id===diagramId)?.type==='uml-sequence')return pruneSequenceOccurrences(before,after,diagramId);
 if(before.diagrams.find(d=>d.id===diagramId)?.type==='uml-deployment'){const issue=newDeploymentIssues(before,after)[0];if(issue)throw Error(issue.message);return after}
 if(before.diagrams.find(d=>d.id===diagramId)?.type==='uml-component'){const issue=newComponentIssues(before,after)[0];if(issue)throw Error(issue.message);return after}
 if(before.diagrams.find(d=>d.id===diagramId)?.type!=='uml-activity')return after;
 const next=retainActivityCatalog(before,after),issues=newActivityIssues(before,next);if(issues.length)throw new Error('Desvincula primero las referencias de actividad: '+issues[0].message);return next
}
function withDiagram(doc:ProjectDocument,id:string,mutate:(d:Diagram)=>Diagram):ProjectDocument{
 if(!doc.diagrams.some(d=>d.id===id))throw new Error('Diagrama no encontrado')
 return {...doc,diagrams:doc.diagrams.map(d=>d.id===id?mutate(d):d)}
}
export function createDiagram(doc:ProjectDocument,data:{id:string;name:string;type:DiagramType;date:string}):ProjectDocument{
 if(!diagramCreationEnabled(data.type))throw new Error('Creación temporalmente deshabilitada')
 if(data.name.trim().length<2)throw new Error('Nombre de diagrama inválido')
 if(doc.diagrams.some(d=>d.id===data.id))throw new Error('ID de diagrama duplicado')
 return {...doc,diagrams:[...doc.diagrams,{id:data.id,name:data.name.trim(),type:data.type,description:'',createdAt:data.date,nodes:[],edges:[],...(data.type==='uml-sequence'?{interaction:{id:data.id,occurrences:[],showFrame:true}}:{})}]}
}
export function editDiagram(doc:ProjectDocument,id:string,changes:Partial<Diagram>):ProjectDocument{
 return withDiagram(doc,id,d=>{if(changes.type&&changes.type!==d.type&&!diagramCreationEnabled(changes.type))throw new Error('Creación temporalmente deshabilitada');return {...d,...changes,id:d.id}})
}
export function deleteDiagram(doc:ProjectDocument,id:string):ProjectDocument{
 doc=repairStoredUseCaseAnnotations(adaptUseCaseDocument(doc))
 if(!doc.diagrams.some(d=>d.id===id))throw new Error('Diagrama no encontrado')
 return validatedActivityRemoval(doc,retainUseCaseCatalog(doc,{...doc,diagrams:doc.diagrams.filter(d=>d.id!==id),elements:Object.fromEntries(Object.entries(doc.elements).map(([key,e])=>[key,e.childDiagramId===id?{...e,childDiagramId:undefined,childNodeId:undefined}:e]))}),id)
}
export function addElementNode(doc:ProjectDocument,diagramId:string,element:ModelElement,node:{id:string;x:number;y:number}):ProjectDocument{
 if(doc.diagrams.find(d=>d.id===diagramId)?.interaction){if(!umlElementCreatable('uml-sequence',element.type))throw Error('Tipo no permitido en secuencia');element={...element,sequenceDetail:element.sequenceDetail??sequenceDefaults(element.type,element.id)}}
 if(doc.diagrams.find(d=>d.id===diagramId)?.type==='uml-activity'){if(!umlElementCreatable('uml-activity',element.type))throw Error('Tipo no permitido en actividades');element={...element,activityDetail:element.activityDetail??activityDefaults(element.type)}}
 if(doc.diagrams.find(d=>d.id===diagramId)?.type==='uml-usecase'&&!umlElementCreatable('uml-usecase',element.type))throw new Error('Tipo no permitido para crear en casos de uso; reutiliza un elemento de contexto existente')
 if(doc.elements[element.id]&&JSON.stringify(doc.elements[element.id])!==JSON.stringify(element))throw new Error('ID de elemento duplicado')
 const update={...doc,elements:{...doc.elements,[element.id]:element}}
 return reuseElementNode(update,diagramId,element.id,node)
}
export function reuseElementNode(doc:ProjectDocument,diagramId:string,elementId:string,node:{id:string;x:number;y:number}):ProjectDocument{
 if(!doc.elements[elementId])throw new Error('Elemento inexistente')
 return withDiagram(doc,diagramId,d=>{
  if(d.type==='uml-activity'&&(doc.elements[elementId].activityCatalogDiagramId&&doc.elements[elementId].activityCatalogDiagramId!==diagramId||!umlElementReusable(d.type,doc.elements[elementId].type)||doc.diagrams.some(v=>v.type==='uml-activity'&&v.nodes.some(n=>n.elementId===elementId))))throw Error('La actividad requiere identidad local; crea una acción o llamada nueva')
  if(d.interaction&&SEQUENCE_TYPES.includes(doc.elements[elementId].type as typeof SEQUENCE_TYPES[number])&&doc.diagrams.some(v=>v.nodes.some(n=>n.elementId===elementId)))throw Error('Utiliza una nueva identidad local de secuencia')
  if(d.type==='uml-usecase'&&!umlElementReusable(d.type,doc.elements[elementId].type))throw new Error('Tipo no permitido para reutilizar en casos de uso')
  if(d.nodes.some(n=>n.id===node.id))throw new Error('ID de nodo duplicado')
  return {...d,nodes:[...d.nodes,{id:node.id,elementId,x:node.x,y:node.y}]}
 })
}
/** Explicitly remove a detached native UC element, never a placed/referenced element. */
export function deleteDetachedUseCaseElement(doc:ProjectDocument,id:string):ProjectDocument{
 const e=doc.elements[id];if(!e||!isUseCaseCatalogType(e.type))throw Error('Elemento de catálogo no disponible')
 if(useCaseElementIsReferenced(doc,id))throw Error('El elemento todavía tiene referencias en el modelo')
 const elements={...doc.elements};delete elements[id];return {...doc,elements}
}
/** Remove view references atomically; keep shared catalog records. */
function pruneRelations(d:Diagram,removedNodes:Set<string>,removedEdges:Set<string>){
 const dropped=new Set(removedEdges)
 for(const e of d.edges)if(removedNodes.has(e.source)||removedNodes.has(e.target)||e.associationEnds?.some(end=>removedNodes.has(end.nodeId))||e.componentEnds?.some(end=>removedNodes.has(end.nodeId)))dropped.add(e.id)
 let count=-1;while(count!==dropped.size){count=dropped.size;for(const e of d.edges)if(e.annotationTargetEdgeId&&dropped.has(e.annotationTargetEdgeId))dropped.add(e.id)}
 const removedElements=new Set(d.nodes.filter(n=>removedNodes.has(n.id)&&!d.nodes.some(other=>other.elementId===n.elementId&&!removedNodes.has(other.id))).map(n=>n.elementId))
 return d.edges.filter(e=>!dropped.has(e.id)).map(e=>e.associationClassId&&removedElements.has(e.associationClassId)?{...e,associationClassId:undefined}:e)
}
export function removeElementNode(doc:ProjectDocument,diagramId:string,elementId:string,nodeId?:string):ProjectDocument{
 doc=repairStoredUseCaseAnnotations(adaptUseCaseDocument(doc))
 const target=doc.diagrams.find(d=>d.id===diagramId)
 const removed=new Set(target?.nodes.filter(n=>n.elementId===elementId&&(!nodeId||n.id===nodeId)).map(n=>n.id)||[])
 if(target?.type==='uml-component'){for(let count=-1;count!==removed.size;){count=removed.size;for(const n of target.nodes)if(n.parentNodeId&&removed.has(n.parentNodeId)&&doc.elements[n.elementId]?.type==='uml-port')removed.add(n.id)}}
 const updated=withDiagram(doc,diagramId,d=>({...d,nodes:d.nodes.filter(n=>!removed.has(n.id)).map(n=>n.parentNodeId&&removed.has(n.parentNodeId)?{...n,parentNodeId:undefined,...umlAbsolutePosition(d,n)}:n),edges:pruneRelations(d,removed,new Set())}))
 return validatedActivityRemoval(doc,retainUseCaseCatalog(doc,{...updated,elements:Object.fromEntries(Object.entries(updated.elements).map(([id,e])=>[id,e.childDiagramId===diagramId&&e.childNodeId&&removed.has(e.childNodeId)?{...e,childNodeId:undefined}:e]))}),diagramId)
}
export function connectNodes(doc:ProjectDocument,diagramId:string,edge:DiagramEdge):ProjectDocument{
 if(doc.diagrams.find(d=>d.id===diagramId)?.type==='uml-deployment'){if(doc.diagrams.find(d=>d.id===diagramId)?.edges.some(e=>e.id===edge.id))throw Error('ID de relación duplicado');return setDeploymentRelation(doc,diagramId,edge)}
 if(doc.diagrams.find(d=>d.id===diagramId)?.type==='uml-component'){if(doc.diagrams.find(d=>d.id===diagramId)?.edges.some(e=>e.id===edge.id))throw Error('ID de relación duplicado');return setComponentRelation(doc,diagramId,edge)}
 if(doc.diagrams.find(d=>d.id===diagramId)?.type==='uml-activity'){const next=withDiagram(doc,diagramId,d=>{if(d.edges.some(e=>e.id===edge.id))throw Error('ID de relación duplicado');if(!d.nodes.some(n=>n.id===edge.source)||!d.nodes.some(n=>n.id===edge.target))throw Error('Extremos inexistentes');return {...d,edges:[...d.edges,edge]}});const issues=newActivityIssues(doc,next);if(issues.length)throw Error(issues[0].message);return next}
 if(doc.diagrams.find(d=>d.id===diagramId)?.type==='uml-usecase'){const d=doc.diagrams.find(d=>d.id===diagramId)!;if(d.edges.some(e=>e.id===edge.id))throw Error('ID de relación duplicado');if(!d.nodes.some(n=>n.id===edge.source)||!d.nodes.some(n=>n.id===edge.target))throw Error('Extremos inexistentes');const next=replaceUseCaseRelation(doc,diagramId,edge);const issues=newUseCaseIssues(doc,next);if(issues.length)throw Error(issues[0].message);return next}
 const next=withDiagram(doc,diagramId,d=>{
  if(edge.source===edge.target&&!(d.type==='uml-class'&&classSelfAllowed(edge.relationKind)))throw new Error('Autoconexión no permitida')
  if(!d.nodes.some(n=>n.id===edge.source)||!d.nodes.some(n=>n.id===edge.target))throw new Error('Extremos inexistentes')
  // Varias relaciones semánticamente distintas pueden unir las mismas cajas, incluso desde un mismo puerto.
  // La identidad estable de la relación es el ID, nunca el par origen/destino.
  if(d.edges.some(e=>e.id===edge.id))throw new Error('ID de relación duplicado')
  return {...d,edges:[...d.edges,edge]}
 })
 if(doc.diagrams.find(d=>d.id===diagramId)?.type==='uml-sequence'){const issue=newSequenceIssues(doc,next)[0];if(issue)throw Error(issue.message)}
 if(doc.diagrams.find(d=>d.id===diagramId)?.type==='uml-component'){const issue=newComponentIssues(doc,next)[0];if(issue)throw Error(issue.message)}
 return next
}
export function editRelation(doc:ProjectDocument,diagramId:string,edgeId:string,changes:Partial<DiagramEdge>):ProjectDocument{
 if(doc.diagrams.find(d=>d.id===diagramId)?.type==='uml-deployment'){const e=doc.diagrams.find(d=>d.id===diagramId)?.edges.find(e=>e.id===edgeId);if(!e)throw Error('Relación inexistente');return setDeploymentRelation(doc,diagramId,{...e,...changes,id:edgeId},e.deploymentRelationId&&Object.keys(changes).every(k=>['pathStyle','sourceHandle','targetHandle'].includes(k))?deploymentRegistry(doc)[e.deploymentRelationId]:undefined)}
 if(doc.diagrams.find(d=>d.id===diagramId)?.type==='uml-component'){const e=doc.diagrams.find(d=>d.id===diagramId)?.edges.find(e=>e.id===edgeId);if(!e)throw Error('Relación inexistente');return setComponentRelation(doc,diagramId,{...e,...changes,id:edgeId})}
 if(doc.diagrams.find(d=>d.id===diagramId)?.type==='uml-activity'){const next=withDiagram(doc,diagramId,d=>{if(!d.edges.some(e=>e.id===edgeId))throw Error('Relación inexistente');return {...d,edges:d.edges.map(e=>e.id===edgeId?{...e,...changes,id:e.id}:e)}});const issues=newActivityIssues(doc,next);if(issues.length)throw Error(issues[0].message);return next}
 const next=withDiagram(doc,diagramId,d=>{
  if(!d.edges.some(e=>e.id===edgeId))throw new Error('Relación inexistente')
  if('id' in changes||('source' in changes||'target' in changes)&&!(d.type==='uml-class'&&d.edges.some(e=>e.id===edgeId&&(e.source===changes.target&&e.target===changes.source||e.source===changes.source&&e.relationKind==='annotation'&&changes.annotationTargetEdgeId&&d.edges.some(target=>target.id===changes.annotationTargetEdgeId&&target.source===changes.target)))))throw new Error('No se pueden cambiar los extremos de una relación')
  return {...d,edges:d.edges.map(e=>e.id===edgeId?{...e,...changes}:e)}
 })
 if(doc.diagrams.find(d=>d.id===diagramId)?.type==='uml-sequence'){const issue=newSequenceIssues(doc,next)[0];if(issue)throw Error(issue.message)}
 if(doc.diagrams.find(d=>d.id===diagramId)?.type==='uml-component'){const issue=newComponentIssues(doc,next)[0];if(issue)throw Error(issue.message)}
 return next
}
/** Reattach an existing edge without discarding its ID, metadata or history.
 * Semantic registries and UML constraints remain authoritative; failures are atomic.
 */
export function reconnectRelation(doc:ProjectDocument,diagramId:string,edgeId:string,changes:Pick<DiagramEdge,'source'|'target'|'sourceHandle'|'targetHandle'>):ProjectDocument{
 const diagram=doc.diagrams.find(d=>d.id===diagramId)
 const edge=diagram?.edges.find(e=>e.id===edgeId)
 if(!diagram||!edge)throw Error('Relación inexistente')
 const source=diagram.nodes.find(n=>n.id===changes.source),target=diagram.nodes.find(n=>n.id===changes.target)
 if(!source||!target)throw Error('Selecciona dos cajas existentes')
 if(source.id===target.id&&!(diagram.type==='uml-class'&&classSelfAllowed(edge.relationKind)))throw Error('Autoconexión no permitida para este tipo de relación')
 const a=doc.elements[source.elementId],b=doc.elements[target.elementId]
 if(!a||!b)throw Error('Las cajas seleccionadas no tienen ficha visible')
 if(isUmlDiagram(diagram.type)&&edge.relationKind&&!umlRelationEndpointValid(diagram.type,edge.relationKind,a.type,b.type))throw Error('Los nuevos extremos son incompatibles con la relación UML')
 if(edge.source===changes.source&&edge.target===changes.target&&edge.sourceHandle===changes.sourceHandle&&edge.targetHandle===changes.targetHandle)return doc
 const nextEdge:DiagramEdge={...edge,...changes}
 // Preserve the identity of the first two ends of an n-ary association.
 if(edge.associationEnds&&edge.associationEnds.length>=2)nextEdge.associationEnds=edge.associationEnds.map((end,index)=>index<2?{...end,nodeId:index===0?changes.source:changes.target,handle:index===0?changes.sourceHandle:changes.targetHandle}:end)
 if(diagram.type==='uml-class'){
  const next=replaceClassRelationAcrossViews(doc,diagramId,nextEdge)
  const issue=newClassIssues(doc,next)[0]
  if(issue)throw Error(issue.message)
  return next
 }
 // These policies synchronize the semantic registry as well as the visual edge.
 if(diagram.type==='uml-usecase')return editUseCaseRelation(doc,diagramId,nextEdge)
 if(diagram.type==='uml-component')return setComponentRelation(doc,diagramId,nextEdge)
 if(diagram.type==='uml-deployment')return setDeploymentRelation(doc,diagramId,nextEdge)
 if(diagram.type==='uml-sequence'&&edge.sequenceEdge){
  // The temporal interaction has its own composer; it must recalculate occurrence
  // ownership instead of merely swapping screen coordinates.
  throw Error('Abre el editor de secuencia para cambiar el emisor o receptor y validar las ocurrencias')
 }
 if(diagram.type==='uml-activity'){
  const next=withDiagram(doc,diagramId,d=>({...d,edges:d.edges.map(e=>e.id===edgeId?nextEdge:e)}))
  const issue=newActivityIssues(doc,next)[0]
  if(issue)throw Error(issue.message)
  return next
 }
 const next=withDiagram(doc,diagramId,d=>({...d,edges:d.edges.map(e=>e.id===edgeId?nextEdge:e)}))
 if(diagram.type==='uml-sequence'){const issue=newSequenceIssues(doc,next)[0];if(issue)throw Error(issue.message)}
 return next
}
function editUseCaseRelation(doc:ProjectDocument,diagramId:string,edge:DiagramEdge):ProjectDocument{
 const next=replaceUseCaseRelation(doc,diagramId,edge)
 const issue=newUseCaseIssues(doc,next)[0]
 if(issue)throw Error(issue.message)
 return next
}
export function removeRelation(doc:ProjectDocument,diagramId:string,edgeId:string):ProjectDocument{
 doc=repairStoredUseCaseAnnotations(adaptUseCaseDocument(doc))
 return validatedActivityRemoval(doc,withDiagram(doc,diagramId,d=>{
  if(!d.edges.some(e=>e.id===edgeId))throw new Error('Relación inexistente')
  return {...d,edges:pruneRelations(d,new Set(),new Set([edgeId]))}
 }),diagramId)
}
/** Guarda dimensiones por aparición, sin afectar el mismo elemento usado en otras vistas. */
export function resizeNode(doc:ProjectDocument,diagramId:string,nodeId:string,width:number,height:number,x?:number,y?:number):ProjectDocument{
 if(!validNodeDimension(width)||!validNodeDimension(height))throw new Error('Ancho/alto: entre 48 y 4000 px, números enteros')
 const next=withDiagram(doc,diagramId,d=>{
  const node=d.nodes.find(n=>n.id===nodeId)
  if(!node)throw new Error('Caja no encontrada')
  const element=doc.elements[node.elementId]
  if(!element)throw new Error('Elemento inexistente')
  if(d.type==='uml-component'&&element.type==='uml-port')throw Error('El puerto UML tiene tamaño fijo; mueve el símbolo por el borde')
  if(sequencePositionLocked(doc,d,node))throw Error('El tamaño de este símbolo depende de sus ocurrencias; ajusta sus propiedades de secuencia')
  const minimum=d.type==='uml-activity'&&element.type==='uml-fork'&&element.activityDetail?.orientation==='vertical'?{width:48,height:90}:novziNodeMinimum(d.type,element.type)
  if(width<minimum.width||height<minimum.height)throw new Error(`Tamaño mínimo: ${minimum.width} × ${minimum.height} px`)
  if(x!==undefined&&(!Number.isFinite(x)||x<-4000||x>100000)||y!==undefined&&(!Number.isFinite(y)||y<-4000||y>100000))throw new Error('Posición inválida')
  const children=d.nodes.filter(n=>n.parentNodeId===nodeId)
  const original=novziNodeSize(d.type,element,node,umlNodeDepth(d,node),children.length>0)
  const adjustedChildren=new Map<string,{x:number;y:number}>()
  for(const child of children){
   const childElement=doc.elements[child.elementId]
   if(!childElement)continue
   const size=novziNodeSize(d.type,childElement,child,umlNodeDepth(d,child),d.nodes.some(x=>x.parentNodeId===child.id))
   if(d.type==='uml-sequence'&&sequenceIsAttachment(childElement.type)){
    adjustedChildren.set(child.id,sequenceSnapChild(element.type,childElement.type,{width,height},size,child.y))
   }else if(d.type==='uml-activity'&&childElement.type==='uml-activity-pin'){adjustedChildren.set(child.id,activitySnapPin({width,height},size,childElement.activityDetail?.role,child.y))
   }else if(d.type==='uml-component'&&childElement.type==='uml-port'){adjustedChildren.set(child.id,componentPortResize(child.x,child.y,original,{width,height}))
   }else if(d.type==='uml-composite'&&childElement.type==='uml-port'){
    // Mantener la cara del borde al ampliar/reducir el clasificador.
    const pw=size.width,ph=size.height
    const candidates=[
     {side:'left',distance:Math.abs(child.x+pw/2)},
     {side:'right',distance:Math.abs(child.x+pw/2-original.width)},
     {side:'top',distance:Math.abs(child.y+ph/2)},
     {side:'bottom',distance:Math.abs(child.y+ph/2-original.height)}
    ]
    const side=candidates.sort((a,b)=>a.distance-b.distance)[0].side
    const next={x:side==='right'?width-pw/2:side==='left'?-pw/2:child.x,
     y:side==='bottom'?height-ph/2:side==='top'?-ph/2:child.y}
    adjustedChildren.set(child.id,{x:Math.round(Math.max(-pw/2,Math.min(width-pw/2,next.x))),y:Math.round(Math.max(-ph/2,Math.min(height-ph/2,next.y)))})
   }else if(child.x+size.width>width||child.y+size.height>height){
    throw new Error('El contenedor no puede quedar más pequeño que sus elementos internos')
   }
  }
  const draftParent=d.type==='uml-sequence'&&sequenceIsAttachment(element.type)&&node.parentNodeId?d.nodes.find(n=>n.id===node.parentNodeId):undefined
  const draftSnap=draftParent?sequenceSnapChild(doc.elements[draftParent.elementId].type,element.type,novziNodeSize(d.type,doc.elements[draftParent.elementId],draftParent),{width,height},y??node.y):undefined
  return {...d,nodes:d.nodes.map(n=>n.id===nodeId?{...n,width,height,...(x===undefined?{}:{x:Math.round(x)}),...(y===undefined?{}:{y:Math.round(y)}),...draftSnap,...(d.type==='uml-activity'&&element.type==='uml-activity-pin'&&n.parentNodeId?(()=>{const parent=d.nodes.find(p=>p.id===n.parentNodeId);return parent?activitySnapPin(novziNodeSize(d.type,doc.elements[parent.elementId],parent),{width,height},element.activityDetail?.role,y??n.y):{}})():{})}:adjustedChildren.has(n.id)?{...n,...adjustedChildren.get(n.id)!}:n)}
 })
 const d=doc.diagrams.find(d=>d.id===diagramId);if(d?.interaction){const issue=newSequenceIssues(doc,next)[0];if(issue)throw Error(issue.message)}return next
}
/** Sequence nodes in React Flow use absolute projected positions. Move the semantic
 * group and its occurrences exactly once; reject conflicting deltas or invalid timing. */
export function moveTypedSequenceSelection(doc:ProjectDocument,diagramId:string,moves:{id:string;x:number;y:number}[]):ProjectDocument{
 const d=doc.diagrams.find(x=>x.id===diagramId);if(!d?.interaction||d.type!=='uml-sequence')throw Error('Interacción inexistente');
 const ns=new Map(d.nodes.map(n=>[n.id,n])),detail=(id:string)=>doc.elements[ns.get(id)?.elementId||'']?.sequenceDetail;
 const frames=new Map(d.nodes.flatMap(n=>(detail(n.id)?.operands||[]).map(o=>[o.id,n.id] as const)));
 const selected=new Map<string,{x:number;y:number}>();for(const m of moves){const n=ns.get(m.id);if(!n||!Number.isFinite(m.x)||!Number.isFinite(m.y))throw Error('Selección inválida');const b=sequenceBox(doc,d,n);selected.set(m.id,{x:Math.round(m.x-b.x),y:Math.round(m.y-b.y)})}
 const ancestors=(id:string,extra?:string)=>{const ids=new Set<string>();const visit=(k?:string)=>{if(!k||!ns.has(k)||ids.has(k))return;ids.add(k);const n=ns.get(k)!,s=detail(k);visit(n.parentNodeId);visit(s?.parentOperandId?frames.get(s.parentOperandId):undefined);visit(s?.lifelineId);if(s?.gateKind&&s.gateKind!=='formal')visit(s.ownerId)};visit(id);visit(extra);return ids};
 const delta=(ids:Set<string>)=>{const ds=[...ids].flatMap(id=>selected.has(id)?[selected.get(id)!]:[]);if(ds.some(v=>v.x!==ds[0].x||v.y!==ds[0].y))throw Error('La selección de secuencia contiene desplazamientos de ámbitos incompatibles');return ds[0]||{x:0,y:0}};
 for(const id of selected.keys()){
  const n=ns.get(id)!,e=doc.elements[n.elementId];if([...ancestors(id)].some(a=>a!==id&&selected.has(a)))continue;
  if(sequencePositionLocked(doc,d,n))throw Error('Ajusta las ocurrencias o el propietario en las propiedades de secuencia');
  const parent=n.parentNodeId&&ns.get(n.parentNodeId);if(parent&&sequenceIsAttachment(e.type)){
   const change=selected.get(id)!,snap=sequenceSnapChild(doc.elements[parent.elementId].type,e.type,novziNodeSize(d.type,doc.elements[parent.elementId],parent),novziNodeSize(d.type,e,n),n.y+change.y);
   selected.set(id,{x:snap.x-n.x,y:snap.y-n.y});
  }
 }
 const offsets=new Map(d.nodes.map(n=>[n.id,delta(ancestors(n.id))]));
 const root={...d.interaction,occurrences:d.interaction.occurrences.map(o=>{const ids=ancestors(o.nodeId,o.operandId?frames.get(o.operandId):undefined),line=sequenceLifeline(doc,d,o.nodeId);if(line)for(const id of ancestors(line))ids.add(id);const dy=delta(ids).y;return dy?{...o,time:o.time+dy}:o})};if(!validSequenceRoot(root))throw Error('El desplazamiento deja ocurrencias fuera del tiempo válido');
 const next=withDiagram(doc,diagramId,v=>({...v,interaction:root,nodes:v.nodes.map(n=>{const a=offsets.get(n.id)!,b=n.parentNodeId?offsets.get(n.parentNodeId):undefined,dx=a.x-(b?.x||0),dy=a.y-(b?.y||0);return dx||dy?{...n,x:n.x+dx,y:n.y+dy}:n})}));const issue=newSequenceIssues(doc,next)[0];if(issue)throw Error(issue.message);return next;
}
export function moveNode(doc:ProjectDocument,diagramId:string,nodeId:string,x:number,y:number):ProjectDocument{
 const view=doc.diagrams.find(d=>d.id===diagramId),node=view?.nodes.find(n=>n.id===nodeId);
 if(view?.type==='uml-sequence'&&view.interaction){
  // The direct command preserves the historical parent-relative attachment API;
  // the canvas calls moveDiagramSelection with absolute projected coordinates.
  if(node?.parentNodeId&&sequenceIsAttachment(doc.elements[node.elementId].type)&&!sequencePositionLocked(doc,view,node)){
   const parent=view.nodes.find(n=>n.id===node.parentNodeId);if(parent){const p=umlAbsolutePosition(view,parent);return moveTypedSequenceSelection(doc,diagramId,[{id:nodeId,x:p.x+x,y:p.y+y}])}
  }
  return moveTypedSequenceSelection(doc,diagramId,[{id:nodeId,x,y}]);
 }
 if(!Number.isFinite(x)||!Number.isFinite(y))throw new Error('Posición inválida')
 return withDiagram(doc,diagramId,d=>{
  if(!d.nodes.some(n=>n.id===nodeId))throw new Error('Nodo no encontrado')
  return {...d,nodes:d.nodes.map(n=>{
   if(n.id!==nodeId)return n
   const element=doc.elements[n.elementId]
   if(d.type==='uml-component'&&element?.type==='uml-port'&&n.parentNodeId){const parent=d.nodes.find(p=>p.id===n.parentNodeId);if(parent){const size=novziNodeSize(d.type,doc.elements[parent.elementId],parent,umlNodeDepth(d,parent),true);return {...n,...componentPortSnap(x,y,size.width,size.height)}}}
   if(d.type==='uml-activity'&&element?.type==='uml-activity-pin'&&n.parentNodeId){const parent=d.nodes.find(p=>p.id===n.parentNodeId);if(parent)return {...n,...activitySnapPin(novziNodeSize(d.type,doc.elements[parent.elementId],parent),novziNodeSize(d.type,element,n),element.activityDetail?.role,y)}}
   if(d.type==='uml-sequence'&&n.parentNodeId&&element&&sequenceIsAttachment(element.type)){
    const parent=d.nodes.find(item=>item.id===n.parentNodeId)
    const pe=parent?doc.elements[parent.elementId]:undefined
    if(parent&&pe){
     const psize=novziNodeSize(d.type,pe,parent,umlNodeDepth(d,parent),true)
     const csize=novziNodeSize(d.type,element,n,umlNodeDepth(d,n),false)
     return {...n,...sequenceSnapChild(pe.type,element.type,psize,csize,y)}
    }
   }
   return {...n,x:Math.round(x),y:Math.round(y)}
  })}
 })
}
export function editElement(doc:ProjectDocument,id:string,partial:Partial<ModelElement>,date:string):ProjectDocument{
 if(!doc.elements[id])throw new Error('Elemento no encontrado')
 if('id' in partial&&partial.id!==id)throw new Error('No se cambia identidad del elemento')
 const element={...doc.elements[id],...partial,id,updatedAt:date};let next={...doc,elements:{...doc.elements,[id]:element}}
 if(partial.activityDetail){next={...next,diagrams:next.diagrams.map(d=>{if(d.type!=='uml-activity')return d;return {...d,nodes:d.nodes.map(n=>{if(n.elementId!==id)return n;const old=doc.elements[id].activityDetail,detail=element.activityDetail;if(element.type==='uml-fork'&&(old?.orientation||'horizontal')!==(detail?.orientation||'horizontal')){const size=novziNodeSize(d.type,doc.elements[id],n);return {...n,width:Math.max(48,size.height),height:Math.max(48,size.width)}}if(element.type==='uml-activity-pin'&&detail?.ownerActionId){const parent=d.nodes.find(p=>p.elementId===detail.ownerActionId);if(parent){const size=novziNodeSize(d.type,next.elements[parent.elementId],parent),pin=novziNodeSize(d.type,element,n);return {...n,parentNodeId:parent.id,...activitySnapPin(size,pin,detail.role,n.y)}}}return n})}})}}
 const issues=[...newActivityIssues(doc,next),...newSequenceIssues(doc,next),...newComponentIssues(doc,next),...newDeploymentIssues(doc,next)];if(issues.length)throw Error(issues[0].message);return next
}
export function addFieldDefinition(doc:ProjectDocument,field:FieldDefinition):ProjectDocument{
 if(field.label.trim().length<2)throw new Error('Etiqueta de campo inválida')
 if(doc.fieldDefinitions.some(f=>f.id===field.id))throw new Error('ID de campo duplicado')
 return {...doc,fieldDefinitions:[...doc.fieldDefinitions,field]}
}
export function removeFieldDefinition(doc:ProjectDocument,id:string):ProjectDocument{
 return {...doc,fieldDefinitions:doc.fieldDefinitions.filter(f=>f.id!==id)}
}

/** Mueve una selección del lienzo en una única revisión persistida. Los hijos
 * de contenedores seleccionados conservan sus posiciones locales. */
export function moveDiagramSelection(doc:ProjectDocument,diagramId:string,moves:{id:string;x:number;y:number}[]):ProjectDocument{
 const diagram=doc.diagrams.find(d=>d.id===diagramId)
 if(!diagram)throw new Error('Diagrama inexistente')
 if(diagram.type==='uml-sequence'&&diagram.interaction)return moveTypedSequenceSelection(doc,diagramId,moves);
 const ids=new Set(diagram.nodes.map(n=>n.id))
 if(moves.some(m=>!ids.has(m.id)||!Number.isFinite(m.x)||!Number.isFinite(m.y)))throw new Error('Selección inválida')
 const byId=new Map(moves.map(m=>[m.id,m]))
 const skipChildren=new Set<string>()
 for(const n of diagram.nodes){
  let parentId=n.parentNodeId
  while(parentId){
   if(byId.has(parentId)){skipChildren.add(n.id);break}
   parentId=diagram.nodes.find(p=>p.id===parentId)?.parentNodeId
  }
 }
 let current=doc
 for(const move of moves){
  if(!skipChildren.has(move.id))current=moveNode(current,diagramId,move.id,move.x,move.y)
 }
 return current
}

/** Elimina elementos seleccionados únicamente de esta vista y retira sus aristas.
 * La ficha compartida subsiste y los hijos no seleccionados se desacoplan. */
export function removeDiagramSelection(doc:ProjectDocument,diagramId:string,nodeIds:string[],edgeIds:string[]):ProjectDocument{
 doc=repairStoredUseCaseAnnotations(adaptUseCaseDocument(doc))
 const diagram=doc.diagrams.find(d=>d.id===diagramId)
 if(!diagram)throw new Error('Diagrama inexistente')
 const removed=new Set(nodeIds),removedEdges=new Set(edgeIds)
 if([...removed].some(id=>!diagram.nodes.some(n=>n.id===id)))throw new Error('Caja no encontrada')
 if([...removedEdges].some(id=>!diagram.edges.some(e=>e.id===id)))throw new Error('Relación no encontrada')
 if(diagram.type==='uml-component'){for(let count=-1;count!==removed.size;){count=removed.size;for(const n of diagram.nodes)if(n.parentNodeId&&removed.has(n.parentNodeId)&&doc.elements[n.elementId]?.type==='uml-port')removed.add(n.id)}}
 const updated=withDiagram(doc,diagramId,d=>({
  ...d,
  nodes:d.nodes.filter(n=>!removed.has(n.id)).map(n=>n.parentNodeId&&removed.has(n.parentNodeId)?{...n,...umlAbsolutePosition(d,n),parentNodeId:undefined}:n),
  edges:pruneRelations(d,removed,removedEdges)
 }))
 return validatedActivityRemoval(doc,retainUseCaseCatalog(doc,{...updated,elements:Object.fromEntries(Object.entries(updated.elements).map(([id,e])=>[id,e.childDiagramId===diagramId&&e.childNodeId&&removed.has(e.childNodeId)?{...e,childNodeId:undefined}:e]))}),diagramId)
}

/** Contención UML: subpaquetes, clasificadores compuestos y puertos encastrados.
 * Mantiene posiciones absolutas al cambiar de contenedor y previene ciclos.
 * Nombre histórico conservado para no romper las llamadas anteriores.
 */
export function setNodePackage(doc:ProjectDocument,diagramId:string,nodeId:string,parentNodeId?:string):ProjectDocument{
 const original=doc,view=doc.diagrams.find(d=>d.id===diagramId)
 if(view?.type==='uml-usecase'&&parentNodeId){const n=view.nodes.find(n=>n.id===nodeId),p=view.nodes.find(n=>n.id===parentNodeId),e=n&&doc.elements[n.elementId];if(e?.type==='usecase'&&p&&doc.elements[p.elementId]?.type==='uml-subject'){const subject=canonicalSubjectId(doc,p.elementId),subjects=e.useCaseDetail?.subjectIds||[];if(!subjects.some(id=>canonicalSubjectId(doc,id)===subject))doc={...doc,elements:{...doc.elements,[e.id]:{...e,useCaseDetail:{...e.useCaseDetail,subjectIds:[...subjects,subject]}}}}}}
 const updated=withDiagram(doc,diagramId,d=>{
  const node=d.nodes.find(n=>n.id===nodeId)
  if(!node)throw new Error('Caja no encontrada')
  if(parentNodeId===nodeId)throw new Error('Un elemento no puede contenerse a sí mismo')
  const parent=parentNodeId?d.nodes.find(n=>n.id===parentNodeId):undefined
  const element=doc.elements[node.elementId]
  if(parentNodeId&&(!parent||!umlContainerAllows(d.type,doc.elements[parent.elementId]?.type,element.type)))throw new Error('Contenedor UML incompatible')
  if(parent&&node.parentNodeId===parent.id&&!(d.type==='uml-activity'&&element.type==='uml-activity-pin')&&!(['uml-composite','uml-component'].includes(d.type)&&element.type==='uml-port')&&!(d.type==='uml-sequence'&&sequenceIsAttachment(element.type)))return d
  const absolute=umlAbsolutePosition(d,node)
  const targetPosition=parent?umlAbsolutePosition(d,parent):{x:0,y:0}
  const size=parent?novziNodeSize(d.type,doc.elements[parent.elementId],parent,umlNodeDepth(d,parent),d.nodes.some(x=>x.parentNodeId===parent.id)):null
  let x=absolute.x-targetPosition.x,y=absolute.y-targetPosition.y
  if(size){
   if(d.type==='uml-sequence'&&sequenceIsAttachment(element.type)){
    const childSize=novziNodeSize(d.type,element,node,umlNodeDepth(d,node),false)
    ;({x,y}=sequenceSnapChild(doc.elements[parent!.elementId].type,element.type,size,childSize,y))
   }else if(d.type==='uml-activity'&&element.type==='uml-activity-pin'){const pin=novziNodeSize(d.type,element,node);const snapped=activitySnapPin(size,pin,element.activityDetail?.role,y);x=snapped.x;y=snapped.y}
   else if(d.type==='uml-component'&&element.type==='uml-port')({x,y}=componentPortSnap(x,y,size.width,size.height))
   else if(d.type==='uml-composite'&&element.type==='uml-port')({x,y}=umlSnapPort(x,y,size.width,size.height))
   else if(d.type==='uml-component'){const child=novziNodeSize(d.type,element,node,umlNodeDepth(d,node),false);if(child.width>size.width||child.height>size.height)throw Error('Amplía primero el contenedor para alojar el elemento');x=Math.max(0,Math.min(size.width-child.width,x));y=Math.max(0,Math.min(size.height-child.height,y))}
   else if(d.type==='uml-usecase'){const child=novziNodeSize(d.type,element,node);if(child.width>size.width||child.height>size.height)throw Error('El sujeto no tiene espacio para el caso');x=Math.max(0,Math.min(size.width-child.width,x));y=Math.max(0,Math.min(size.height-child.height,y))}else{x=Math.max(0,Math.min(size.width-60,x));y=Math.max(0,Math.min(size.height-40,y))}
  }
  const changed={...node,parentNodeId:parent?.id,x:Math.round(x),y:Math.round(y)}
  const candidate={...d,nodes:d.nodes.map(n=>n.id===nodeId?changed:n)}
  if(!umlAncestryValid(candidate,changed,doc.elements))throw new Error('La jerarquía UML crearía un ciclo')
  return candidate
 })
 if(view?.type==='uml-activity'){const node=view.nodes.find(n=>n.id===nodeId),parent=view.nodes.find(n=>n.id===parentNodeId),e=node&&updated.elements[node.elementId];if(e?.type==='uml-activity-pin'&&parent){const next={...updated,elements:{...updated.elements,[e.id]:{...e,activityDetail:{...e.activityDetail,ownerActionId:parent.elementId}}}};return next}}
 if(view?.type==='uml-deployment'){const issue=newDeploymentIssues(doc,updated)[0];if(issue)throw Error(issue.message)}
 if(view?.type==='uml-component'){const n=view.nodes.find(n=>n.id===nodeId),e=n&&doc.elements[n.elementId],parent=view.nodes.find(n=>n.id===parentNodeId),pe=parent&&doc.elements[parent.elementId];if(e?.type==='uml-port'&&e.uml?.component?.kind!=='port'&&pe&&componentClassifier(pe.type)){throw Error('Resuelve primero el propietario del puerto histórico antes de moverlo')}if(e&&componentRole(e.type)&&e.semanticOwnerId&&pe&&pe.id!==e.semanticOwnerId)throw Error('Mover una aparición no modifica su propietario semántico');const issue=newComponentIssues(original,updated)[0];if(issue)throw Error(issue.message);return updated}
 if(view?.type==='uml-usecase'){const issues=newUseCaseIssues(original,updated);if(issues.length)throw Error(issues[0].message)}return updated
}

export function deleteDetachedActivityElement(doc:ProjectDocument,id:string):ProjectDocument{
 const e=doc.elements[id];if(!e?.activityCatalogDiagramId||activityCatalogReferenced(doc,id)||useCaseElementIsReferenced(doc,id))throw Error('Ficha de actividad referenciada o no disponible');const elements={...doc.elements};delete elements[id];return {...doc,elements}
}
export function convertLegacyActivitySignal(doc:ProjectDocument,diagramId:string,nodeId:string,kind:'sendSignal'|'acceptEvent',newId:string,date:string):ProjectDocument{
 const d=doc.diagrams.find(v=>v.id===diagramId&&v.type==='uml-activity'),n=d?.nodes.find(n=>n.id===nodeId),old=n&&doc.elements[n.elementId];if(!d||!n||old?.type!=='uml-signal'||doc.elements[newId])throw Error('Señal histórica no disponible');
 if(Object.values(doc.elements).some(e=>e.childDiagramId===diagramId&&e.childNodeId===nodeId)||d.nodes.some(n=>n.id===newId))throw Error('Desvincula primero la aparición histórica');const {uml,semanticOwnerId,useCaseDetail,useCaseCatalog,activityCatalogDiagramId,...data}=old;const e:ModelElement={...data,id:newId,type:'uml-action',activityDetail:{kind,referenceId:old.id},updatedAt:date};const next=withDiagram({...doc,elements:{...doc.elements,[newId]:e}},diagramId,v=>({...v,nodes:v.nodes.map(x=>x.id===nodeId?{...x,id:newId,elementId:newId}:x),edges:v.edges.map(x=>x.source===nodeId||x.target===nodeId?{...x,source:x.source===nodeId?newId:x.source,target:x.target===nodeId?newId:x.target}:x)}));const issues=newActivityIssues(doc,next);if(issues.length)throw Error(issues[0].message);return next
}
