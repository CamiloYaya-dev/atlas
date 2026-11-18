import {BaseEdge,EdgeLabelRenderer} from '@xyflow/react'
import type {EdgeProps} from '@xyflow/react'
import type {EdgePathStyle} from '@atlas/contracts'
import {parallelRoute} from '../../features/editor/domain/parallel-edges'
import {needsDetour,obstacleRoute,distinctEdgeRoute} from '../../features/editor/domain/diagram-beautify'
import type {Rectangle} from '../../features/editor/domain/diagram-beautify'

type ParallelEdgeData={parallelOffset:number;parallelPath:EdgePathStyle;routeObstacles?:Rectangle[];routeLane?:number}
/** Ruta individual para cada relación del mismo par. Nunca modifica el grafo. */
export function AtlasParallelEdge(props:EdgeProps){
 const data=props.data as ParallelEdgeData|undefined
 const route=parallelRoute({sourceX:props.sourceX,sourceY:props.sourceY,targetX:props.targetX,targetY:props.targetY,
  offset:data?.parallelOffset||0,pathStyle:data?.parallelPath||'bezier',
  sourcePosition:props.sourcePosition,targetPosition:props.targetPosition})
 const boxes=data?.routeObstacles||[]
 const start={x:props.sourceX,y:props.sourceY},end={x:props.targetX,y:props.targetY}
 const shouldRoute=!!data?.routeLane||boxes.length&&needsDetour(start,end,boxes)
 const smart=shouldRoute?(distinctEdgeRoute(start,end,boxes,{lane:data?.routeLane||0,sourceSide:props.sourcePosition,targetSide:props.targetPosition})||obstacleRoute(start,end,boxes)):null
 const visual=smart||route
 return <>
  <BaseEdge id={props.id} path={visual.path} style={props.style} markerStart={props.markerStart} markerEnd={props.markerEnd} interactionWidth={26}/>
  {props.label!==undefined&&String(props.label).trim()!==''&&<EdgeLabelRenderer>
   <div className="atlas-parallel-edge-label" style={{transform:`translate(-50%,-50%) translate(${visual.labelX}px,${visual.labelY}px)`}}>{props.label}</div>
  </EdgeLabelRenderer>}
 </>
}
export const edgeTypes={ 'atlas-parallel':AtlasParallelEdge }
