import {graphSelection} from '../domain/graph-selection'
import {useMemo} from 'react'
import {MarkerType} from '@xyflow/react'
import type {Node,Edge} from '@xyflow/react'
import type {Diagram,ProjectDocument,Perspective} from '@atlas/contracts'
export function useGraphView(input:{diagram:Diagram|null;doc:ProjectDocument|null;groups:string[];dependencies:boolean;mode:Perspective;selectedId:string|null;canEdit:boolean}){
 const {diagram,doc,groups,dependencies,mode,selectedId,canEdit}=input
 return useMemo(()=>{
  if(!diagram||!doc)return {nodes:[] as Node[],edges:[] as Edge[]}
  const {nodeIds,edgeIds}=graphSelection(diagram,doc,groups,dependencies)
  const allowed=new Set(nodeIds)
  const allowedEdges=new Set(edgeIds)
  const nodes:Node[]=diagram.nodes.filter(n=>allowed.has(n.id)&&doc.elements[n.elementId]).map(n=>({
   id:n.id,type:'atlas',position:{x:n.x,y:n.y},
   data:{element:doc.elements[n.elementId],elementId:n.elementId,mode,graphType:diagram.type},
   selected:selectedId===n.elementId,draggable:canEdit
  }))
  const edges:Edge[]=diagram.edges.filter(e=>allowedEdges.has(e.id)).map(e=>({
   id:e.id,source:e.source,target:e.target,label:e.label||'',type:'smoothstep',animated:diagram.type==='sequence',
   labelStyle:{fontSize:11,fill:'#70809c',fontWeight:600},
   labelBgStyle:{fill:'#fff',fillOpacity:.95},style:{stroke:'#8e9cb0',strokeWidth:1.7},
   markerEnd:{type:MarkerType.ArrowClosed,color:'#8e9cb0',width:16,height:16}
  }))
  return {nodes,edges}
 },[diagram,doc,groups,dependencies,mode,selectedId,canEdit])
}
