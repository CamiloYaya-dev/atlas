import {graphSelection} from '../domain/graph-selection'
import {parallelOffsets} from '../domain/parallel-edges'
import {useMemo} from 'react'
import {MarkerType} from '@xyflow/react'
import type {Node,Edge} from '@xyflow/react'
import type {Diagram,ProjectDocument,Perspective} from '@atlas/contracts'
export function useGraphView(input:{diagram:Diagram|null;doc:ProjectDocument|null;groups:string[];dependencies:boolean;includeUntagged?:boolean;mode:Perspective;selectedId:string|null;canEdit:boolean}){
 const {diagram,doc,groups,dependencies,includeUntagged=true,mode,selectedId,canEdit}=input
 return useMemo(()=>{
  if(!diagram||!doc)return {nodes:[] as Node[],edges:[] as Edge[]}
  const {nodeIds,edgeIds}=graphSelection(diagram,doc,groups,dependencies,includeUntagged)
  const allowed=new Set(nodeIds)
  const allowedEdges=new Set(edgeIds)
  const nodes:Node[]=diagram.nodes.filter(n=>allowed.has(n.id)&&doc.elements[n.elementId]).map(n=>({
   id:n.id,type:'atlas',position:{x:n.x,y:n.y},
   data:{element:doc.elements[n.elementId],elementId:n.elementId,mode,graphType:diagram.type,linkedDiagramType:doc.diagrams.find(d=>d.id===doc.elements[n.elementId].childDiagramId)?.type},
   selected:selectedId===n.elementId,draggable:canEdit
  }))
  const defaultPaths:Partial<Record<Diagram['type'],'smoothstep'|'straight'|'step'|'bezier'>>={process:'step',sequence:'straight',trace:'straight',data:'smoothstep',c4:'bezier'}
  const visibleEdges=diagram.edges.filter(e=>allowedEdges.has(e.id))
  const offsets=parallelOffsets(visibleEdges)
  const counts=new Map<string,number>()
  for(const e of visibleEdges){const key=[e.source,e.target].sort().join('\u0000');counts.set(key,(counts.get(key)||0)+1)}
  const edges:Edge[]=visibleEdges.map(e=>{
   const key=[e.source,e.target].sort().join('\u0000')
   const parallel=(counts.get(key)||0)>1
   const route=e.pathStyle||defaultPaths[diagram.type]||'smoothstep'
   return ({
   id:e.id,source:e.source,target:e.target,sourceHandle:e.sourceHandle||'right',targetHandle:e.targetHandle||'left',label:e.label||'',type:parallel?'atlas-parallel':route,
   data:parallel?{parallelOffset:offsets.get(e.id)||0,parallelPath:route}:undefined,animated:diagram.type==='sequence',
   labelStyle:{fontSize:11,fill:'#70809c',fontWeight:600},
   labelBgStyle:{fill:'#fff',fillOpacity:.95},style:{stroke:'#8e9cb0',strokeWidth:1.7,strokeDasharray:e.lineStyle==='dashed'?'7 5':e.lineStyle==='dotted'?'2 5':undefined},
   markerEnd:!e.direction||['forward','both'].includes(e.direction)?{type:MarkerType.ArrowClosed,color:'#8e9cb0',width:16,height:16}:undefined,
   markerStart:['reverse','both'].includes(e.direction||'forward')?{type:MarkerType.ArrowClosed,color:'#8e9cb0',width:16,height:16}:undefined
  })})
  return {nodes,edges}
 },[diagram,doc,groups,dependencies,includeUntagged,mode,selectedId,canEdit])
}
