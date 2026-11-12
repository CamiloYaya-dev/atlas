/** Pure model operations used by the editor. Backend policy remains the authority. */
import type {Diagram,DiagramEdge,DiagramType,FieldDefinition,ModelElement,ProjectDocument} from '@atlas/contracts'

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
 return {...doc,diagrams:doc.diagrams.filter(d=>d.id!==id),elements:Object.fromEntries(Object.entries(doc.elements).map(([key,e])=>[key,e.childDiagramId===id?{...e,childDiagramId:undefined}:e]))}
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
export function removeElementNode(doc:ProjectDocument,diagramId:string,elementId:string):ProjectDocument{
 return withDiagram(doc,diagramId,d=>{
  const removed=new Set(d.nodes.filter(n=>n.elementId===elementId).map(n=>n.id))
  return {...d,nodes:d.nodes.filter(n=>!removed.has(n.id)),edges:d.edges.filter(e=>!removed.has(e.source)&&!removed.has(e.target))}
 })
}
export function connectNodes(doc:ProjectDocument,diagramId:string,edge:DiagramEdge):ProjectDocument{
 return withDiagram(doc,diagramId,d=>{
  if(edge.source===edge.target)throw new Error('Autoconexión no permitida')
  if(!d.nodes.some(n=>n.id===edge.source)||!d.nodes.some(n=>n.id===edge.target))throw new Error('Extremos inexistentes')
  if(d.edges.some(e=>e.id===edge.id||e.source===edge.source&&e.target===edge.target))throw new Error('Relación duplicada')
  return {...d,edges:[...d.edges,edge]}
 })
}
export function moveNode(doc:ProjectDocument,diagramId:string,nodeId:string,x:number,y:number):ProjectDocument{
 if(!Number.isFinite(x)||!Number.isFinite(y))throw new Error('Posición inválida')
 return withDiagram(doc,diagramId,d=>{
  if(!d.nodes.some(n=>n.id===nodeId))throw new Error('Nodo no encontrado')
  return {...d,nodes:d.nodes.map(n=>n.id===nodeId?{...n,x:Math.round(x),y:Math.round(y)}:n)}
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
