import {needsDetour} from '../domain/diagram-beautify'
import {routeDenseDiagram} from '../domain/density-router'
import type {RouteInput,RouteBox} from '../domain/density-router'
import {deploymentGlyph,deploymentEdgePresentation,deploymentCube,deploymentPort,deploymentFacingPort} from '@novzi/contracts'
import {componentGlyph,componentContract,componentAssemblyDirection,componentHandle} from '@novzi/contracts'
import {sequenceBox,sequenceGlyphMarkup,sequenceEdgeGeometry,sequenceFrameBounds,sequencePositionLocked} from '@novzi/contracts'
import {activityEdgeLabel,activityExceptionRoute,activityPort,activityFrameBounds,activityDisplayPosition,activityParameterLabel,activityMembershipLabel} from '@novzi/contracts'
import {useCaseExtensionNote} from '@novzi/contracts'
import {umlDisplayLabel,classPort,classFacingPort,classRelationRoute,classEndProperties,useCasePort} from '@novzi/contracts'
import {graphSelection} from '../domain/graph-selection'
import {parallelOffsets} from '../domain/parallel-edges'
import {useMemo} from 'react'
import {MarkerType} from '@xyflow/react'
import {isUmlDiagram,umlRelationNotation,UML_RELATIONS_BY_DIAGRAM,umlAbsolutePosition,umlNodeDepth,novziNodeSize,novziNodeMinimum,sequenceActivationPorts,sequenceRenderedHandle,sequenceActivationSide} from '@novzi/contracts'
import type {Node,Edge} from '@xyflow/react'
import type {Diagram,ProjectDocument,Perspective} from '@novzi/contracts'
import type {ManualRoute} from '../domain/manual-edge-routing'
export function useGraphView(input:{diagram:Diagram|null;doc:ProjectDocument|null;groups:string[];dependencies:boolean;includeUntagged?:boolean;mode:Perspective;selectedId:string|null;selectedNodeId?:string;canEdit:boolean;routeEditorEdgeId?:string|null;onManualRouteCommit?:(edgeId:string,route:ManualRoute|undefined)=>void;focusRelations?:boolean;focusedElementId?:string|null;onAdjustExecution?:(id:string,start:number,finish:number,expected:{start:number;finish:number})=>void;onResize?: (nodeId:string,width:number,height:number,x?:number,y?:number)=>void}){
 const {diagram,doc,groups,dependencies,includeUntagged=true,mode,selectedId,selectedNodeId,canEdit,onResize,onAdjustExecution,routeEditorEdgeId,onManualRouteCommit,focusRelations=false,focusedElementId}=input
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
   if(diagram.type==='uml-usecase'){const n=diagram.nodes.find(x=>x.id===nodeId),e=n&&doc.elements[n.elementId];if(e?.type==='usecase'&&e.useCaseDetail?.presentation!=='rectangle'||e?.type==='actor'&&e.useCaseDetail?.presentation!=='rectangle')return /^top-[123]$/.test(handle)?'top-2':/^bottom-[123]$/.test(handle)?'bottom-2':handle}
   if(diagram.type!=='uml-activity')return handle
   const n=diagram.nodes.find(x=>x.id===nodeId)
   const type=n?doc.elements[n.elementId]?.type:undefined
   if(!type||!['uml-decision','uml-start','uml-end','uml-flow-final'].includes(type))return handle
   return /^top-[123]$/.test(handle)?'top-2':/^bottom-[123]$/.test(handle)?'bottom-2':handle
  }
  const typeNames=['uml-class','uml-usecase','uml-activity','uml-component','uml-deployment'].includes(diagram.type)?Object.fromEntries(Object.values(doc.elements).map(e=>[e.id,e.name])):undefined
  const activityFrame=diagram.type==='uml-activity'?activityFrameBounds(doc,diagram):undefined
  const sequenceTyped=diagram.type==='uml-sequence'&&!!diagram.interaction
  const sequenceFrame=sequenceTyped&&diagram.interaction?.showFrame!==false?sequenceFrameBounds(doc,diagram):undefined
  const nodes:Node[]=[...visibleNodes].sort((a,b)=>umlNodeDepth(diagram,a)-umlNodeDepth(diagram,b)).map(n=>{
   const visibleParent=!!n.parentNodeId&&visibleIds.has(n.parentNodeId)&&!sequenceTyped
   const seqBox=sequenceTyped?sequenceBox(doc,diagram,n):undefined;const absolute=seqBox?{x:seqBox.x,y:seqBox.y}:diagram.type==='uml-activity'?activityDisplayPosition(doc,diagram,n,activityFrame):umlAbsolutePosition(diagram,n);const parent=n.parentNodeId?diagram.nodes.find(p=>p.id===n.parentNodeId):undefined;const base=parent&&umlAbsolutePosition(diagram,parent);const position=visibleParent&&base?{x:absolute.x-base.x,y:absolute.y-base.y}:absolute
   const element=doc.elements[n.elementId]
   const depth=umlNodeDepth(diagram,n)
   const size=seqBox||novziNodeSize(diagram.type,element,n,depth,visibleNodes.some(x=>x.parentNodeId===n.id))
   // Stored dimensions are the editable baseline for MIXED only. Other
   // perspectives use their actual content height while retaining width/position.
   // Nothing about this visual measurement changes the persisted document.
   const adaptiveCard=!isUmlDiagram(diagram.type)
   const cardMinHeight=adaptiveCard?(mode==='mixed'?size.height:novziNodeMinimum(diagram.type,element.type).height):undefined
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
    return Math.max(38,top+novziNodeSize(diagram.type,doc.elements[destruction.elementId],destruction).height/2)
   })():undefined
   return {
    id:n.id,type:'novzi',position,style:adaptiveCard?{width:size.width,minHeight:cardMinHeight}:{width:size.width,height:size.height},
    data:{element:n.childDiagramId===undefined?element:{...element,childDiagramId:n.childDiagramId||undefined,childNodeId:n.childNodeId||undefined},typeNames,elementId:n.elementId,adaptiveCard,cardMinHeight,...(diagram.type==='uml-deployment'?{componentGlyph:deploymentGlyph(doc,element,size,visibleNodes.some(x=>x.parentNodeId===n.id)),componentSize:size,deploymentCube:deploymentCube(doc,element)}:{}),...(diagram.type==='uml-component'?{componentGlyph:componentGlyph(element,size,typeNames||{},visibleNodes.some(x=>x.parentNodeId===n.id&&doc.elements[x.elementId]?.type!=='uml-port'),element.type==='component'?componentContract(doc,element.id):undefined),componentSize:size}:{}),...(seqBox?{sequenceGlyph:sequenceGlyphMarkup(doc,diagram,n,seqBox),sequenceSize:{width:seqBox.width,height:seqBox.height},sequencePositionLocked:sequencePositionLocked(doc,diagram,n),...(element.type==='uml-activation'&&element.sequenceDetail?.startOccurrenceId&&element.sequenceDetail?.finishOccurrenceId?{executionTimes:{start:diagram.interaction?.occurrences.find(o=>o.id===element.sequenceDetail!.startOccurrenceId)?.time,finish:diagram.interaction?.occurrences.find(o=>o.id===element.sequenceDetail!.finishOccurrenceId)?.time},onAdjustExecution}:{})}:{}),...(diagram.type==='uml-activity'?{activityMembership:activityMembershipLabel(doc,element),activityParameterLabel:element.type==='uml-activity-parameter'?activityParameterLabel(doc,diagram,element):undefined,activityParameter:element.type==='uml-activity-parameter'?diagram.activity?.parameters?.find(p=>p.id===element.activityDetail?.parameterId):undefined}:{}),ucAnnotationTarget:diagram.type==='uml-usecase'&&element.type==='uml-subject'&&diagram.edges.some(e=>allowedEdges.has(e.id)&&e.relationKind==='annotation'&&e.target===n.id),mode:isUmlDiagram(diagram.type)?'mixed':mode,graphType:diagram.type,nestingDepth:depth,childrenCount:visibleNodes.filter(x=>x.parentNodeId===n.id).length,sequenceEndY,sequenceActivationHeight:diagram.type==='uml-sequence'&&element.type==='uml-activation'?size.height:undefined,linkedDiagramType:doc.diagrams.find(d=>d.id===(n.childDiagramId===undefined?element.childDiagramId:n.childDiagramId))?.type,canResize:canEdit&&(!adaptiveCard||mode==='mixed'),onResize,minWidth:80,minHeight:60},
    ...(visibleParent?{parentId:n.parentNodeId,...((diagram.type==='uml-usecase'||diagram.type==='uml-activity'&&element.type==='uml-activity-pin'||['uml-composite','uml-component'].includes(diagram.type)&&element.type==='uml-port'||diagram.type==='uml-sequence'&&element.type==='uml-destruction')?{}:{extent:'parent' as const})}:{}),
    zIndex:sequenceTyped?(['uml-frame','uml-interaction'].includes(element.type)?0:element.type==='uml-lifeline'?1:3):['uml-package','uml-subpackage','uml-model','uml-profile','uml-subject','uml-partition','uml-activity-interruptible-region'].includes(element.type)||diagram.type==='uml-component'&&visibleNodes.some(x=>x.parentNodeId===n.id)||diagram.type==='uml-composite'&&element.type==='uml-class'?depth*10:depth*10+2,
    selected:selectedNodeId?selectedNodeId===n.id:selectedId===n.elementId,draggable:canEdit&&(!sequenceTyped||!sequencePositionLocked(doc,diagram,n))
   }
  })
  const defaultPaths:Partial<Record<Diagram['type'],'smoothstep'|'straight'|'step'|'bezier'>>={process:'step',sequence:'straight',trace:'straight',data:'smoothstep',c4:'bezier','uml-usecase':'straight','uml-sequence':'straight','uml-communication':'straight','uml-state':'smoothstep'}
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
   const nodeId=edge[role],handle=diagram.type==='uml-deployment'?classEndProperties(edge,role).handle:role==='source'?edge.sourceHandle:edge.targetHandle
   const node=activationNodes.get(nodeId)
   if(diagram.type==='uml-component')return componentHandle(handle,doc.elements[diagram.nodes.find(n=>n.id===nodeId)?.elementId||'']?.type==='uml-port')||(role==='source'?'right':'left');if(diagram.type!=='uml-sequence'||!node)return activityTipHandle(nodeId,handle|| (role==='source'?'right':'left'))
   const fallback=sequenceRenderedHandle(handle,role)
   const size=novziNodeSize(diagram.type,doc.elements[node.elementId],node)
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
  const bounds=(nodeId:string)=>{if(!visibleIds.has(nodeId))return undefined;const node=diagram.nodes.find(n=>n.id===nodeId);if(!node)return undefined;const el=doc.elements[node.elementId];if(!el)return undefined;const p=diagram.type==='uml-activity'?activityDisplayPosition(doc,diagram,node,activityFrame):umlAbsolutePosition(diagram,node),size=novziNodeSize(diagram.type,el,node,umlNodeDepth(diagram,node),visibleNodes.some(n=>n.parentNodeId===node.id));return {...p,...size,element:el}}
  const hub=(e:Diagram['edges'][number])=>{const a=bounds(e.source),b=bounds(e.target);if(!a||!b)return undefined;const from=diagram.type==='uml-activity'?activityPort(a,a.element,e.sourceHandle,true):diagram.type==='uml-usecase'?useCasePort(a,a.element,classEndProperties(e,'source').handle,true):diagram.type==='uml-deployment'?deploymentPort(a,deploymentCube(doc,a.element),classEndProperties(e,'source').handle,true):classPort(a,classEndProperties(e,'source').handle,true),to=diagram.type==='uml-activity'?activityPort(b,b.element,e.targetHandle,false):diagram.type==='uml-usecase'?useCasePort(b,b.element,classEndProperties(e,'target').handle,false):diagram.type==='uml-deployment'?deploymentPort(b,deploymentCube(doc,b.element),classEndProperties(e,'target').handle,false):classPort(b,classEndProperties(e,'target').handle,false),route=diagram.type==='uml-activity'&&e.relationKind==='exception-handler'?activityExceptionRoute(from,to):classRelationRoute({sourceX:from.x,sourceY:from.y,targetX:to.x,targetY:to.y,sourcePosition:from.side,targetPosition:to.side,offset:offsets.get(e.id)||0,pathStyle:e.pathStyle||(diagram.type==='uml-usecase'?'straight':'smoothstep')},e.source===e.target);return {x:route.labelX,y:route.labelY}}
  // Reserve lanes only when an edge REALLY needs to detour around obstacles.
  // Otherwise keep the visually shortest route and let the base path renderer work.
  const routeLanes=new Map<string,number>()
  const detourEdges=[...visibleEdges].map(relation=>{
   const a=bounds(relation.source),b=bounds(relation.target)
   if(!a||!b)return null
   const isAttached=(id:string,endpoint:string)=>{let n=diagram.nodes.find(x=>x.id===endpoint);const seen=new Set<string>();while(n?.parentNodeId&&!seen.has(n.id)){seen.add(n.id);if(n.parentNodeId===id)return true;n=diagram.nodes.find(x=>x.id===n?.parentNodeId)}return false}
   const obstacles=visibleNodes.filter(n=>n.id!==relation.source&&n.id!==relation.target&&!isAttached(n.id,relation.source)&&!isAttached(n.id,relation.target)).flatMap(n=>{const r=bounds(n.id);return r?[{id:n.id,x:r.x,y:r.y,width:r.width,height:r.height}]:[]})
   const from={x:a.x+a.width/2,y:a.y+a.height/2},to={x:b.x+b.width/2,y:b.y+b.height/2}
   const needs=!!relation.annotationTargetEdgeId?false:relation.source!==relation.target&&needsDetour(from,to,obstacles)
   return needs?{id:relation.id,source:relation.source,target:relation.target,x0:Math.min(from.x,to.x),x1:Math.max(from.x,to.x),y:(from.y+to.y)/2}:null
  }).filter(Boolean) as {id:string;source:string;target:string;x0:number;x1:number;y:number}[]
  const assigned:{id:string;x0:number;x1:number;y:number;source:string;target:string;lane:number}[]=[]
  for(const relation of detourEdges.sort((a,b)=>a.id.localeCompare(b.id))){
   const neighbors=assigned.filter(q=>{
    const samePair=(relation.source===q.source&&relation.target===q.target)||(relation.source===q.target&&relation.target===q.source)
    const overlappingCorridor=Math.min(relation.x1,q.x1)-Math.max(relation.x0,q.x0)>40&&Math.abs(relation.y-q.y)<55
    // A shared hub does NOT imply a shared wire. Otherwise thirty unrelated
    // spokes reserve thirty distant lanes and explode the diagram bounds.
    return isUmlDiagram(diagram.type)?samePair||overlappingCorridor||relation.source===q.source||relation.target===q.target:samePair||overlappingCorridor
   })
   const occupied=new Set(neighbors.map(q=>q.lane))
   let lane=0
   for(let n=0;n<=(isUmlDiagram(diagram.type)?24:8);n++){
    const trial=n===0?0:Math.ceil(n/2)*(n%2?1:-1)
    if(!occupied.has(trial)){lane=trial;break}
   }
   routeLanes.set(relation.id,lane)
   assigned.push({...relation,lane})
  }
  const denseRoutePlan= !isUmlDiagram(diagram.type)&&visibleEdges.length>=12&&visibleEdges.length<=90&&visibleNodes.length<=60?(()=>{
   const boxes:RouteBox[]=visibleNodes.flatMap(n=>{const r=bounds(n.id);return r?[{id:n.id,x:r.x,y:r.y,width:r.width,height:r.height}]:[]})
   const relations:RouteInput[]=visibleEdges.flatMap(edge=>{
    const a=bounds(edge.source),b=bounds(edge.target)
    if(!a||!b||edge.manualRoute?.points?.length)return []
    const from=classPort(a,edge.sourceHandle||'right',true),to=classPort(b,edge.targetHandle||'left',false)
    const family=`${edge.lineStyle||'solid'}:${edge.direction||'forward'}`
    return [{id:edge.id,source:edge.source,target:edge.target,from:{x:from.x,y:from.y},to:{x:to.x,y:to.y},sourceSide:from.side,targetSide:to.side,sourceBundleKey:`${edge.source}:${family}`,targetBundleKey:`${edge.target}:${family}`}]
   })
   return routeDenseDiagram(relations,boxes)
  })():null
  const edges:Edge[]=visibleEdges.map(raw=>{
   const e=diagram.type==='uml-deployment'?deploymentEdgePresentation(doc,diagram,raw):raw;
   const routeLane=routeLanes.get(e.id)||0
   const route=e.pathStyle||defaultPaths[diagram.type]||'smoothstep'
   const semantic=e.relationKind||(isUmlDiagram(diagram.type)?UML_RELATIONS_BY_DIAGRAM[diagram.type]?.[0]||'':'')
   const uml=isUmlDiagram(diagram.type)
   const sourceBounds=bounds(e.source),targetBounds=bounds(e.target)
   // Exclude the edge's own endpoints and their containers: crossing an enclosing
   // node's border is deliberate UML containment, not an obstacle.
   const isAttached=(id:string,endpoint:string)=>{let n=diagram.nodes.find(x=>x.id===endpoint);const seen=new Set<string>();while(n?.parentNodeId&&!seen.has(n.id)){seen.add(n.id);if(n.parentNodeId===id)return true;n=diagram.nodes.find(x=>x.id===n?.parentNodeId)}return false}
   const routeObstacles=sourceBounds&&targetBounds?visibleNodes.filter(n=>n.id!==e.source&&n.id!==e.target&&!isAttached(n.id,e.source)&&!isAttached(n.id,e.target)).flatMap(n=>{const r=bounds(n.id);return r?[{id:n.id,x:r.x,y:r.y,width:r.width,height:r.height}]:[]}):[]
   const notation=umlRelationNotation(semantic)
   const dashed=['include','extend','dependency','realization','import','merge','stereotype-application','manifestation','interaction-ref','required-interface'].includes(semantic)
   const noArrow=['association','link','assembly','connector','communication-path','containment','composition','aggregation'].includes(semantic)
   const relationLabel=diagram.type==='uml-activity'?activityEdgeLabel(diagram,e,doc):uml?umlDisplayLabel(diagram.type,e,doc,diagram):e.label||(['include','extend'].includes(semantic)?`«${semantic}»`:'')
   const classData=['uml-class','uml-usecase','uml-deployment'].includes(diagram.type)?(()=>{const source=classEndProperties(e,'source'),target=classEndProperties(e,'target'),center=hub(e),link=e.annotationTargetEdgeId&&visibleEdges.find(x=>x.id===e.annotationTargetEdgeId),cls=e.associationClassId&&visibleNodes.find(n=>n.elementId===e.associationClassId),box=cls?bounds(cls.id):undefined;return {sourceMultiplicity:source.multiplicity,targetMultiplicity:target.multiplicity,sourceRole:source.role,targetRole:target.role,sourceNavigability:source.navigability,targetNavigability:target.navigability,semanticDisplayLabel:relationLabel,extensionNote:diagram.type==='uml-usecase'?useCaseExtensionNote(doc,diagram,e):undefined,extraEnds:e.associationEnds?.slice(2).flatMap(end=>{const r=bounds(end.nodeId);if(!r||!center)return [];const p=diagram.type==='uml-deployment'?(end.handle?deploymentPort(r,deploymentCube(doc,r.element),end.handle,false):deploymentFacingPort(r,deploymentCube(doc,r.element),center)):end.handle?classPort(r,end.handle,false):classFacingPort(r,center);return [{...p,id:end.id,navigability:end.navigability,label:[end.role,end.multiplicity].filter(Boolean).join(' ')}]}),associationClassPoint:box&&center?classFacingPort(box,center):undefined,annotationPoint:link?hub(link):undefined}})():{}
   return ({
    id:e.id,source:e.source,target:e.target,sourceHandle:diagram.type==='uml-class'?classEndProperties(e,'source').handle||'right':sequenceHandle(e,'source'),targetHandle:diagram.type==='uml-usecase'&&e.relationKind==='annotation'&&doc.elements[diagram.nodes.find(n=>n.id===e.target)?.elementId||'']?.type==='uml-subject'?'uc-annotation':diagram.type==='uml-class'?classEndProperties(e,'target').handle||'left':sequenceHandle(e,'target'),label:relationLabel,
    type:uml?'novzi-uml':'novzi-parallel',
    ...(['uml-component','uml-deployment'].includes(diagram.type)?{zIndex:Math.max(1,Math.min(...[e.source,e.target].map(id=>{const n=diagram.nodes.find(x=>x.id===id);return n?umlNodeDepth(diagram,n):0}))*10+1)}:{}),
    data:uml?{routeObstacles:routeObstacles,routeLane,parallelOffset:offsets.get(e.id)||0,parallelPath:route,relationKind:semantic,diagramType:diagram.type,sourceElementType:doc.elements[diagram.nodes.find(n=>n.id===e.source)?.elementId||'']?.type,targetElementType:doc.elements[diagram.nodes.find(n=>n.id===e.target)?.elementId||'']?.type,sourceMultiplicity:e.sourceMultiplicity,targetMultiplicity:e.targetMultiplicity,sourceRole:e.sourceRole,targetRole:e.targetRole,wholeEnd:e.wholeEnd,sourceNavigability:e.sourceNavigability,targetNavigability:e.targetNavigability,...classData,...(diagram.type==='uml-component'?{componentAssembly:componentAssemblyDirection(doc,diagram,e),semanticDisplayLabel:relationLabel,extraEnds:e.componentEnds?.slice(2).flatMap(end=>{const r=bounds(end.nodeId),center=hub(e);if(!r||!center)return [];return [{...(end.handle?classPort(r,end.handle,false):classFacingPort(r,center)),id:end.id,label:''}]}),annotationPoint:e.annotationTargetEdgeId?(()=>{const target=visibleEdges.find(x=>x.id===e.annotationTargetEdgeId);return target?hub(target):undefined})():undefined}:{}),...(sequenceTyped?{sequenceGeometry:sequenceEdgeGeometry(doc,diagram,e)}:{}),...(diagram.type==='uml-activity'?{activityInterrupted:!!e.activityEdge?.interruptingRegionId&&e.relationKind!=='exception-handler',annotationPoint:e.annotationTargetEdgeId?(()=>{const target=visibleEdges.find(x=>x.id===e.annotationTargetEdgeId);return target?hub(target):undefined})():undefined}: {})}: {routeObstacles,routeLane,parallelOffset:offsets.get(e.id)||0,parallelPath:route,autoWaypoints:denseRoutePlan?.get(e.id)?.points.slice(1,-1),autoLabel:denseRoutePlan?.get(e.id)?{x:denseRoutePlan.get(e.id)!.labelX,y:denseRoutePlan.get(e.id)!.labelY}:undefined,manualRoute:e.manualRoute,routeEditing:routeEditorEdgeId===e.id,routeCanEdit:canEdit,onRouteCommit:onManualRouteCommit},
    animated:diagram.type==='sequence',
    labelStyle:{fontSize:11,fill:'#70809c',fontWeight:600},labelBgStyle:{fill:'#fff',fillOpacity:.95},
    style:{stroke:routeEditorEdgeId===e.id?'#2864e7':'#8e9cb0',strokeWidth:routeEditorEdgeId===e.id?3:1.7,opacity:focusRelations&&focusedElementId&&!visibleNodes.some(n=>n.elementId===focusedElementId&&(n.id===e.source||n.id===e.target))?.13:1,strokeDasharray:uml?notation.stroke==='dashed'?'7 5':notation.stroke==='dotted'?'2 5':undefined:e.lineStyle==='dashed'||!e.lineStyle&&dashed?'7 5':e.lineStyle==='dotted'?'2 5':undefined},
    markerEnd:uml?undefined:!noArrow&&(!e.direction||['forward','both'].includes(e.direction))?{type:['include','extend','dependency'].includes(semantic)?MarkerType.Arrow:MarkerType.ArrowClosed,color:'#8e9cb0',width:16,height:16}:undefined,
    markerStart:uml?undefined:!noArrow&&['reverse','both'].includes(e.direction||'forward')?{type:['include','extend','dependency'].includes(semantic)?MarkerType.Arrow:MarkerType.ArrowClosed,color:'#8e9cb0',width:16,height:16}:undefined
   })
  })
  if(sequenceFrame){let id=`novzi-sequence-frame:${diagram.id}`;while(diagram.nodes.some(n=>n.id===id))id+=':';nodes.unshift({id,type:'activity-frame',position:{x:sequenceFrame.x,y:sequenceFrame.y},data:{label:`sd ${diagram.name}`},style:{width:sequenceFrame.width,height:sequenceFrame.height,pointerEvents:'none'},zIndex:-1,draggable:false,selectable:false,connectable:false,deletable:false})}
  if(activityFrame){let id=`novzi-activity-frame:${diagram.id}`;while(diagram.nodes.some(n=>n.id===id))id+=':';nodes.unshift({id,type:'activity-frame',position:{x:activityFrame.x,y:activityFrame.y},data:{label:diagram.name},style:{width:activityFrame.width,height:activityFrame.height,pointerEvents:'none'},zIndex:-1,draggable:false,selectable:false,connectable:false,deletable:false})}
  return {nodes,edges}
 },[diagram,doc,groups,dependencies,includeUntagged,mode,selectedId,selectedNodeId,canEdit,onResize,onAdjustExecution,routeEditorEdgeId,onManualRouteCommit,focusRelations,focusedElementId])
}
