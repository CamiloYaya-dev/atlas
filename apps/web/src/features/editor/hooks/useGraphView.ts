import {umlDisplayLabel,classPort,classFacingPort,classRelationRoute,classEndProperties} from '@atlas/contracts'
import {graphSelection} from '../domain/graph-selection'
import {parallelOffsets} from '../domain/parallel-edges'
import {useMemo} from 'react'
import {MarkerType} from '@xyflow/react'
import {isUmlDiagram,umlRelationNotation,UML_RELATIONS_BY_DIAGRAM,umlAbsolutePosition,umlNodeDepth,atlasNodeSize,sequenceActivationPorts,sequenceRenderedHandle,sequenceActivationSide} from '@atlas/contracts'
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
  // Old activity diagrams may use top-1/top-3/bottom-1/bottom-3.
  // Keep their saved JSON untouched, but display them on the unique UML tip.
  const activityTipHandle=(nodeId:string,handle:string)=>{
   if(diagram.type!=='uml-activity')return handle
   const n=diagram.nodes.find(x=>x.id===nodeId)
   const type=n?doc.elements[n.elementId]?.type:undefined
   if(!type||!['uml-decision','uml-start','uml-end','uml-flow-final'].includes(type))return handle
   return /^top-[123]$/.test(handle)?'top-2':/^bottom-[123]$/.test(handle)?'bottom-2':handle
  }
  const typeNames=diagram.type==='uml-class'?Object.fromEntries(Object.values(doc.elements).map(e=>[e.id,e.name])):undefined
  const nodes:Node[]=[...visibleNodes].sort((a,b)=>umlNodeDepth(diagram,a)-umlNodeDepth(diagram,b)).map(n=>{
   const visibleParent=!!n.parentNodeId&&visibleIds.has(n.parentNodeId)
   const position=visibleParent?{x:n.x,y:n.y}:umlAbsolutePosition(diagram,n)
   const element=doc.elements[n.elementId]
   const depth=umlNodeDepth(diagram,n)
   const size=atlasNodeSize(diagram.type,element,n,depth,visibleNodes.some(x=>x.parentNodeId===n.id))
   // UML: a lifeline terminates where its destruction marker is attached,
   // including when that marker belongs to the end of an activation.
   const sequenceEndY=diagram.type==='uml-sequence'&&['uml-lifeline','actor'].includes(element.type)?(()=>{
    const destruction=visibleNodes.find(candidate=>{
     if(doc.elements[candidate.elementId]?.type!=='uml-destruction')return false
     const direct=visibleNodes.find(parent=>parent.id===candidate.parentNodeId)
     return direct?.id===n.id||direct?.parentNodeId===n.id
    })
    if(!destruction)return undefined
    const parent=visibleNodes.find(item=>item.id===destruction.parentNodeId)
    const top=parent?.id===n.id?destruction.y:(parent?.y||0)+destruction.y
    return Math.max(38,top+atlasNodeSize(diagram.type,doc.elements[destruction.elementId],destruction).height/2)
   })():undefined
   return {
    id:n.id,type:'atlas',position,style:{width:size.width,height:size.height},
    data:{element,typeNames,elementId:n.elementId,mode:isUmlDiagram(diagram.type)?'mixed':mode,graphType:diagram.type,nestingDepth:depth,childrenCount:visibleNodes.filter(x=>x.parentNodeId===n.id).length,sequenceEndY,sequenceActivationHeight:diagram.type==='uml-sequence'&&element.type==='uml-activation'?size.height:undefined,linkedDiagramType:doc.diagrams.find(d=>d.id===element.childDiagramId)?.type,canResize:canEdit,onResize,minWidth:80,minHeight:60},
    ...(visibleParent?{parentId:n.parentNodeId,...((diagram.type==='uml-composite'&&element.type==='uml-port'||diagram.type==='uml-sequence'&&element.type==='uml-destruction')?{}:{extent:'parent' as const})}:{}),
    zIndex:['uml-package','uml-subpackage','uml-model','uml-profile','uml-subject','uml-partition'].includes(element.type)||diagram.type==='uml-composite'&&element.type==='uml-class'?depth*10:depth*10+2,
    selected:selectedId===n.elementId,draggable:canEdit
   }
  })
  const defaultPaths:Partial<Record<Diagram['type'],'smoothstep'|'straight'|'step'|'bezier'>>={process:'step',sequence:'straight',trace:'straight',data:'smoothstep',c4:'bezier','uml-sequence':'straight','uml-communication':'straight','uml-state':'smoothstep'}
  const visibleEdges=diagram.edges.filter(e=>allowedEdges.has(e.id))
  // Old UML sequence JSON may use the same lateral anchor for many messages
  // (or obsolete top/bottom activation handles). Fan these edges out at
  // different execution heights in the VIEW; do not rewrite persisted history.
  const activationNodes=new Map(visibleNodes.filter(n=>doc.elements[n.elementId]?.type==='uml-activation').map(n=>[n.id,n]))
  const legacyBuckets=new Map<string,string[]>()
  if(diagram.type==='uml-sequence'){
   for(const e of visibleEdges){
    for(const role of ['source','target'] as const){
     const nodeId=e[role],node=activationNodes.get(nodeId)
     if(!node)continue
     const handle=role==='source'?e.sourceHandle:e.targetHandle
     if(handle?.startsWith('seq-'))continue
     const side=sequenceActivationSide(handle,role)
     const key=`${nodeId}:${side}`
     const bucket=legacyBuckets.get(key)||[]
     bucket.push(e.id)
     legacyBuckets.set(key,bucket)
    }
   }
  }
  const sequenceHandle=(edge:Diagram['edges'][number],role:'source'|'target')=>{
   const nodeId=edge[role],handle=role==='source'?edge.sourceHandle:edge.targetHandle
   const node=activationNodes.get(nodeId)
   if(diagram.type!=='uml-sequence'||!node)return activityTipHandle(nodeId,handle|| (role==='source'?'right':'left'))
   const fallback=sequenceRenderedHandle(handle,role)
   const size=atlasNodeSize(diagram.type,doc.elements[node.elementId],node)
   const side=sequenceActivationSide(fallback,role)
   const ports=sequenceActivationPorts(size.height).filter(p=>p.side===side)
   if(fallback.startsWith('seq-'))return ports.some(p=>p.id===fallback)?fallback:ports[ports.length-1]?.id||side
   const bucket=legacyBuckets.get(`${nodeId}:${side}`)||[]
   if(bucket.length<2)return side
   const index=bucket.indexOf(edge.id)
   // Spread inherited relations evenly over all available lateral anchors.
   const pos=Math.max(0,Math.min(ports.length-1,Math.round((index+1)*ports.length/(bucket.length+1))-1))
   return ports[pos]?.id||side
  }
  const offsets=parallelOffsets(visibleEdges)
  const counts=new Map<string,number>()
  for(const e of visibleEdges){const key=[e.source,e.target].sort().join('\u0000');counts.set(key,(counts.get(key)||0)+1)}
  const bounds=(nodeId:string)=>{if(!visibleIds.has(nodeId))return undefined;const node=diagram.nodes.find(n=>n.id===nodeId);if(!node)return undefined;const el=doc.elements[node.elementId];if(!el)return undefined;const p=umlAbsolutePosition(diagram,node),size=atlasNodeSize(diagram.type,el,node,umlNodeDepth(diagram,node),visibleNodes.some(n=>n.parentNodeId===node.id));return {...p,...size}}
  const hub=(e:Diagram['edges'][number])=>{const a=bounds(e.source),b=bounds(e.target);if(!a||!b)return undefined;const from=classPort(a,classEndProperties(e,'source').handle,true),to=classPort(b,classEndProperties(e,'target').handle,false),route=classRelationRoute({sourceX:from.x,sourceY:from.y,targetX:to.x,targetY:to.y,sourcePosition:from.side,targetPosition:to.side,offset:offsets.get(e.id)||0,pathStyle:e.pathStyle||'smoothstep'},e.source===e.target);return {x:route.labelX,y:route.labelY}}
  const edges:Edge[]=visibleEdges.map(e=>{
   const key=[e.source,e.target].sort().join('\u0000')
   const parallel=(counts.get(key)||0)>1
   const route=e.pathStyle||defaultPaths[diagram.type]||'smoothstep'
   const semantic=e.relationKind||(isUmlDiagram(diagram.type)?UML_RELATIONS_BY_DIAGRAM[diagram.type]?.[0]||'':'')
   const uml=isUmlDiagram(diagram.type)
   const notation=umlRelationNotation(semantic)
   const dashed=['include','extend','dependency','realization','import','merge','stereotype-application','manifestation','interaction-ref','required-interface'].includes(semantic)
   const noArrow=['association','link','assembly','connector','communication-path','containment','composition','aggregation'].includes(semantic)
   const relationLabel=uml?umlDisplayLabel(diagram.type,e,doc,diagram):e.label||(['include','extend'].includes(semantic)?`«${semantic}»`:'')
   const classData=diagram.type==='uml-class'?(()=>{const source=classEndProperties(e,'source'),target=classEndProperties(e,'target'),center=hub(e),link=e.annotationTargetEdgeId&&visibleEdges.find(x=>x.id===e.annotationTargetEdgeId),cls=e.associationClassId&&visibleNodes.find(n=>n.elementId===e.associationClassId),box=cls?bounds(cls.id):undefined;return {sourceMultiplicity:source.multiplicity,targetMultiplicity:target.multiplicity,sourceRole:source.role,targetRole:target.role,sourceNavigability:source.navigability,targetNavigability:target.navigability,semanticDisplayLabel:relationLabel,extraEnds:e.associationEnds?.slice(2).flatMap(end=>{const r=bounds(end.nodeId);if(!r||!center)return [];const p=end.handle?classPort(r,end.handle,false):classFacingPort(r,center);return [{...p,id:end.id,navigability:end.navigability,label:[end.role,end.multiplicity].filter(Boolean).join(' ')}]}),associationClassPoint:box&&center?classFacingPort(box,center):undefined,annotationPoint:link?hub(link):undefined}})():{}
   return ({
    id:e.id,source:e.source,target:e.target,sourceHandle:diagram.type==='uml-class'?classEndProperties(e,'source').handle||'right':sequenceHandle(e,'source'),targetHandle:diagram.type==='uml-class'?classEndProperties(e,'target').handle||'left':sequenceHandle(e,'target'),label:relationLabel,
    type:uml?'atlas-uml':parallel?'atlas-parallel':route,
    data:uml?{parallelOffset:offsets.get(e.id)||0,parallelPath:route,relationKind:semantic,diagramType:diagram.type,sourceElementType:doc.elements[diagram.nodes.find(n=>n.id===e.source)?.elementId||'']?.type,targetElementType:doc.elements[diagram.nodes.find(n=>n.id===e.target)?.elementId||'']?.type,sourceMultiplicity:e.sourceMultiplicity,targetMultiplicity:e.targetMultiplicity,sourceRole:e.sourceRole,targetRole:e.targetRole,wholeEnd:e.wholeEnd,sourceNavigability:e.sourceNavigability,targetNavigability:e.targetNavigability,...classData}:parallel?{parallelOffset:offsets.get(e.id)||0,parallelPath:route}:undefined,
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
