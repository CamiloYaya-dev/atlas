import {classSelfAllowed} from '@atlas/contracts'
/** Pure model operations used by the editor. Backend policy remains the authority. */
import type {Diagram,DiagramEdge,DiagramType,FieldDefinition,ModelElement,ProjectDocument} from '@atlas/contracts'
import {umlContainerAllows,umlAbsolutePosition,umlAncestryValid,umlNodeDepth,umlSnapPort,atlasNodeSize,atlasNodeMinimum,validNodeDimension,sequenceSnapChild,sequenceIsAttachment} from '@atlas/contracts'

function withDiagram(doc:ProjectDocument,id:string,mutate:(d:Diagram)=>Diagram):ProjectDocument{
 if(!doc.diagrams.some(d=>d.id===id))throw new Error('Diagrama no encontrado')
 return {...doc,diagrams:doc.diagrams.map(d=>d.id===id?mutate(d):d)}
}
export function createDiagram(doc:ProjectDocument,data:{id:string;name:string;type:DiagramType;date:string}):ProjectDocument{
 if(data.name.trim().length<2)throw new Error('Nombre de diagrama inválido')
 if(doc.diagrams.some(d=>d.id===data.id))throw new Error('ID de diagrama duplicado')
 return {...doc,diagrams:[...doc.diagrams,{id:data.id,name:data.name.trim(),type:data.type,description:'',createdAt:data.date,nodes:[],edges:[]}]}
}
export function editDiagram(doc:ProjectDocument,id:string,changes:Partial<Diagram>):ProjectDocument{
 return withDiagram(doc,id,d=>({...d,...changes,id:d.id}))
}
export function deleteDiagram(doc:ProjectDocument,id:string):ProjectDocument{
 if(!doc.diagrams.some(d=>d.id===id))throw new Error('Diagrama no encontrado')
 return {...doc,diagrams:doc.diagrams.filter(d=>d.id!==id),elements:Object.fromEntries(Object.entries(doc.elements).map(([key,e])=>[key,e.childDiagramId===id?{...e,childDiagramId:undefined,childNodeId:undefined}:e]))}
}
export function addElementNode(doc:ProjectDocument,diagramId:string,element:ModelElement,node:{id:string;x:number;y:number}):ProjectDocument{
 if(doc.elements[element.id]&&JSON.stringify(doc.elements[element.id])!==JSON.stringify(element))throw new Error('ID de elemento duplicado')
 const update={...doc,elements:{...doc.elements,[element.id]:element}}
 return reuseElementNode(update,diagramId,element.id,node)
}
export function reuseElementNode(doc:ProjectDocument,diagramId:string,elementId:string,node:{id:string;x:number;y:number}):ProjectDocument{
 if(!doc.elements[elementId])throw new Error('Elemento inexistente')
 return withDiagram(doc,diagramId,d=>{
  if(d.nodes.some(n=>n.id===node.id))throw new Error('ID de nodo duplicado')
  return {...d,nodes:[...d.nodes,{id:node.id,elementId,x:node.x,y:node.y}]}
 })
}
/** Remove view references atomically; keep shared catalog records. */
function pruneRelations(d:Diagram,removedNodes:Set<string>,removedEdges:Set<string>){
 const dropped=new Set(removedEdges)
 for(const e of d.edges)if(removedNodes.has(e.source)||removedNodes.has(e.target)||e.associationEnds?.some(end=>removedNodes.has(end.nodeId)))dropped.add(e.id)
 let count=-1;while(count!==dropped.size){count=dropped.size;for(const e of d.edges)if(e.annotationTargetEdgeId&&dropped.has(e.annotationTargetEdgeId))dropped.add(e.id)}
 const removedElements=new Set(d.nodes.filter(n=>removedNodes.has(n.id)&&!d.nodes.some(other=>other.elementId===n.elementId&&!removedNodes.has(other.id))).map(n=>n.elementId))
 return d.edges.filter(e=>!dropped.has(e.id)).map(e=>e.associationClassId&&removedElements.has(e.associationClassId)?{...e,associationClassId:undefined}:e)
}
export function removeElementNode(doc:ProjectDocument,diagramId:string,elementId:string):ProjectDocument{
 const target=doc.diagrams.find(d=>d.id===diagramId)
 const removed=new Set(target?.nodes.filter(n=>n.elementId===elementId).map(n=>n.id)||[])
 const updated=withDiagram(doc,diagramId,d=>({...d,nodes:d.nodes.filter(n=>!removed.has(n.id)).map(n=>n.parentNodeId&&removed.has(n.parentNodeId)?{...n,parentNodeId:undefined,...umlAbsolutePosition(d,n)}:n),edges:pruneRelations(d,removed,new Set())}))
 return {...updated,elements:Object.fromEntries(Object.entries(updated.elements).map(([id,e])=>[id,e.childDiagramId===diagramId&&e.childNodeId&&removed.has(e.childNodeId)?{...e,childNodeId:undefined}:e]))}
}
export function connectNodes(doc:ProjectDocument,diagramId:string,edge:DiagramEdge):ProjectDocument{
 return withDiagram(doc,diagramId,d=>{
  if(edge.source===edge.target&&!(d.type==='uml-class'&&classSelfAllowed(edge.relationKind)))throw new Error('Autoconexión no permitida')
  if(!d.nodes.some(n=>n.id===edge.source)||!d.nodes.some(n=>n.id===edge.target))throw new Error('Extremos inexistentes')
  // Varias relaciones semánticamente distintas pueden unir las mismas cajas, incluso desde un mismo puerto.
  // La identidad estable de la relación es el ID, nunca el par origen/destino.
  if(d.edges.some(e=>e.id===edge.id))throw new Error('ID de relación duplicado')
  return {...d,edges:[...d.edges,edge]}
 })
}
export function editRelation(doc:ProjectDocument,diagramId:string,edgeId:string,changes:Partial<DiagramEdge>):ProjectDocument{
 return withDiagram(doc,diagramId,d=>{
  if(!d.edges.some(e=>e.id===edgeId))throw new Error('Relación inexistente')
  if('id' in changes||('source' in changes||'target' in changes)&&!(d.type==='uml-class'&&d.edges.some(e=>e.id===edgeId&&(e.source===changes.target&&e.target===changes.source||e.source===changes.source&&e.relationKind==='annotation'&&changes.annotationTargetEdgeId&&d.edges.some(target=>target.id===changes.annotationTargetEdgeId&&target.source===changes.target)))))throw new Error('No se pueden cambiar los extremos de una relación')
  return {...d,edges:d.edges.map(e=>e.id===edgeId?{...e,...changes}:e)}
 })
}
export function removeRelation(doc:ProjectDocument,diagramId:string,edgeId:string):ProjectDocument{
 return withDiagram(doc,diagramId,d=>{
  if(!d.edges.some(e=>e.id===edgeId))throw new Error('Relación inexistente')
  return {...d,edges:pruneRelations(d,new Set(),new Set([edgeId]))}
 })
}
/** Guarda dimensiones por aparición, sin afectar el mismo elemento usado en otras vistas. */
export function resizeNode(doc:ProjectDocument,diagramId:string,nodeId:string,width:number,height:number,x?:number,y?:number):ProjectDocument{
 if(!validNodeDimension(width)||!validNodeDimension(height))throw new Error('Ancho/alto: entre 48 y 4000 px, números enteros')
 return withDiagram(doc,diagramId,d=>{
  const node=d.nodes.find(n=>n.id===nodeId)
  if(!node)throw new Error('Caja no encontrada')
  const element=doc.elements[node.elementId]
  if(!element)throw new Error('Elemento inexistente')
  const minimum=atlasNodeMinimum(d.type,element.type)
  if(width<minimum.width||height<minimum.height)throw new Error(`Tamaño mínimo: ${minimum.width} × ${minimum.height} px`)
  if(x!==undefined&&(!Number.isFinite(x)||x<-4000||x>100000)||y!==undefined&&(!Number.isFinite(y)||y<-4000||y>100000))throw new Error('Posición inválida')
  const children=d.nodes.filter(n=>n.parentNodeId===nodeId)
  const original=atlasNodeSize(d.type,element,node,umlNodeDepth(d,node),children.length>0)
  const adjustedChildren=new Map<string,{x:number;y:number}>()
  for(const child of children){
   const childElement=doc.elements[child.elementId]
   if(!childElement)continue
   const size=atlasNodeSize(d.type,childElement,child,umlNodeDepth(d,child),d.nodes.some(x=>x.parentNodeId===child.id))
   if(d.type==='uml-sequence'&&sequenceIsAttachment(childElement.type)){
    adjustedChildren.set(child.id,sequenceSnapChild(element.type,childElement.type,{width,height},size,child.y))
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
  return {...d,nodes:d.nodes.map(n=>n.id===nodeId?{...n,width,height,...(x===undefined?{}:{x:Math.round(x)}),...(y===undefined?{}:{y:Math.round(y)})}:adjustedChildren.has(n.id)?{...n,...adjustedChildren.get(n.id)!}:n)}
 })
}
export function moveNode(doc:ProjectDocument,diagramId:string,nodeId:string,x:number,y:number):ProjectDocument{
 if(!Number.isFinite(x)||!Number.isFinite(y))throw new Error('Posición inválida')
 return withDiagram(doc,diagramId,d=>{
  if(!d.nodes.some(n=>n.id===nodeId))throw new Error('Nodo no encontrado')
  return {...d,nodes:d.nodes.map(n=>{
   if(n.id!==nodeId)return n
   const element=doc.elements[n.elementId]
   if(d.type==='uml-sequence'&&n.parentNodeId&&element&&sequenceIsAttachment(element.type)){
    const parent=d.nodes.find(item=>item.id===n.parentNodeId)
    const pe=parent?doc.elements[parent.elementId]:undefined
    if(parent&&pe){
     const psize=atlasNodeSize(d.type,pe,parent,umlNodeDepth(d,parent),true)
     const csize=atlasNodeSize(d.type,element,n,umlNodeDepth(d,n),false)
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
 return {...doc,elements:{...doc.elements,[id]:{...doc.elements[id],...partial,id,updatedAt:date}}}
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
 const diagram=doc.diagrams.find(d=>d.id===diagramId)
 if(!diagram)throw new Error('Diagrama inexistente')
 const removed=new Set(nodeIds),removedEdges=new Set(edgeIds)
 if([...removed].some(id=>!diagram.nodes.some(n=>n.id===id)))throw new Error('Caja no encontrada')
 if([...removedEdges].some(id=>!diagram.edges.some(e=>e.id===id)))throw new Error('Relación no encontrada')
 const updated=withDiagram(doc,diagramId,d=>({
  ...d,
  nodes:d.nodes.filter(n=>!removed.has(n.id)).map(n=>n.parentNodeId&&removed.has(n.parentNodeId)?{...n,...umlAbsolutePosition(d,n),parentNodeId:undefined}:n),
  edges:pruneRelations(d,removed,removedEdges)
 }))
 return {...updated,elements:Object.fromEntries(Object.entries(updated.elements).map(([id,e])=>[id,e.childDiagramId===diagramId&&e.childNodeId&&removed.has(e.childNodeId)?{...e,childNodeId:undefined}:e]))}
}

/** Contención UML: subpaquetes, clasificadores compuestos y puertos encastrados.
 * Mantiene posiciones absolutas al cambiar de contenedor y previene ciclos.
 * Nombre histórico conservado para no romper las llamadas anteriores.
 */
export function setNodePackage(doc:ProjectDocument,diagramId:string,nodeId:string,parentNodeId?:string):ProjectDocument{
 return withDiagram(doc,diagramId,d=>{
  const node=d.nodes.find(n=>n.id===nodeId)
  if(!node)throw new Error('Caja no encontrada')
  if(parentNodeId===nodeId)throw new Error('Un elemento no puede contenerse a sí mismo')
  const parent=parentNodeId?d.nodes.find(n=>n.id===parentNodeId):undefined
  const element=doc.elements[node.elementId]
  if(parentNodeId&&(!parent||!umlContainerAllows(d.type,doc.elements[parent.elementId]?.type,element.type)))throw new Error('Contenedor UML incompatible')
  if(parent&&node.parentNodeId===parent.id&&!(d.type==='uml-composite'&&element.type==='uml-port')&&!(d.type==='uml-sequence'&&sequenceIsAttachment(element.type)))return d
  const absolute=umlAbsolutePosition(d,node)
  const targetPosition=parent?umlAbsolutePosition(d,parent):{x:0,y:0}
  const size=parent?atlasNodeSize(d.type,doc.elements[parent.elementId],parent,umlNodeDepth(d,parent),d.nodes.some(x=>x.parentNodeId===parent.id)):null
  let x=absolute.x-targetPosition.x,y=absolute.y-targetPosition.y
  if(size){
   if(d.type==='uml-sequence'&&sequenceIsAttachment(element.type)){
    const childSize=atlasNodeSize(d.type,element,node,umlNodeDepth(d,node),false)
    ;({x,y}=sequenceSnapChild(doc.elements[parent!.elementId].type,element.type,size,childSize,y))
   }else if(d.type==='uml-composite'&&element.type==='uml-port')({x,y}=umlSnapPort(x,y,size.width,size.height))
   else{x=Math.max(0,Math.min(size.width-60,x));y=Math.max(0,Math.min(size.height-40,y))}
  }
  const changed={...node,parentNodeId:parent?.id,x:Math.round(x),y:Math.round(y)}
  const candidate={...d,nodes:d.nodes.map(n=>n.id===nodeId?changed:n)}
  if(!umlAncestryValid(candidate,changed,doc.elements))throw new Error('La jerarquía UML crearía un ciclo')
  return candidate
 })
}
