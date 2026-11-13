import {BaseEdge,EdgeLabelRenderer} from '@xyflow/react'
import type {EdgeProps} from '@xyflow/react'
import type {EdgePathStyle} from '@atlas/contracts'
import {parallelRoute} from '../../features/editor/domain/parallel-edges'

type ParallelEdgeData={parallelOffset:number;parallelPath:EdgePathStyle}
/** Ruta individual para cada relación del mismo par. Nunca modifica el grafo. */
export function AtlasParallelEdge(props:EdgeProps){
 const data=props.data as ParallelEdgeData|undefined
 const route=parallelRoute({sourceX:props.sourceX,sourceY:props.sourceY,targetX:props.targetX,targetY:props.targetY,
  offset:data?.parallelOffset||0,pathStyle:data?.parallelPath||'bezier'})
 return <>
  <BaseEdge id={props.id} path={route.path} style={props.style} markerStart={props.markerStart} markerEnd={props.markerEnd} interactionWidth={26}/>
  {props.label!==undefined&&String(props.label).trim()!==''&&<EdgeLabelRenderer>
   <div className="atlas-parallel-edge-label" style={{transform:`translate(-50%,-50%) translate(${route.labelX}px,${route.labelY}px)`}}>{props.label}</div>
  </EdgeLabelRenderer>}
 </>
}
export const edgeTypes={ 'atlas-parallel':AtlasParallelEdge }
