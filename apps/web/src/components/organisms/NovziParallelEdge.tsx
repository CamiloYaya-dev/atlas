import {BaseEdge,EdgeLabelRenderer,useReactFlow} from '@xyflow/react'
import type {EdgeProps} from '@xyflow/react'
import type {EdgePathStyle} from '@novzi/contracts'
import {useEffect,useRef,useState} from 'react'
import type {PointerEvent as ReactPointerEvent} from 'react'
import {parallelRoute} from '../../features/editor/domain/parallel-edges'
import {needsDetour,obstacleRoute,distinctEdgeRoute} from '../../features/editor/domain/diagram-beautify'
import type {Rectangle} from '../../features/editor/domain/diagram-beautify'
import {editableRoute,insertDogleg,isValidManualRoute,orthogonalize,polylinePath,shiftSegment,toManualRoute} from '../../features/editor/domain/manual-edge-routing'
import type {ManualRoute,Point} from '../../features/editor/domain/manual-edge-routing'

type ParallelEdgeData={parallelOffset:number;parallelPath:EdgePathStyle;routeObstacles?:Rectangle[];routeLane?:number;manualRoute?:ManualRoute;autoWaypoints?:Point[];autoLabel?:Point;routeEditing?:boolean;routeCanEdit?:boolean;onRouteCommit?:(edgeId:string,route:ManualRoute|undefined)=>void}
const buttonStyle={border:'1px solid #3d77e9',borderRadius:15,background:'#ffffff',color:'#245fca',fontSize:13,fontWeight:700,cursor:'grab',boxShadow:'0 1px 5px #38588730',width:22,height:22,padding:0} as const
/** Editable orthogonal wire. Every mouse-move is local preview; ONE patch on pointer-up. */
export function NovziParallelEdge(props:EdgeProps){
 const data=props.data as ParallelEdgeData|undefined
 const flow=useReactFlow()
 const [draft,setDraft]=useState<Point[]|null>(null)
 const draftRef=useRef<Point[]|null>(null)
 const dragClean=useRef<(()=>void)|null>(null)
 useEffect(()=>()=>{dragClean.current?.()},[])
 useEffect(()=>{setDraft(null);draftRef.current=null},[data?.manualRoute,props.id,data?.routeEditing])
 const route=parallelRoute({sourceX:props.sourceX,sourceY:props.sourceY,targetX:props.targetX,targetY:props.targetY,
  offset:data?.parallelOffset||0,pathStyle:data?.parallelPath||'bezier',sourcePosition:props.sourcePosition,targetPosition:props.targetPosition})
 const boxes=data?.routeObstacles||[]
 const start={x:props.sourceX,y:props.sourceY},end={x:props.targetX,y:props.targetY}
 const shouldRoute=!!data?.routeLane||boxes.length&&needsDetour(start,end,boxes)
 const smart=shouldRoute?(distinctEdgeRoute(start,end,boxes,{lane:data?.routeLane||0,sourceSide:props.sourcePosition,targetSide:props.targetPosition})||obstacleRoute(start,end,boxes)):null
 const original=smart||route
 const edit=!!data?.routeEditing&&!!data.routeCanEdit&&!!data.onRouteCommit
 const manual=data?.manualRoute&&isValidManualRoute(data.manualRoute)?data.manualRoute:undefined
 const fallback=manual||(data?.autoWaypoints?.length?{version:1 as const,points:data.autoWaypoints}:undefined)
 const waypoints=edit||fallback?editableRoute(start,end,fallback,props.sourcePosition,props.targetPosition,original.path):null
 const points=draft||waypoints
 const visual=points?polylinePath(points):original
 const label=data?.autoLabel&&!manual&&!draft?{x:data.autoLabel.x,y:data.autoLabel.y}:{x:visual.labelX,y:visual.labelY}
 const commit=(next:Point[]|null)=>{
  if(!data?.onRouteCommit)return
  try{data.onRouteCommit(props.id,next?toManualRoute(orthogonalize(next,props.sourcePosition,props.targetPosition)):undefined)}catch(error){console.warn('No se pudo ajustar recorrido:',error)}
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
    latest=shiftSegment(base,index,a.y===b.y?dy:dx)
   }else{
    latest=base.map((item,i)=>i===index?{x:Math.round(item.x+dx),y:Math.round(item.y+dy)}:item)
    latest=orthogonalize(latest,props.sourcePosition,props.targetPosition)
   }
   draftRef.current=latest;setDraft(latest)
  }
  const stop=()=>{
   window.removeEventListener('pointermove',move)
   window.removeEventListener('pointerup',stop)
   window.removeEventListener('pointercancel',cancel)
   dragClean.current=null
   if(moved)commit(latest)
   draftRef.current=null;setDraft(null)
  }
  const cancel=()=>{
   window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',cancel)
   dragClean.current=null;draftRef.current=null;setDraft(null)
  }
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',stop);window.addEventListener('pointercancel',cancel)
  dragClean.current=cancel
 }
 return <>
  {/* Pale edge halo separates intersecting cables without merging paths. */}
  <path d={visual.path} fill="none" stroke="#f7faff" strokeWidth={5.3} strokeLinejoin="round" strokeLinecap="round" pointerEvents="none"/>
  <BaseEdge id={props.id} path={visual.path} style={props.style} markerStart={props.markerStart} markerEnd={props.markerEnd} interactionWidth={26}/>
  {props.label!==undefined&&String(props.label).trim()!==''&&<EdgeLabelRenderer>
   <div className="novzi-parallel-edge-label" style={{transform:`translate(-50%,-50%) translate(${label.x}px,${label.y}px)`,pointerEvents:'none'}}>{props.label}</div>
  </EdgeLabelRenderer>}
  {edit&&points&&<EdgeLabelRenderer>
   <div className="novzi-route-controls nodrag nopan" role="group" aria-label={`Editar recorrido de relación ${props.id}`} style={{pointerEvents:'none'}}>
    {points.slice(1,-1).map((p,i)=><button key={`waypoint-${i}`} className="nodrag nopan" type="button" aria-label={`Mover giro ${i+1}`} title="Arrastra el giro en cualquier dirección" style={{...buttonStyle,pointerEvents:'all',width:15,height:15,borderRadius:4,background:'#fee58a',position:'absolute',transform:`translate(-50%,-50%) translate(${p.x}px,${p.y}px)`}} onPointerDown={event=>beginDrag(event,'point',i+1)} onClick={event=>event.stopPropagation()}/>) }
    {points.slice(0,-1).map((p,i)=>{
     const to=points[i+1],x=(p.x+to.x)/2,y=(p.y+to.y)/2
     if(points.length>25)return null
     return <button key={`segment-${i}`} className="nodrag nopan" type="button" aria-label={`Mover tramo ${i+1}`} title="Arrastra para desplazar este tramo de la línea" style={{...buttonStyle,pointerEvents:'all',position:'absolute',transform:`translate(-50%,-50%) translate(${x}px,${y}px)`}} onPointerDown={event=>beginDrag(event,'segment',i)} onClick={event=>event.stopPropagation()}>{p.y===to.y?'↕':'↔'}</button>
    })}
    {points.length<24&&<button className="nodrag nopan" type="button" aria-label="Agregar giro en la relación" title="Agrega dos giros para crear un nuevo desvío" style={{...buttonStyle,position:'absolute',pointerEvents:'all',background:'#dceaff',transform:`translate(-50%,-50%) translate(${visual.labelX+35}px,${visual.labelY+27}px)`}} onClick={event=>{event.stopPropagation();const i=Math.max(0,Math.floor((points.length-1)/2));commit(insertDogleg(points,i,40))}}>+</button>}
    {manual&&<button className="nodrag nopan" type="button" aria-label="Restablecer recorrido automático" title="Quita los giros manuales, sin cambiar la relación ni sus extremos" style={{...buttonStyle,position:'absolute',pointerEvents:'all',color:'#a23f3f',borderColor:'#c87878',transform:`translate(-50%,-50%) translate(${visual.labelX+68}px,${visual.labelY+27}px)`}} onClick={event=>{event.stopPropagation();commit(null)}}>×</button>}
   </div>
  </EdgeLabelRenderer>}
 </>
}
export const edgeTypes={ 'novzi-parallel':NovziParallelEdge }
