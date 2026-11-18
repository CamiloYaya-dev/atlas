/**
 * Deterministic, non-destructive NOVZI diagram arrangement.
 * Only top-level appearances move. Nested ports, partitions, containment,
 * occurrence timing, element identities and semantic relations stay intact.
 */
import {novziNodeSize,newActivityIssues,newClassIssues,newUseCaseIssues,newComponentIssues,newDeploymentIssues,newSequenceIssues} from '@novzi/contracts'
import type {ProjectDocument,Diagram,DiagramNode} from '@novzi/contracts'

// Space for routing corridors AND readable UML relationship annotations.
const X_GAP=340
const Y_GAP=210
const MARGIN=24

const center=(n:DiagramNode)=>({x:n.x+(n.width||180)/2,y:n.y+(n.height||95)/2})
const preferHandle=(dx:number,dy:number,source:boolean)=>{
 if(Math.abs(dx)>=Math.abs(dy)*1.15)return source?(dx>=0?'right':'left'):(dx>=0?'left':'right')
 return source?(dy>=0?'bottom-2':'top-2'):(dy>=0?'top-2':'bottom-2')
}
function optimizeEdgeAnchors(diagram:Diagram):Diagram['edges']{
 const nodes=new Map(diagram.nodes.map(n=>[n.id,n]))
 return diagram.edges.map(edge=>{
  const source=nodes.get(edge.source),target=nodes.get(edge.target)
  if(!source||!target||edge.source===edge.target)return edge
  const a=center(source),b=center(target),dx=b.x-a.x,dy=b.y-a.y
  const sourceHandle=preferHandle(dx,dy,true),targetHandle=preferHandle(dx,dy,false)
  if(edge.sourceHandle===sourceHandle&&edge.targetHandle===targetHandle)return edge
  return {...edge,sourceHandle,targetHandle}
 })
}

export function beautifyDiagram(doc:ProjectDocument,diagramId:string):ProjectDocument {
 const diagram=doc.diagrams.find(d=>d.id===diagramId)
 if(!diagram)throw new Error('Diagrama no encontrado')
 // Sequence coordinates encode occurrences, activation and fragment membership.
 // Ordinary automatic topological layout would corrupt their UML semantics.
 if(diagram.type==='uml-sequence'&&diagram.interaction)throw new Error('Las coordenadas UML de secuencia representan tiempo; utiliza el ajuste de participantes para mantener sus ocurrencias.')
 const roots=diagram.nodes.filter(n=>!n.parentNodeId)
 if(roots.length<2)return doc
 const byId=new Map(diagram.nodes.map(n=>[n.id,n]))
 const rootOf=(id:string)=>{let n=byId.get(id);const visited=new Set<string>();while(n?.parentNodeId&&byId.has(n.parentNodeId)&&!visited.has(n.id)){visited.add(n.id);n=byId.get(n.parentNodeId)}return n?.id}
 const adj=new Map(roots.map(n=>[n.id,new Set<string>()]))
 const incoming=new Map(roots.map(n=>[n.id,0]))
 for(const e of diagram.edges){const a=rootOf(e.source),b=rootOf(e.target);if(!a||!b||a===b||!adj.has(a)||!adj.has(b)||adj.get(a)!.has(b))continue;adj.get(a)!.add(b);incoming.set(b,(incoming.get(b)||0)+1)}
 const sorted=[...roots].sort((a,b)=>a.x-b.x||a.y-b.y||a.id.localeCompare(b.id))
 const layer=new Map<string,number>()
 const queue=sorted.filter(n=>!incoming.get(n.id)).map(n=>n.id)
 for(const n of queue)layer.set(n,0)
 // Kahn layering; cycles are kept in their original group instead of looping.
 while(queue.length){const id=queue.shift()!;for(const dest of adj.get(id)||[]){layer.set(dest,Math.max(layer.get(dest)||0,(layer.get(id)||0)+1));incoming.set(dest,(incoming.get(dest)||0)-1);if(incoming.get(dest)===0)queue.push(dest)}}
 const unresolved=sorted.filter(n=>!layer.has(n.id))
 if(unresolved.length){const maxLayer=Math.max(0,...layer.values());for(const [i,n] of unresolved.entries())layer.set(n.id,maxLayer+Math.floor(i/5))}
 // Keep very wide graphs readable: limit layers and allow vertical columns.
 const groups=new Map<number,typeof roots>()
 for(const n of sorted){const index=layer.get(n.id)||0;const value=groups.get(index)||[];value.push(n);groups.set(index,value)}
 const sizes=new Map(roots.map(n=>{const e=doc.elements[n.elementId];const actual=e?novziNodeSize(diagram.type,e,n,0,diagram.nodes.some(x=>x.parentNodeId===n.id)):{width:n.width||180,height:n.height||95};return [n.id,{width:Math.max(n.width||0,actual.width),height:Math.max(n.height||0,actual.height)}]}))
 const minX=Math.min(...roots.map(n=>n.x)),minY=Math.min(...roots.map(n=>n.y))
 let x=minX
 const moved=new Map<string,{x:number;y:number}>()
 for(const index of [...groups.keys()].sort((a,b)=>a-b)){
  const col=groups.get(index)!.sort((a,b)=>a.y-b.y||a.x-b.x||a.id.localeCompare(b.id))
  const width=Math.max(...col.map(n=>sizes.get(n.id)!.width))
  let y=minY
  for(const n of col){const sz=sizes.get(n.id)!;moved.set(n.id,{x:x+(width-sz.width)/2,y});y+=sz.height+Y_GAP}
  x+=width+X_GAP
 }
 const changed=diagram.nodes.some(n=>moved.has(n.id)&&(Math.abs(n.x-moved.get(n.id)!.x)>MARGIN||Math.abs(n.y-moved.get(n.id)!.y)>MARGIN))
 if(!changed)return doc
 const next:ProjectDocument={...doc,diagrams:doc.diagrams.map(d=>{
  if(d.id!==diagramId)return d
  const arranged={...d,nodes:d.nodes.map(n=>moved.has(n.id)?{...n,...moved.get(n.id)!}:n)}
  return {...arranged,edges:optimizeEdgeAnchors(arranged)}
 })}
 // Fail closed for structured UML, never silently rewrite model semantics.
 const issue=diagram.type==='uml-class'?newClassIssues(doc,next)[0]:diagram.type==='uml-usecase'?newUseCaseIssues(doc,next)[0]:diagram.type==='uml-activity'?newActivityIssues(doc,next)[0]:diagram.type==='uml-component'?newComponentIssues(doc,next)[0]:diagram.type==='uml-deployment'?newDeploymentIssues(doc,next)[0]:diagram.type==='uml-sequence'?newSequenceIssues(doc,next)[0]:undefined
 if(issue)throw new Error('No se puede organizar este diagrama sin alterar su semántica UML: '+issue.message)
 return next
}

/** A pure, fast Manhattan path finder that refuses paths through obstacle interiors. */
export type Rectangle={id:string;x:number;y:number;width:number;height:number}
export type Point={x:number;y:number}
const intersects=(a:Point,b:Point,r:Rectangle)=>{
 const p=9;const left=r.x-p,right=r.x+r.width+p,top=r.y-p,bottom=r.y+r.height+p
 if(a.x===b.x)return a.x>left&&a.x<right&&Math.max(a.y,b.y)>top&&Math.min(a.y,b.y)<bottom
 if(a.y===b.y)return a.y>top&&a.y<bottom&&Math.max(a.x,b.x)>left&&Math.min(a.x,b.x)<right
 return true
}
/** Proper segment-vs-rectangle test including diagonal and collinear routes. */
export function needsDetour(from:Point,to:Point,rects:Rectangle[]):boolean {
 return rects.some(rect=>{
  if(![rect.x,rect.y,rect.width,rect.height].every(Number.isFinite))return false
  const x0=rect.x-9,y0=rect.y-9,x1=rect.x+rect.width+9,y1=rect.y+rect.height+9
  const dx=to.x-from.x,dy=to.y-from.y
  let low=0,high=1
  for(const [p,q] of [[-dx,from.x-x0],[dx,x1-from.x],[-dy,from.y-y0],[dy,y1-from.y]]){
   if(Math.abs(p)<1e-9){if(q<0)return false;continue}
   const t=q/p
   if(p<0)low=Math.max(low,t);else high=Math.min(high,t)
   if(low>high)return false
  }
  return low<=high
 })
}
export function obstacleRoute(from:Point,to:Point,rects:Rectangle[]):{path:string;labelX:number;labelY:number}|null {
 if(![from.x,from.y,to.x,to.y].every(Number.isFinite))return null
 const boxes=rects.filter(r=>[r.x,r.y,r.width,r.height].every(Number.isFinite))
 const xs=[from.x,to.x,(from.x+to.x)/2,...boxes.flatMap(r=>[r.x-18,r.x+r.width+18])]
 const ys=[from.y,to.y,(from.y+to.y)/2,...boxes.flatMap(r=>[r.y-18,r.y+r.height+18])]
 let best:Point[]|undefined,bestScore=Infinity
 const consider=(path:Point[])=>{
  const points=path.filter((p,i)=>i===0||p.x!==path[i-1].x||p.y!==path[i-1].y)
  if(points.some((p,i)=>i>0&&boxes.some(r=>intersects(points[i-1],p,r))))return
  const distance=points.reduce((sum,p,i)=>i?sum+Math.abs(p.x-points[i-1].x)+Math.abs(p.y-points[i-1].y):0,0)
  const score=distance+(points.length-2)*18
  if(score<bestScore){best=points;bestScore=score}
 }
 // Two-bend routes, then one-bend routes. Limit candidates to nearby corridors.
 consider([from,{x:to.x,y:from.y},to]);consider([from,{x:from.x,y:to.y},to])
 for(const x of xs)consider([from,{x,y:from.y},{x,y:to.y},to])
 for(const y of ys)consider([from,{x:from.x,y},{x:to.x,y},to])
 if(!best)return null
 const points:Point[]=best
 const total=points.reduce((s,p,i)=>i?s+Math.abs(p.x-points[i-1].x)+Math.abs(p.y-points[i-1].y):0,0)
 let remaining=total/2,label=from
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],d=Math.abs(b.x-a.x)+Math.abs(b.y-a.y);if(remaining<=d){label={x:a.x+Math.sign(b.x-a.x)*remaining,y:a.y+Math.sign(b.y-a.y)*remaining};break}remaining-=d}
 return {path:points.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' '),labelX:label.x,labelY:label.y}
}

/** Separate visual lanes for nearby relationships. The document and edge IDs never change.
 * Each route has its own long segment, including when an intermediate node
 * forces several relations around the same obstacle.
 */
export type RouteSide='left'|'right'|'top'|'bottom'|undefined
export type SeparatedRoute={path:string;labelX:number;labelY:number}
export function distinctEdgeRoute(
 from:Point,to:Point,rects:Rectangle[],
 options:{lane:number;sourceSide?:RouteSide;targetSide?:RouteSide;clearance?:number}
):SeparatedRoute|null {
 if(![from.x,from.y,to.x,to.y].every(Number.isFinite))return null
 const clearance=options.clearance??25
 const obstacles=rects.filter(r=>[r.x,r.y,r.width,r.height].every(Number.isFinite))
 const horizontal=!['top','bottom'].includes(options.sourceSide||'')
 const startDirection=options.sourceSide==='left'?-1:options.sourceSide==='top'?-1:1
 const endDirection=options.targetSide==='right'?1:options.targetSide==='bottom'?1:-1
 // Stubs branch outside endpoint boxes before changing lane, avoiding crossing
 // a box from the edge of its own port. No route uses global shared waypoints.
 const start=horizontal?{x:from.x+startDirection*clearance,y:from.y}:{x:from.x,y:from.y+startDirection*clearance}
 const finish=horizontal?{x:to.x+endDirection*clearance,y:to.y}:{x:to.x,y:to.y+endDirection*clearance}
 const between=horizontal?(start.y+finish.y)/2:(start.x+finish.x)/2
 // Only blockers in this relation's corridor participate in lane allocation.
 // Including every box of the diagram would create huge unnecessary detours.
 const near=obstacles.filter(r=>{
  const begin=horizontal?Math.min(from.x,to.x):Math.min(from.y,to.y)
  const end=horizontal?Math.max(from.x,to.x):Math.max(from.y,to.y)
  const obstacleStart=horizontal?r.x:r.y
  const obstacleEnd=obstacleStart+(horizontal?r.width:r.height)
  return obstacleEnd>=begin&&obstacleStart<=end&&
   (needsDetour(from,to,[r])||Math.abs((horizontal?r.y+r.height/2:r.x+r.width/2)-between)<190)
 })
 const blocking=near.filter(r=>needsDetour(from,to,[r]))
 const upper=blocking.length?Math.min(...blocking.map(r=>(horizontal?r.y:r.x)-clearance-12)):between
 const lower=blocking.length?Math.max(...blocking.map(r=>(horizontal?r.y+r.height:r.x+r.width)+clearance+12)):between
 // Each lane has a RESERVED channel, not just a soft routing preference.
 // This guarantees that distinct edges don't merge onto the shortest detour.
 const lane=options.lane
 const desired=blocking.length?
  (lane<0?upper+(lane+1)*38:lower+lane*38):between+lane*38
 const candidates=[desired]
 for(let i=1;i<=18;i++){
  const sign=lane<0?-1:lane>0?1:Math.sign(desired-between)||1
  candidates.push(desired+sign*i*38)
 }
 if(!blocking.length&&lane===0)for(let i=1;i<=12;i++)candidates.push(between-i*38)
 const valid=(points:Point[])=>points.every((p,i)=>i===0||!obstacles.some(r=>intersects(points[i-1],p,r)))
 const compress=(pts:Point[])=>pts.filter((pt,i)=>i===0||pt.x!==pts[i-1].x||pt.y!==pts[i-1].y)
 let best:Point[]|null=null
 for(const channel of candidates){
  const pts=compress(horizontal?[from,start,{x:start.x,y:channel},{x:finish.x,y:channel},finish,to]:[from,start,{x:channel,y:start.y},{x:channel,y:finish.y},finish,to])
  if(valid(pts)){best=pts;break}
 }
 if(!best)return null
 const points:Point[]=best
 const segments=points.slice(1).map((pt,i)=>({a:points[i],b:pt,length:Math.abs(pt.x-points[i].x)+Math.abs(pt.y-points[i].y)}))
  .filter((_,i)=>i>0&&i<points.length-2)
 const main=segments.sort((a,b)=>b.length-a.length)[0]
 const midpoint=main?{x:(main.a.x+main.b.x)/2,y:(main.a.y+main.b.y)/2}:{x:(from.x+to.x)/2,y:(from.y+to.y)/2}
 const label=main&&main.a.y===main.b.y?{x:midpoint.x,y:midpoint.y-17}:{x:midpoint.x+18,y:midpoint.y}
 return {path:points.map((pt,i)=>`${i?'L':'M'} ${pt.x} ${pt.y}`).join(' '),labelX:label.x,labelY:label.y}
}
