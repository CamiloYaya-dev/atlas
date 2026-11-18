import type {Diagram,DiagramNode,ElementType} from './index'
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
/** Same dimensions used by the shared node sizing and semantic policy. */
export const sequenceFragmentSize=(type:ElementType,node?:Pick<DiagramNode,'width'|'height'>)=>({width:Math.max(type==='uml-frame'?260:220,node?.width??250),height:Math.max(type==='uml-frame'?160:78,node?.height??125)})
export const sequenceFragmentBox=(d:Diagram,n:DiagramNode,type:ElementType)=>({...umlAbsolutePosition(d,n),...sequenceFragmentSize(type,n)})
