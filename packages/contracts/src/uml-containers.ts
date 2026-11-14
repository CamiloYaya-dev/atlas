/** Contención gráfica, sin confundirla con una relación UML.
 * Las posiciones hijas son relativas al contenedor; se preservan en JSON.
 */
import type {Diagram,DiagramNode,DiagramType,ElementType,ModelElement} from './index'

export const UML_PACKAGE_SIZE={width:780,height:520} as const
export const UML_COMPOSITE_SIZE={width:780,height:520} as const
export const UML_PART_SIZE={width:260,height:118} as const
export const UML_PORT_SIZE={width:180,height:82} as const
export const UML_DEPLOYMENT_CONTAINER_SIZE={width:570,height:370} as const
export const UML_EXECUTION_CONTAINER_SIZE={width:360,height:235} as const
export function umlContainerAllows(diagram:DiagramType,parent:ElementType,child:ElementType):boolean{
 if(diagram==='uml-composite'){
  if(parent==='uml-class')return ['uml-part','uml-reference-role','uml-port','uml-collaboration','uml-interface'].includes(child)
  if(parent==='uml-part')return child==='uml-port'
  return false
 }
 if(diagram==='uml-deployment'){
  if(parent==='uml-node'||parent==='uml-device')return ['uml-node','uml-execution','uml-artifact'].includes(child)
  if(parent==='uml-execution')return child==='uml-artifact'
  return false
 }
 if(diagram==='uml-package')return parent==='uml-package'&&child==='uml-package' 
 if(['uml-class','uml-object','uml-component'].includes(diagram))return parent==='uml-package'&&child!=='uml-package'
 return false
}
export function umlContainerSize(kind:ElementType,depth=0){
 if(kind==='uml-port')return UML_PORT_SIZE
 if(kind==='uml-reference-role')return UML_PART_SIZE
 if(kind==='uml-part')return UML_PART_SIZE
 if(kind==='uml-node'||kind==='uml-device')return UML_DEPLOYMENT_CONTAINER_SIZE
 if(kind==='uml-execution')return UML_EXECUTION_CONTAINER_SIZE
 if(kind==='uml-class')return UML_COMPOSITE_SIZE
 if(kind==='uml-package'&&depth>=2)return {width:300,height:195}
 if(kind==='uml-package'&&depth===1)return {width:460,height:315}
 return UML_PACKAGE_SIZE
}
export function umlNodeDepth(diagram:Diagram,node:DiagramNode):number{
 let depth=0,ptr=node.parentNodeId;const visited=new Set([node.id])
 while(ptr&&!visited.has(ptr)){const p=diagram.nodes.find(n=>n.id===ptr);if(!p)break;depth++;visited.add(ptr);ptr=p.parentNodeId}
 return depth
}
export function umlAbsolutePosition(diagram:Diagram,node:DiagramNode):{x:number;y:number}{
 let x=node.x,y=node.y,parentId=node.parentNodeId
 const visited=new Set([node.id])
 while(parentId){
  if(visited.has(parentId))break
  visited.add(parentId)
  const parent=diagram.nodes.find(n=>n.id===parentId)
  if(!parent)break
  x+=parent.x;y+=parent.y;parentId=parent.parentNodeId
 }
 return {x,y}
}
export function umlAncestryValid(diagram:Diagram,node:DiagramNode,elements:Record<string,ModelElement>):boolean{
 const visited=new Set([node.id]);let current=node,depth=0
 while(current.parentNodeId){
  const parent=diagram.nodes.find(n=>n.id===current.parentNodeId)
  if(!parent||visited.has(parent.id)||++depth>8)return false
  const parentElement=elements[parent.elementId],child=elements[current.elementId]
  if(!parentElement||!child||!umlContainerAllows(diagram.type,parentElement.type,child.type))return false
  visited.add(parent.id);current=parent
 }
 return true
}
/** Coloca una tarjeta de puerto cruzando el borde de su clasificador o parte.
 * En UML el punto de interacción pertenece al borde, no al centro del nodo.
 */
export function umlSnapPort(x:number,y:number,containerWidth:number,containerHeight:number){
 const w=UML_PORT_SIZE.width,h=UML_PORT_SIZE.height
 const distances=[{side:'left',dist:Math.abs(x+w/2),x:-w/2,y},
  {side:'right',dist:Math.abs(x+w/2-containerWidth),x:containerWidth-w/2,y},
  {side:'top',dist:Math.abs(y+h/2),x,y:-h/2},
  {side:'bottom',dist:Math.abs(y+h/2-containerHeight),x,y:containerHeight-h/2}]
 const best=distances.sort((a,b)=>a.dist-b.dist)[0]
 return {x:Math.round(Math.max(-w/2,Math.min(containerWidth-w/2,best.x))),y:Math.round(Math.max(-h/2,Math.min(containerHeight-h/2,best.y)))}
}
