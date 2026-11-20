import type {Node} from '@xyflow/react'

/**
 * Controlled React Flow redraws must not discard measured node dimensions.
 * XYFlow's adoptUserNodes()/parseHandles() intentionally clears cached handle
 * bounds when a replacement userNode has no `measured` property. This leaves
 * visible handles which no longer start a drag connection after a hover/
 * inspector rerender. The graph view model remains authoritative for layout;
 * only ephemeral geometry measured by React Flow is carried over.
 */
export function preserveReactFlowMeasurements<T extends Node>(
 next:readonly T[],previous:readonly Node[],sameDiagram:boolean
):T[]{
 if(!sameDiagram)return [...next]
 const existing=new Map(previous.map(node=>[node.id,node]))
 return next.map(node=>{
  const old=existing.get(node.id)
  if(!old||old.type!==node.type||old.data?.graphType!==node.data?.graphType||old.data?.mode!==node.data?.mode)return node
  if(old.style?.width!==node.style?.width||old.style?.height!==node.style?.height||old.style?.minHeight!==node.style?.minHeight)return node
  const width=old.measured?.width,height=old.measured?.height
  if(typeof width!=='number'||typeof height!=='number'||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return node
  return {...node,measured:{width,height}}
 })
}
