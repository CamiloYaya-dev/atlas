import {BaseEdge,EdgeLabelRenderer,useReactFlow} from '@xyflow/react'
import type {EdgeProps} from '@xyflow/react'
import type {EdgePathStyle} from '@novzi/contracts'
import {useEffect,useRef,useState} from 'react'
import type {PointerEvent as ReactPointerEvent,KeyboardEvent as ReactKeyboardEvent} from 'react'
import {parallelRoute} from '../../features/editor/domain/parallel-edges'
import {needsDetour,obstacleRoute,distinctEdgeRoute} from '../../features/editor/domain/diagram-beautify'
import type {Rectangle} from '../../features/editor/domain/diagram-beautify'
import {editableRoute,enforcePortLegs,insertDogleg,isValidManualRoute,orthogonalize,polylinePath,privateWireSpans,removeRouteBend,shiftSegment,simplifyRoute,snapSegmentToPeers,toManualRoute} from '../../features/editor/domain/manual-edge-routing'
import type {ManualRoute,Point,SharedPeer} from '../../features/editor/domain/manual-edge-routing'

export type EdgeLabelPosition={mode:'manual';x:number;y:number}
type ParallelEdgeData={
 parallelOffset:number;parallelPath:EdgePathStyle;routeObstacles?:Rectangle[];routeLane?:number;
 manualRoute?:ManualRoute;autoWaypoints?:Point[];autoLabel?:Point;
 routeEditing?:boolean;routeCanEdit?:boolean;
 routePeers?:SharedPeer[];labelPosition?:EdgeLabelPosition;
 onRouteCommit?:(edgeId:string,route:ManualRoute|undefined)=>void;
 onLabelCommit?:(edgeId:string,position:EdgeLabelPosition|undefined)=>void
}
const buttonStyle={border:'1px solid #3d77e9',borderRadius:15,background:'#ffffff',color:'#245fca',fontSize:13,fontWeight:700,cursor:'grab',boxShadow:'0 1px 5px #38588730',width:22,height:22,padding:0} as const
const isFinitePoint=(p:Point)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<=1e6&&Math.abs(p.y)<=1e6

/** Editing does not mutate endpoints, IDs, semantic relations or other edges.
 * Every drag previews locally and emits exactly ONE document patch on pointer-up. */
export function NovziParallelEdge(props:EdgeProps){
 const data=props.data as ParallelEdgeData|undefined
 const flow=useReactFlow()
 const [draft,setDraft]=useState<Point[]|null>(null)
 const [labelDraft,setLabelDraft]=useState<Point|null>(null)
 const dragClean=useRef<(()=>void)|null>(null)
 useEffect(()=>()=>{dragClean.current?.()},[])
 useEffect(()=>{setDraft(null)},[data?.manualRoute,props.id,data?.routeEditing])
 useEffect(()=>{setLabelDraft(null)},[data?.labelPosition,props.id,data?.routeEditing])
 const route=parallelRoute({sourceX:props.sourceX,sourceY:props.sourceY,targetX:props.targetX,targetY:props.targetY,
  offset:data?.parallelOffset||0,pathStyle:data?.parallelPath||'bezier',sourcePosition:props.sourcePosition,targetPosition:props.targetPosition})
 const boxes=data?.routeObstacles||[]
 const start={x:props.sourceX,y:props.sourceY},end={x:props.targetX,y:props.targetY}
 const shouldRoute=!!data?.routeLane||boxes.length>0&&needsDetour(start,end,boxes)
 const smart=shouldRoute?(distinctEdgeRoute(start,end,boxes,{lane:data?.routeLane||0,sourceSide:props.sourcePosition,targetSide:props.targetPosition})||obstacleRoute(start,end,boxes)):null
 const original=smart||route
 const edit=!!data?.routeEditing&&!!data.routeCanEdit&&!!data.onRouteCommit
 const manual=data?.manualRoute&&isValidManualRoute(data.manualRoute)?data.manualRoute:undefined
 const fallback=manual||(data?.autoWaypoints?.length?{version:1 as const,points:data.autoWaypoints}:undefined)
 // Curves retain their usual tangents until the user starts editing. For all
 // other routes, guarantee the mandatory outward legs at both box ports.
 const keepCurve=!edit&&!fallback&&!smart&&data?.parallelPath==='bezier'
 const generated=keepCurve?null:enforcePortLegs(editableRoute(start,end,fallback,props.sourcePosition,props.targetPosition,original.path),props.sourcePosition,props.targetPosition)
 const points=draft||generated
 const visual=points?polylinePath(points):original
 const peerRoutes=data?.routePeers||[]
 const labelPosition=data?.labelPosition
 const autoLabel=data?.autoLabel&&!manual&&!draft?data.autoLabel:{x:visual.labelX,y:visual.labelY}
 const label=labelDraft??(labelPosition?.mode==='manual'?{x:labelPosition.x,y:labelPosition.y}:autoLabel)
 const labelCanEdit=edit&&!!data?.onLabelCommit&&props.label!==undefined&&String(props.label).trim()!==''
 const commit=(next:Point[]|null)=>{
  if(!data?.onRouteCommit)return
  try{
   if(!next){data.onRouteCommit(props.id,undefined);return}
   const orthogonal=orthogonalize(next,props.sourcePosition,props.targetPosition)
   const safe=enforcePortLegs(orthogonal,props.sourcePosition,props.targetPosition)
   data.onRouteCommit(props.id,toManualRoute(safe))
  }catch(error){console.warn('No se pudo ajustar recorrido:',error)}
 }
 const commitLabel=(next:Point|null)=>{
  if(!data?.onLabelCommit)return
  if(next&&isFinitePoint(next))data.onLabelCommit(props.id,{mode:'manual',x:Math.round(next.x),y:Math.round(next.y)})
  else if(next===null)data.onLabelCommit(props.id,undefined)
 }
 const beginDrag=(event:ReactPointerEvent<HTMLButtonElement>,part:'segment'|'point',index:number)=>{
  if(!edit||!points)return
  event.stopPropagation();event.preventDefault()
  dragClean.current?.()
  const base=points.map(p=>({...p})),origin=flow.screenToFlowPosition({x:event.clientX,y:event.clientY})
  let moved=false,latest=base
  const move=(pointer:PointerEvent)=>{
   const p=flow.screenToFlowPosition({x:pointer.clientX,y:pointer.clientY})
   const dx=p.x-origin.x,dy=p.y-origin.y
   if(Math.abs(dx)+Math.abs(dy)<3&&!moved)return
   moved=true
   if(part==='segment'){
    const a=base[index],b=base[index+1]
    const offset=a.y===b.y?dy:dx
    latest=snapSegmentToPeers(base,index,offset,peerRoutes).points
   }else{
    latest=base.map((item,i)=>i===index?{x:Math.round(item.x+dx),y:Math.round(item.y+dy)}:item)
    latest=orthogonalize(latest,props.sourcePosition,props.targetPosition)
   }
   // Keep the real source/target ports anchored even while the mouse moves.
   latest=enforcePortLegs(latest,props.sourcePosition,props.targetPosition)
   setDraft(latest)
  }
  const cancel=()=>{
   window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',cancel)
   dragClean.current=null;setDraft(null)
  }
  const stop=()=>{cancel();if(moved)commit(latest)}
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',stop);window.addEventListener('pointercancel',cancel)
  dragClean.current=cancel
 }
 const beginLabelDrag=(event:ReactPointerEvent<HTMLDivElement>)=>{
  if(!labelCanEdit)return
  event.stopPropagation();event.preventDefault();dragClean.current?.()
  const startMouse=flow.screenToFlowPosition({x:event.clientX,y:event.clientY}),startLabel={...label}
  let moved=false,latest=startLabel
  const move=(pointer:PointerEvent)=>{
   const p=flow.screenToFlowPosition({x:pointer.clientX,y:pointer.clientY})
   if(Math.abs(p.x-startMouse.x)+Math.abs(p.y-startMouse.y)<2&&!moved)return
   moved=true;latest={x:startLabel.x+p.x-startMouse.x,y:startLabel.y+p.y-startMouse.y}
   if(isFinitePoint(latest))setLabelDraft(latest)
  }
  const cancel=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',cancel);dragClean.current=null;setLabelDraft(null)}
  const stop=()=>{cancel();if(moved)commitLabel(latest)}
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',stop);window.addEventListener('pointercancel',cancel)
  dragClean.current=cancel
 }
 const onLabelKey=(event:ReactKeyboardEvent<HTMLDivElement>)=>{
  if(!labelCanEdit)return
  const step=event.shiftKey?20:5
  const change=event.key==='ArrowLeft'?{x:-step,y:0}:event.key==='ArrowRight'?{x:step,y:0}:event.key==='ArrowUp'?{x:0,y:-step}:event.key==='ArrowDown'?{x:0,y:step}:null
  if(change){event.stopPropagation();event.preventDefault();commitLabel({x:label.x+change.x,y:label.y+change.y})}
 }
 // Shared compatible stretches receive no opaque white separator. Every edge
 // still draws its own BaseEdge, keeps its own arrowheads and is selectable.
 const halos=points&&peerRoutes.length?privateWireSpans(points,peerRoutes):null
 return <>
  {halos?halos.map((s,i)=><path key={`halo-${i}`} d={`M ${s.a.x} ${s.a.y} L ${s.b.x} ${s.b.y}`} fill="none" stroke="#f7faff" strokeWidth={5.3} strokeLinejoin="round" strokeLinecap="round" pointerEvents="none"/>):<path d={visual.path} fill="none" stroke="#f7faff" strokeWidth={5.3} strokeLinejoin="round" strokeLinecap="round" pointerEvents="none"/>}
  <BaseEdge id={props.id} path={visual.path} style={props.style} markerStart={props.markerStart} markerEnd={props.markerEnd} interactionWidth={26}/>
  {props.label!==undefined&&String(props.label).trim()!==''&&<EdgeLabelRenderer>
   <div className={`novzi-parallel-edge-label${labelCanEdit?' nodrag nopan':''}`} style={{transform:`translate(-50%,-50%) translate(${label.x}px,${label.y}px)`,pointerEvents:labelCanEdit?'all':'none',cursor:labelCanEdit?'grab':undefined,userSelect:'none'}}
    {...(labelCanEdit?{role:'button' as const,tabIndex:0,'aria-label':`Mover nombre o protocolo: ${String(props.label)}`}: {})}
    onPointerDown={beginLabelDrag} onKeyDown={onLabelKey}>{props.label}</div>
  </EdgeLabelRenderer>}
  {edit&&points&&<EdgeLabelRenderer>
   <div className="novzi-route-controls nodrag nopan" role="group" aria-label={`Editar recorrido de relación ${props.id}`} style={{pointerEvents:'none'}}>
    {points.slice(1,-1).map((p,i)=><div key={`waypoint-${i}`}>
     <button className="nodrag nopan" type="button" aria-label={`Mover giro ${i+1}`} title="Arrastra el punto de giro" style={{...buttonStyle,pointerEvents:'all',width:15,height:15,borderRadius:4,background:'#fee58a',position:'absolute',transform:`translate(-50%,-50%) translate(${p.x}px,${p.y}px)`}} onPointerDown={event=>beginDrag(event,'point',i+1)} onClick={event=>event.stopPropagation()}/>
     <button className="nodrag nopan" type="button" aria-label={`Eliminar giro ${i+1}`} title="Quitar este giro sin desconectar la relación" style={{...buttonStyle,pointerEvents:'all',width:17,height:17,cursor:'pointer',color:'#a23f3f',borderColor:'#d39c9c',position:'absolute',transform:`translate(-50%,-50%) translate(${p.x+15}px,${p.y-17}px)`}} onClick={event=>{event.stopPropagation();commit(removeRouteBend(points,i+1,props.sourcePosition,props.targetPosition))}}>−</button>
    </div>)}
    {points.slice(0,-1).map((p,i)=>{
     const to=points[i+1],x=(p.x+to.x)/2,y=(p.y+to.y)/2
     if(points.length>25)return null
     return <button key={`segment-${i}`} className="nodrag nopan" type="button" aria-label={`Mover tramo ${i+1}`} title="Arrastra el tramo; se alinea con líneas del mismo tipo" style={{...buttonStyle,pointerEvents:'all',position:'absolute',transform:`translate(-50%,-50%) translate(${x}px,${y}px)`}} onPointerDown={event=>beginDrag(event,'segment',i)} onClick={event=>event.stopPropagation()}>{p.y===to.y?'↕':'↔'}</button>
    })}
    {points.length<24&&<button className="nodrag nopan" type="button" aria-label="Agregar giro en la relación" title="Crear un desvío" style={{...buttonStyle,position:'absolute',pointerEvents:'all',background:'#dceaff',transform:`translate(-50%,-50%) translate(${visual.labelX+35}px,${visual.labelY+36}px)`}} onClick={event=>{event.stopPropagation();const i=Math.max(0,Math.floor((points.length-1)/2));commit(insertDogleg(points,i,40))}}>+</button>}
    <button className="nodrag nopan" type="button" aria-label="Simplificar recorrido" title="Eliminar desvíos innecesarios manteniendo los puertos" style={{...buttonStyle,position:'absolute',pointerEvents:'all',cursor:'pointer',width:27,transform:`translate(-50%,-50%) translate(${visual.labelX+66}px,${visual.labelY+36}px)`}} onClick={event=>{event.stopPropagation();commit(simplifyRoute(points,props.sourcePosition,props.targetPosition))}}>⇥</button>
    {manual&&<button className="nodrag nopan" type="button" aria-label="Restablecer recorrido automático" title="Volver al recorrido automático" style={{...buttonStyle,position:'absolute',pointerEvents:'all',cursor:'pointer',color:'#a23f3f',borderColor:'#c87878',transform:`translate(-50%,-50%) translate(${visual.labelX+99}px,${visual.labelY+36}px)`}} onClick={event=>{event.stopPropagation();commit(null)}}>×</button>}
    {labelPosition?.mode==='manual'&&<button className="nodrag nopan" type="button" aria-label="Restablecer posición del nombre o protocolo" title="Centrar automáticamente el nombre/protocolo" style={{...buttonStyle,position:'absolute',pointerEvents:'all',cursor:'pointer',width:26,transform:`translate(-50%,-50%) translate(${label.x+25}px,${label.y-26}px)`}} onClick={event=>{event.stopPropagation();commitLabel(null)}}>↺</button>}
   </div>
  </EdgeLabelRenderer>}
 </>
}
export const edgeTypes={'novzi-parallel':NovziParallelEdge}
