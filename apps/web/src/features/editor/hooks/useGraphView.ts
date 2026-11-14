import {graphSelection} from '../domain/graph-selection'
import {parallelOffsets} from '../domain/parallel-edges'
import {useMemo} from 'react'
import {MarkerType} from '@xyflow/react'
import {isUmlDiagram,umlRelationNotation,UML_RELATIONS_BY_DIAGRAM,umlAbsolutePosition,umlNodeDepth,atlasNodeSize} from '@atlas/contracts'
import type {Node,Edge} from '@xyflow/react'
import type {Diagram,ProjectDocument,Perspective} from '@atlas/contracts'
export function useGraphView(input:{diagram:Diagram|null;doc:ProjectDocument|null;groups:string[];dependencies:boolean;includeUntagged?:boolean;mode:Perspective;selectedId:string|null;canEdit:boolean;onResize?: (nodeId:string,width:number,height:number,x?:number,y?:number)=>void}){
 const {diagram,doc,groups,dependencies,includeUntagged=true,mode,selectedId,canEdit,onResize}=input
 return useMemo(()=>{
  if(!diagram||!doc)return {nodes:[] as Node[],edges:[] as Edge[]}
  const {nodeIds,edgeIds}=graphSelection(diagram,doc,groups,dependencies,includeUntagged)
  const allowed=new Set(nodeIds)
  const allowedEdges=new Set(edgeIds)
  const visibleNodes=diagram.nodes.filter(n=>allowed.has(n.id)&&doc.elements[n.elementId])
  const visibleIds=new Set(visibleNodes.map(n=>n.id))
  // React Flow requires every parent before its children, including nested packages.
  const nodes:Node[]=[...visibleNodes].sort((a,b)=>umlNodeDepth(diagram,a)-umlNodeDepth(diagram,b)).map(n=>{
   const visibleParent=!!n.parentNodeId&&visibleIds.has(n.parentNodeId)
   const position=visibleParent?{x:n.x,y:n.y}:umlAbsolutePosition(diagram,n)
   const element=doc.elements[n.elementId]
   const depth=umlNodeDepth(diagram,n)
   const size=atlasNodeSize(diagram.type,element,n,depth,visibleNodes.some(x=>x.parentNodeId===n.id))
   return {
    id:n.id,type:'atlas',position,style:{width:size.width,height:size.height},
    data:{element,elementId:n.elementId,mode,graphType:diagram.type,nestingDepth:depth,childrenCount:visibleNodes.filter(x=>x.parentNodeId===n.id).length,linkedDiagramType:doc.diagrams.find(d=>d.id===element.childDiagramId)?.type,canResize:canEdit,onResize,minWidth:80,minHeight:60},
    ...(visibleParent?{parentId:n.parentNodeId,...(diagram.type==='uml-composite'&&element.type==='uml-port'?{}:{extent:'parent' as const})}:{}),
    zIndex:element.type==='uml-package'||diagram.type==='uml-composite'&&element.type==='uml-class'?depth*10:depth*10+2,
    selected:selectedId===n.elementId,draggable:canEdit
   }
  })
  const defaultPaths:Partial<Record<Diagram['type'],'smoothstep'|'straight'|'step'|'bezier'>>={process:'step',sequence:'straight',trace:'straight',data:'smoothstep',c4:'bezier'}
  const visibleEdges=diagram.edges.filter(e=>allowedEdges.has(e.id))
  const offsets=parallelOffsets(visibleEdges)
  const counts=new Map<string,number>()
  for(const e of visibleEdges){const key=[e.source,e.target].sort().join('\u0000');counts.set(key,(counts.get(key)||0)+1)}
  const edges:Edge[]=visibleEdges.map(e=>{
   const key=[e.source,e.target].sort().join('\u0000')
   const parallel=(counts.get(key)||0)>1
   const route=e.pathStyle||defaultPaths[diagram.type]||'smoothstep'
   const semantic=e.relationKind||(isUmlDiagram(diagram.type)?UML_RELATIONS_BY_DIAGRAM[diagram.type]?.[0]||'':'')
   const uml=isUmlDiagram(diagram.type)
   const notation=umlRelationNotation(semantic)
   const dashed=['include','extend','dependency','realization','import','merge','stereotype-application','manifestation','interaction-ref','required-interface'].includes(semantic)
   const noArrow=['association','link','assembly','connector','communication-path','containment','composition','aggregation'].includes(semantic)
   const relationLabel=e.label||(uml?notation.label||'':(['include','extend'].includes(semantic)?`«${semantic}»`:''))
   return ({
    id:e.id,source:e.source,target:e.target,sourceHandle:e.sourceHandle||'right',targetHandle:e.targetHandle||'left',label:relationLabel,
    type:uml?'atlas-uml':parallel?'atlas-parallel':route,
    data:uml?{parallelOffset:offsets.get(e.id)||0,parallelPath:route,relationKind:semantic,diagramType:diagram.type,sourceElementType:doc.elements[diagram.nodes.find(n=>n.id===e.source)?.elementId||'']?.type,targetElementType:doc.elements[diagram.nodes.find(n=>n.id===e.target)?.elementId||'']?.type,sourceMultiplicity:e.sourceMultiplicity,targetMultiplicity:e.targetMultiplicity,sourceRole:e.sourceRole,targetRole:e.targetRole}:parallel?{parallelOffset:offsets.get(e.id)||0,parallelPath:route}:undefined,
    animated:diagram.type==='sequence',
    labelStyle:{fontSize:11,fill:'#70809c',fontWeight:600},labelBgStyle:{fill:'#fff',fillOpacity:.95},
    style:{stroke:'#8e9cb0',strokeWidth:1.7,strokeDasharray:uml?notation.stroke==='dashed'?'7 5':notation.stroke==='dotted'?'2 5':undefined:e.lineStyle==='dashed'||!e.lineStyle&&dashed?'7 5':e.lineStyle==='dotted'?'2 5':undefined},
    markerEnd:uml?undefined:!noArrow&&(!e.direction||['forward','both'].includes(e.direction))?{type:['include','extend','dependency'].includes(semantic)?MarkerType.Arrow:MarkerType.ArrowClosed,color:'#8e9cb0',width:16,height:16}:undefined,
    markerStart:uml?undefined:!noArrow&&['reverse','both'].includes(e.direction||'forward')?{type:['include','extend','dependency'].includes(semantic)?MarkerType.Arrow:MarkerType.ArrowClosed,color:'#8e9cb0',width:16,height:16}:undefined
   })
  })
  return {nodes,edges}
 },[diagram,doc,groups,dependencies,includeUntagged,mode,selectedId,canEdit,onResize])
}
