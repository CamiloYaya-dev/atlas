/**
 * Readable deterministic layout for dense architecture/process graphs.
 * Only changes the current diagram's root occurrences and, when needed,
 * their presentation handles. NEVER adds/deletes/combines semantic edges.
 * Contained nodes and time-sensitive sequence coordinates are untouched.
 */
import {novziNodeSize,newActivityIssues,newClassIssues,newUseCaseIssues,newComponentIssues,newDeploymentIssues,newSequenceIssues} from '@novzi/contracts'
import type {ProjectDocument,Diagram,DiagramNode} from '@novzi/contracts'

const HORIZONTAL_GAP=175
const VERTICAL_GAP=105
const COMPONENT_GAP=230
const POSITION_EPSILON=1
const stableCompare=(a:DiagramNode,b:DiagramNode)=>a.y-b.y||a.x-b.x||a.id.localeCompare(b.id)
const center=(n:DiagramNode,size:{width:number;height:number})=>({x:n.x+size.width/2,y:n.y+size.height/2})
type Arc={source:string;target:string}

/** A cycle-tolerant feedback-arc heuristic: no node is discarded on cycles. */
function linearizeCycle(nodes:DiagramNode[],arcs:Arc[]):string[]{
 const remaining=new Set(nodes.map(n=>n.id)),prefix:string[]=[],suffix:string[]=[]
 const byId=new Map(nodes.map(n=>[n.id,n]))
 while(remaining.size){
  const degree=[...remaining].map(id=>({id,into:arcs.filter(e=>e.target===id&&remaining.has(e.source)).length,out:arcs.filter(e=>e.source===id&&remaining.has(e.target)).length}))
  const cmp=(a:{id:string},b:{id:string})=>stableCompare(byId.get(a.id)!,byId.get(b.id)!)
  const sources=degree.filter(n=>n.into===0).sort((a,b)=>b.out-a.out||cmp(a,b))
  if(sources.length){const id=sources[0].id;prefix.push(id);remaining.delete(id);continue}
  const sinks=degree.filter(n=>n.out===0).sort((a,b)=>b.into-a.into||cmp(a,b))
  if(sinks.length){const id=sinks[0].id;suffix.unshift(id);remaining.delete(id);continue}
  const best=degree.sort((a,b)=>(b.out-b.into)-(a.out-a.into)||cmp(a,b))[0].id
  prefix.push(best);remaining.delete(best)
 }
 return [...prefix,...suffix]
}

/** Weak components must be laid out separately: unrelated nodes do not share lanes. */
function weakComponents(nodes:DiagramNode[],arcs:Arc[]):DiagramNode[][]{
 const byId=new Map(nodes.map(n=>[n.id,n])),neighbors=new Map(nodes.map(n=>[n.id,new Set<string>()]))
 for(const edge of arcs){neighbors.get(edge.source)?.add(edge.target);neighbors.get(edge.target)?.add(edge.source)}
 const used=new Set<string>(),result:DiagramNode[][]=[]
 for(const node of [...nodes].sort(stableCompare)){
  if(used.has(node.id))continue
  const stack=[node.id],group:DiagramNode[]=[];used.add(node.id)
  while(stack.length){const id=stack.pop()!,current=byId.get(id);if(current)group.push(current)
   for(const adjacent of neighbors.get(id)||[]){if(!used.has(adjacent)){used.add(adjacent);stack.push(adjacent)}}
  }
  result.push(group)
 }
 return result
}

function layoutComponent(nodes:DiagramNode[],arcs:Arc[],sizes:Map<string,{width:number;height:number}>){
 const order=linearizeCycle(nodes,arcs),orderIndex=new Map(order.map((id,i)=>[id,i]))
 const out=new Map(order.map(id=>[id,[] as string[]])),incoming=new Map(order.map(id=>[id,[] as string[]]))
 for(const edge of arcs){out.get(edge.source)?.push(edge.target);incoming.get(edge.target)?.push(edge.source)}
 const depth=new Map(order.map(id=>[id,0]))
 // An edge pointing backward in the linearized order is a feedback relation,
 // not a reason to push EVERY node in a cycle onto the same faraway column.
 for(const id of order){for(const target of out.get(id)||[]){
  if((orderIndex.get(id)||0)>=(orderIndex.get(target)||0))continue
  depth.set(target,Math.max(depth.get(target)||0,(depth.get(id)||0)+1))
 }}
 const depthMax=Math.max(0,...depth.values())
 const limit=Math.min(7,Math.max(2,Math.ceil(Math.sqrt(nodes.length)*1.6)))
 const colOf=new Map(order.map(id=>[id,depthMax>limit?Math.floor((depth.get(id)||0)*limit/depthMax):(depth.get(id)||0)]))
 const columns=new Map<number,string[]>()
 for(const id of order){const col=colOf.get(id)!;if(!columns.has(col))columns.set(col,[]);columns.get(col)!.push(id)}
 const nodeById=new Map(nodes.map(n=>[n.id,n]))
 for(const values of columns.values())values.sort((a,b)=>stableCompare(nodeById.get(a)!,nodeById.get(b)!))
 const colKeys=[...columns.keys()].sort((a,b)=>a-b)
 // Bidirectional barycentric sweeps lower crossing counts without modifying
 // the underlying edges or depending on browser positioning heuristics.
 for(let iteration=0;iteration<10;iteration++){
  const leftToRight=iteration%2===0
  for(const col of leftToRight?colKeys:[...colKeys].reverse()){
   const items=columns.get(col)!
   if(items.length<2)continue
   const reference=(id:string)=>{
    const adjacent=[...(out.get(id)||[]),...(incoming.get(id)||[])].filter(n=>colOf.get(n)!==col)
    let sum=0,weight=0
    for(const neighbor of adjacent){const neighborCol=colOf.get(neighbor)!,inDirection=leftToRight?neighborCol<col:neighborCol>col
     if(!inDirection)continue
     const bucket=columns.get(neighborCol)!,idx=bucket.indexOf(neighbor)
     if(idx<0)continue
     const w=1/Math.max(1,Math.abs(col-neighborCol));sum+=((idx+.5)/bucket.length)*w;weight+=w
    }
    return weight?sum/weight:NaN
   }
   const prev=new Map(items.map((id,index)=>[id,index]))
   const scores=new Map(items.map(id=>[id,reference(id)]))
   items.sort((a,b)=>{
    const aScore=scores.get(a)!,bScore=scores.get(b)!
    if(Number.isFinite(aScore)&&Number.isFinite(bScore)&&Math.abs(aScore-bScore)>1e-8)return aScore-bScore
    if(Number.isFinite(aScore)!==Number.isFinite(bScore))return Number.isFinite(aScore)?-1:1
    return (prev.get(a)||0)-(prev.get(b)||0)
   })
  }
 }
 // A hub near the center reduces total wire length. Small columns align to the
 // central mass instead of all starting at the top and creating diagonal spans.
 const widths=new Map(colKeys.map(col=>[col,Math.max(...columns.get(col)!.map(id=>sizes.get(id)!.width))]))
 const heights=new Map(colKeys.map(col=>[col,columns.get(col)!.reduce((v,id)=>v+sizes.get(id)!.height,0)+VERTICAL_GAP*(columns.get(col)!.length-1)]))
 const totalHeight=Math.max(...heights.values())
 const placed=new Map<string,{x:number;y:number}>()
 let x=0
 for(const col of colKeys){
  const width=widths.get(col)!,items=columns.get(col)!
  let y=(totalHeight-heights.get(col)!)/2
  for(const id of items){const size=sizes.get(id)!;placed.set(id,{x:x+(width-size.width)/2,y});y+=size.height+VERTICAL_GAP}
  x+=width+HORIZONTAL_GAP
 }
 return {placed,height:totalHeight,width:Math.max(0,x-HORIZONTAL_GAP)}
}

/** Architecture-aware layout: explicitly separate entry, business, integration,
 * repository and storage lanes. It deliberately ALLOWS longer outside corridors
 * rather than compressing every connection into a shared central bundle.
 * No element catalog or diagram semantics are modified.
 */
export type BeautifyMode='presentation'|'compact'
type SemanticZone=0|1|2|3|4
function architectureZone(type:string,name:string):SemanticZone {
 const n=name.toLocaleLowerCase('es')
 if(type==='database'||/base de datos|sql server|postgres|mysql|mongodb|redis|db\b/.test(n))return 4
 if(/repositori|persisten|acceso a datos|data access|data layer/.test(n))return 3
 if(/entrada|controlador|controller|http|gateway|fachada|api pública|api publica/.test(n))return 0
 if(type==='external'||/adaptador|integraci[oó]n|tercero|proveedor externo|documentos|im[aá]genes|adjuntos|almacenamiento|cloud/.test(n))return 2
 return 1
}
function layoutArchitecture(nodes:DiagramNode[],sizes:Map<string,{width:number;height:number}>,doc:ProjectDocument,arcs:Arc[],mode:BeautifyMode){
 const zone=new Map(nodes.map(n=>[n.id,architectureZone(doc.elements[n.elementId]?.type||'',doc.elements[n.elementId]?.name||'')]))
 const distinct=new Set(zone.values())
 if(nodes.length<7||distinct.size<3||!distinct.has(1)||!distinct.has(3)&&!distinct.has(4))return null
 const columns:string[][]=[]
 const zoneMap=new Map<number,number>()
 for(let z=0;z<=4;z++){
  const batch=nodes.filter(n=>zone.get(n.id)===z).sort(stableCompare).map(n=>n.id)
  if(!batch.length)continue
  // Domain services are placed in at most 5 rows per lane for traceability.
  // Other zones stay narrow: each is visually distinguishable as a layer.
  const rows=mode==='presentation'?(z===1?4:5):(z===1?5:6)
  const colCount=Math.ceil(batch.length/rows)
  const groups=Array.from({length:colCount},()=>[] as string[])
  for(let i=0;i<batch.length;i++)groups[i%colCount].push(batch[i])
  for(const list of groups){zoneMap.set(columns.length,z);columns.push(list)}
 }
 const colOf=new Map(columns.flatMap((items,col)=>items.map(id=>[id,col] as const)))
 // Order rows by dependency barycenter, not alphabetic / incidental position.
 // Running both directions captures targets and sources without reversing arrows.
 for(let sweep=0;sweep<12;sweep++){
  const forward=sweep%2===0
  const indices=forward?columns.map((_,i)=>i):columns.map((_,i)=>i).reverse()
  for(const index of indices){const list=columns[index];if(list.length<2)continue
   const previous=new Map(list.map((id,i)=>[id,i]))
   const score=(id:string)=>{
    const neighbors=arcs.flatMap(a=>a.source===id?[a.target]:a.target===id?[a.source]:[])
    let total=0,weight=0
    for(const other of neighbors){const col=colOf.get(other);if(col===undefined||col===index||forward&&col>index||!forward&&col<index)continue
     const order=columns[col].indexOf(other)
     if(order<0)continue
     const w=1/Math.max(1,Math.abs(index-col))
     total+=(order+.5)/columns[col].length*w;weight+=w
    }
    return weight?total/weight:NaN
   }
   const scores=new Map(list.map(id=>[id,score(id)]))
   list.sort((a,b)=>{
    const x=scores.get(a)!,y=scores.get(b)!
    if(Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x-y)>1e-8)return x-y
    if(Number.isFinite(x)!==Number.isFinite(y))return Number.isFinite(x)?-1:1
    return previous.get(a)!-previous.get(b)!
   })
  }
 }
 const vGap=mode==='presentation'?145:90,hGap=mode==='presentation'?235:145
 const colWidths=columns.map(col=>Math.max(...col.map(id=>sizes.get(id)!.width)))
 const heights=columns.map(col=>col.reduce((h,id)=>h+sizes.get(id)!.height,0)+Math.max(0,col.length-1)*vGap)
 const maxHeight=Math.max(...heights)
 const placed=new Map<string,{x:number;y:number}>()
 let x=0
 for(let i=0;i<columns.length;i++){
  let y=(maxHeight-heights[i])/2
  for(const id of columns[i]){
   const size=sizes.get(id)!
   placed.set(id,{x:x+(colWidths[i]-size.width)/2,y})
   y+=size.height+vGap
  }
  const nextZone=zoneMap.get(i+1)
  x+=colWidths[i]+hGap+(nextZone!==undefined&&nextZone!==zoneMap.get(i)?45:0)
 }
 return {placed,height:maxHeight,width:x-hGap}
}

/** Rebase authored bend coordinates after moving boxes. The weighted endpoint
 * displacement preserves a local adjustment rather than stranding it where
 * the OLD boxes were. This is not a semantic graph operation.
 */
export function rebaseManualRoutes(before:ProjectDocument,after:ProjectDocument,diagramId:string):ProjectDocument {
 const previous=before.diagrams.find(d=>d.id===diagramId),current=after.diagrams.find(d=>d.id===diagramId)
 if(!previous||!current)return after
 const oldNodes=new Map(previous.nodes.map(n=>[n.id,n])),newNodes=new Map(current.nodes.map(n=>[n.id,n]))
 const previousEdges=new Map(previous.edges.map(e=>[e.id,e]))
 let altered=false
 const edges=current.edges.map(edge=>{
  const old=previousEdges.get(edge.id),route=old?.manualRoute
  if(!route?.points?.length||!newNodes.has(edge.source)||!newNodes.has(edge.target))return edge
  const a=oldNodes.get(edge.source),b=oldNodes.get(edge.target),a1=newNodes.get(edge.source)!,b1=newNodes.get(edge.target)!
  if(!a||!b)return edge
  const dxA=a1.x-a.x,dyA=a1.y-a.y,dxB=b1.x-b.x,dyB=b1.y-b.y
  if(dxA===0&&dyA===0&&dxB===0&&dyB===0)return edge
  const x0=a.x+(a.width||250)/2,y0=a.y+(a.height||135)/2
  const dx=b.x+(b.width||250)/2-x0,dy=b.y+(b.height||135)/2-y0
  const denominator=Math.max(1,dx*dx+dy*dy)
  const points=route.points.map(p=>{
   const t=Math.max(0,Math.min(1,((p.x-x0)*dx+(p.y-y0)*dy)/denominator))
   return {x:Math.round(p.x+dxA*(1-t)+dxB*t),y:Math.round(p.y+dyA*(1-t)+dyB*t)}
  })
  altered=true
  return {...edge,manualRoute:{version:1 as const,points}}
 })
 return altered?{...after,diagrams:after.diagrams.map(d=>d.id===diagramId?{...d,edges}:d)}:after
}

/** Reassign only ports of the currently reorganized diagram, not edge semantics. */
function optimizeEdgeAnchors(diagram:Diagram,sizes:Map<string,{width:number;height:number}>):Diagram['edges']{
 // Authored UML ports can be part of the notation, not merely of layout.
 if(diagram.type.startsWith('uml-'))return diagram.edges
 const nodes=new Map(diagram.nodes.map(n=>[n.id,n]))
 const point=(id:string)=>{const n=nodes.get(id);return n?center(n,sizes.get(id)??{width:n.width||250,height:n.height||125}):null}
 const baseline=diagram.edges.map(edge=>{
  const a=nodes.get(edge.source),b=nodes.get(edge.target)
  if(!a||!b||edge.source===edge.target||a.parentNodeId||b.parentNodeId||(edge.manualRoute?.points?.length||edge.portsLocked))return edge
  const ac=point(a.id)!,bc=point(b.id)!,dx=bc.x-ac.x,dy=bc.y-ac.y
  const sourceHandle=Math.abs(dx)>95?(dx>0?'right':'left'):(dy>=0?'bottom-2':'top-2')
  const targetHandle=Math.abs(dx)>95?(dx>0?'left':'right'):(dy>=0?'top-2':'bottom-2')
  return edge.sourceHandle===sourceHandle&&edge.targetHandle===targetHandle?edge:{...edge,sourceHandle,targetHandle}
 })
 // Avoid dozens of different relations connecting to exactly the same lateral
 // pixel on a hub. Vertical ports are already present on NOVZI non-UML cards.
 const spread=new Map<string,typeof baseline[number]>()
 for(const end of ['source','target'] as const){
  const handleKey=end==='source'?'sourceHandle':'targetHandle'
  const buckets=new Map<string,typeof baseline>()
  for(const edge of baseline){
   if(edge.portsLocked||edge.manualRoute?.points?.length)continue
   const node=nodes.get(edge[end]),side=edge[handleKey]
   if(!node||node.parentNodeId||!['left','right'].includes(side||''))continue
   const key=`${node.id}:${side}`
   const group=buckets.get(key)||[];group.push(edge);buckets.set(key,group)
  }
  for(const group of buckets.values()){
   if(group.length<4)continue
   group.sort((a,b)=>(point(a[end==='source'?'target':'source'])?.y??0)-(point(b[end==='source'?'target':'source'])?.y??0)||a.id.localeCompare(b.id))
   const cap=group.length>=7?2:1
   for(let i=0;i<cap;i++){
    const first=group[i],last=group[group.length-i-1]
    const top=i===0?'top-2':'top-1',bottom=i===0?'bottom-2':'bottom-3'
    const currentFirst=spread.get(first.id)||first,currentLast=spread.get(last.id)||last
    spread.set(first.id,{...currentFirst,[handleKey]:top})
    spread.set(last.id,{...currentLast,[handleKey]:bottom})
   }
  }
 }
 return baseline.map(edge=>spread.get(edge.id)||edge)
}

export function beautifyDiagram(doc:ProjectDocument,diagramId:string,mode:BeautifyMode='presentation'):ProjectDocument {
 const diagram=doc.diagrams.find(d=>d.id===diagramId)
 if(!diagram)throw new Error('Diagrama no encontrado')
 if(diagram.type==='uml-sequence'&&diagram.interaction)throw new Error('Las coordenadas UML de secuencia representan tiempo; utiliza el ajuste de participantes para mantener sus ocurrencias.')
 const roots=diagram.nodes.filter(n=>!n.parentNodeId)
 if(roots.length<2)return doc
 const nodes=new Map(diagram.nodes.map(n=>[n.id,n]))
 const rootOf=(id:string)=>{let node=nodes.get(id);const visited=new Set<string>();while(node?.parentNodeId&&nodes.has(node.parentNodeId)&&!visited.has(node.id)){visited.add(node.id);node=nodes.get(node.parentNodeId)}return node?.id}
 const arcKeys=new Set<string>(),arcs:Arc[]=[]
 for(const edge of diagram.edges){const source=rootOf(edge.source),target=rootOf(edge.target)
  if(!source||!target||source===target)continue
  const key=`${source}\0${target}`
  if(!arcKeys.has(key)){arcKeys.add(key);arcs.push({source,target})}
 }
 const sizes=new Map(roots.map(node=>{
  const element=doc.elements[node.elementId]
  const measured=element?novziNodeSize(diagram.type,element,node,0,diagram.nodes.some(n=>n.parentNodeId===node.id)):{width:node.width||250,height:node.height||125}
  return [node.id,{width:Math.max(node.width||0,measured.width),height:Math.max(node.height||0,measured.height)}]
 }))
 const minX=Math.min(...roots.map(n=>n.x)),minY=Math.min(...roots.map(n=>n.y))
 const moved=new Map<string,{x:number;y:number}>()
 let offsetY=0
 for(const group of weakComponents(roots,arcs)){
  const ids=new Set(group.map(n=>n.id)),groupArcs=arcs.filter(a=>ids.has(a.source)&&ids.has(a.target)),component=!diagram.type.startsWith('uml-')?layoutArchitecture(group,sizes,doc,groupArcs,mode)||layoutComponent(group,groupArcs,sizes):layoutComponent(group,groupArcs,sizes)
  for(const [id,pos] of component.placed)moved.set(id,{x:minX+pos.x,y:minY+offsetY+pos.y})
  offsetY+=component.height+COMPONENT_GAP
 }
 const arranged={...diagram,nodes:diagram.nodes.map(n=>moved.has(n.id)?{...n,...moved.get(n.id)!}:n)}
 const arrangedEdges=optimizeEdgeAnchors(arranged,sizes)
 const movedPositions=diagram.nodes.some(n=>moved.has(n.id)&&(Math.abs(n.x-moved.get(n.id)!.x)>POSITION_EPSILON||Math.abs(n.y-moved.get(n.id)!.y)>POSITION_EPSILON))
 const changed=movedPositions||arrangedEdges.some((edge,index)=>edge!==diagram.edges[index])
 if(!changed)return doc
 const next=rebaseManualRoutes(doc,{...doc,diagrams:doc.diagrams.map(d=>d.id===diagramId?{...arranged,edges:arrangedEdges}:d)},diagramId)
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
