/** Manual, diagram-local orthogonal routes. Never modifies semantic endpoints or box positions. */
export type Point={x:number;y:number}
export type ManualRoute={version:1;points:Point[]}
export type Side='left'|'right'|'top'|'bottom'|undefined
export const MAX_ROUTE_POINTS=24
export const isValidManualRoute=(value:unknown):value is ManualRoute=>{
 if(!value||typeof value!=='object')return false
 const r=value as Partial<ManualRoute>
 return r.version===1&&Array.isArray(r.points)&&r.points.length<=MAX_ROUTE_POINTS&&r.points.every(p=>!!p&&typeof p.x==='number'&&typeof p.y==='number'&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<=1e6&&Math.abs(p.y)<=1e6)
}
const same=(a:Point,b:Point)=>a.x===b.x&&a.y===b.y
export function compactPolyline(points:Point[]):Point[]{
 const clean:Point[]=[]
 for(const p of points){const value={x:Math.round(p.x),y:Math.round(p.y)};if(!clean.length||!same(value,clean[clean.length-1]))clean.push(value)}
 const out:Point[]=[]
 for(const p of clean){const n=out.length;if(n>=2){const a=out[n-2],b=out[n-1];if((a.x===b.x&&b.x===p.x)||(a.y===b.y&&b.y===p.y)){out[n-1]=p;continue}}out.push(p)}
 return out
}
export function orthogonalize(points:Point[],sourceSide:Side='right',targetSide:Side='left'):Point[]{
 if(points.length<2)return points
 const result:Point[]=[points[0]]
 for(let i=1;i<points.length;i++){
  const previous=result[result.length-1],next=points[i]
  if(previous.x!==next.x&&previous.y!==next.y){
   const side=i===1?sourceSide:i===points.length-1?targetSide:undefined
   // Keep a horizontal or vertical stub next to each box as dictated by its port.
   const horizontal=side?side==='left'||side==='right':Math.abs(next.x-previous.x)>=Math.abs(next.y-previous.y)
   result.push(horizontal?{x:next.x,y:previous.y}:{x:previous.x,y:next.y})
  }
  result.push(next)
 }
 return compactPolyline(result)
}
export function editableRoute(from:Point,to:Point,manual:ManualRoute|undefined,sourceSide:Side='right',targetSide:Side='left',autoPath?:string):Point[]{
 if(manual&&isValidManualRoute(manual)&&manual.points.length)return orthogonalize([from,...manual.points,to],sourceSide,targetSide)
 // Use actual obstacle-aware route when it is an M/L polyline, not an SVG curve.
 if(autoPath&&/^[\s\d.,ML\-]+$/i.test(autoPath)){
  const coordinates=[...autoPath.matchAll(/[ML]\s*(-?\d+(?:\.\d+)?)[\s,]+(-?\d+(?:\.\d+)?)/gi)]
    .map(m=>({x:Number(m[1]),y:Number(m[2])}))
  if(coordinates.length>=2&&coordinates.length<=MAX_ROUTE_POINTS+2&&coordinates.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))return orthogonalize([from,...coordinates.slice(1,-1),to],sourceSide,targetSide)
 }
 const horizontalSource=sourceSide==='right'||sourceSide==='left'
 const horizontalTarget=targetSide==='right'||targetSide==='left'
 const d=25
 const sourceStub=horizontalSource?{x:from.x+(sourceSide==='right'?d:-d),y:from.y}:{x:from.x,y:from.y+(sourceSide==='bottom'?d:-d)}
 const targetStub=horizontalTarget?{x:to.x+(targetSide==='right'?d:-d),y:to.y}:{x:to.x,y:to.y+(targetSide==='bottom'?d:-d)}
 const turn=horizontalSource===horizontalTarget?
  horizontalSource?[{x:(sourceStub.x+targetStub.x)/2,y:sourceStub.y},{x:(sourceStub.x+targetStub.x)/2,y:targetStub.y}]:[{x:sourceStub.x,y:(sourceStub.y+targetStub.y)/2},{x:targetStub.x,y:(sourceStub.y+targetStub.y)/2}]:
  horizontalSource?[{x:targetStub.x,y:sourceStub.y}]:[{x:sourceStub.x,y:targetStub.y}]
 return orthogonalize([from,sourceStub,...turn,targetStub,to],sourceSide,targetSide)
}
export function shiftSegment(points:Point[],index:number,offset:number):Point[]{
 if(index<0||index>=points.length-1)return points
 const a=points[index],b=points[index+1],horizontal=a.y===b.y
 const shift=horizontal?{x:0,y:Math.round(offset)}:{x:Math.round(offset),y:0}
 if(!shift.x&&!shift.y)return points
 const translated=(p:Point):Point=>({x:p.x+shift.x,y:p.y+shift.y})
 let next:Point[]
 if(index===0||index===points.length-2){
  // A box port is fixed. Move the segment by inserting a 2-bend dogleg.
  next=[...points.slice(0,index+1),translated(a),translated(b),...points.slice(index+1)]
 }else{
  next=points.map((p,i)=>i===index||i===index+1?translated(p):p)
 }
 return compactPolyline(next)
}
export function insertDogleg(points:Point[],index:number,depth=35):Point[]{
 return shiftSegment(points,index,depth)
}
export function toManualRoute(points:Point[]):ManualRoute{
 const clean=compactPolyline(points).slice(1,-1)
 if(clean.length>MAX_ROUTE_POINTS)throw Error(`Máximo ${MAX_ROUTE_POINTS} puntos de recorrido`)
 if(!isValidManualRoute({version:1,points:clean}))throw Error('Coordenadas de recorrido inválidas')
 return {version:1,points:clean}
}
export function polylinePath(points:Point[]):{path:string;labelX:number;labelY:number}{
 const path=points.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' ')
 const segments=points.slice(1).map((b,i)=>({a:points[i],b,len:Math.abs(b.x-points[i].x)+Math.abs(b.y-points[i].y)}))
 const main=[...segments].sort((a,b)=>b.len-a.len)[0]
 const a=main?.a||points[0]||{x:0,y:0},b=main?.b||a
 return {path,labelX:(a.x+b.x)/2+(a.x===b.x?13:0),labelY:(a.y+b.y)/2+(a.y===b.y?-12:0)}
}


/** V3: Every side has a non-reversing, axis-aligned port leg. The interior
 * may take arbitrary detours, but it cannot bend across a box boundary. */
export const PORT_LEG=24
export function sideVector(side:Side):Point{
 if(side==='left')return {x:-1,y:0}
 if(side==='top')return {x:0,y:-1}
 if(side==='bottom')return {x:0,y:1}
 return {x:1,y:0}
}
const sameAxis=(a:Point,b:Point)=>a.x===b.x||a.y===b.y
const outward=(port:Point,neighbor:Point,side:Side,min=PORT_LEG*.5)=>{
 const v=sideVector(side),dx=neighbor.x-port.x,dy=neighbor.y-port.y
 return Math.abs(v.x?dy:dx)<.001&&dx*v.x+dy*v.y>=min
}
const portLeg=(p:Point,side:Side):Point=>{const v=sideVector(side);return {x:p.x+PORT_LEG*v.x,y:p.y+PORT_LEG*v.y}}
export function enforcePortLegs(points:Point[],sourceSide:Side='right',targetSide:Side='left'):Point[]{
 if(points.length<2)return points
 const input=compactPolyline(points)
 const from=input[0],to=input[input.length-1]
 const orthogonal=input.every((p,i)=>i===0||sameAxis(input[i-1],p))
 if(orthogonal&&input.length>=2&&outward(from,input[1],sourceSide)&&outward(to,input[input.length-2],targetSide))return input
 const sourceStub=portLeg(from,sourceSide),targetStub=portLeg(to,targetSide)
 // Old routes may contain short, inward-facing stubs. Drop those while
 // preserving the remaining user waypoints; never move source/target nodes.
 const middle=input.slice(1,-1).filter((p,i,all)=>
  !(i===0&&Math.abs(p.x-from.x)+Math.abs(p.y-from.y)<PORT_LEG) &&
  !(i===all.length-1&&Math.abs(p.x-to.x)+Math.abs(p.y-to.y)<PORT_LEG))
 const itinerary=[sourceStub,...middle,targetStub]
 const rebuilt:Point[]=[from,sourceStub]
 for(let i=1;i<itinerary.length;i++){
  const next=itinerary[i],prev=rebuilt[rebuilt.length-1]
  if(prev.x!==next.x&&prev.y!==next.y){
   // At target preserve its horizontal/vertical approach, at source do not
   // return directly along the source port axis.
   const towardTarget=i===itinerary.length-1
   const finalHorizontal=targetSide==='left'||targetSide==='right'
   const initialHorizontal=sourceSide==='left'||sourceSide==='right'
   const corner=towardTarget?(finalHorizontal?{x:prev.x,y:next.y}:{x:next.x,y:prev.y}):
    i===1?(initialHorizontal?{x:prev.x,y:next.y}:{x:next.x,y:prev.y}):
    Math.abs(prev.x-next.x)>=Math.abs(prev.y-next.y)?{x:next.x,y:prev.y}:{x:prev.x,y:next.y}
   rebuilt.push(corner)
  }
  rebuilt.push(next)
 }
 rebuilt.push(to)
 let result=compactPolyline(rebuilt)
 // When opposite ports point away from each other, collinear normalization
 // can swallow a mandatory leg. Add a real dogleg rather than a backtrack.
 if(!outward(from,result[1]||to,sourceSide)){
  const v=sideVector(sourceSide),stub=portLeg(from,sourceSide)
  const corner={x:stub.x+(v.y?PORT_LEG:0),y:stub.y+(v.x?PORT_LEG:0)}
  result=compactPolyline([from,stub,corner,...result.slice(1)])
 }
 if(!outward(to,result[result.length-2]||from,targetSide)){
  const v=sideVector(targetSide),stub=portLeg(to,targetSide)
  const corner={x:stub.x+(v.y?PORT_LEG:0),y:stub.y+(v.x?PORT_LEG:0)}
  const previous=result[result.length-2]
  const join=v.x?{x:previous.x,y:corner.y}:{x:corner.x,y:previous.y}
  result=compactPolyline([...result.slice(0,-1),join,corner,stub,to])
 }
 return result
}
/** Remove just one corner and reconnect cleanly, retaining mandatory port legs. */
export function removeRouteBend(points:Point[],index:number,sourceSide:Side='right',targetSide:Side='left'):Point[]{
 if(index<=0||index>=points.length-1)return points
 const next=[...points.slice(0,index),...points.slice(index+1)]
 return enforcePortLegs(orthogonalize(next,sourceSide,targetSide),sourceSide,targetSide)
}
/** Replace detours with the minimum orthogonal route; does not reset labels. */
export function simplifyRoute(points:Point[],sourceSide:Side='right',targetSide:Side='left'):Point[]{
 if(points.length<2)return points
 return enforcePortLegs(editableRoute(points[0],points[points.length-1],undefined,sourceSide,targetSide),sourceSide,targetSide)
}
export type SharedPeer={id:string;points:Point[]}
const overlapAmount=(a:number,b:number,c:number,d:number)=>Math.max(0,Math.min(Math.max(a,b),Math.max(c,d))-Math.max(Math.min(a,b),Math.min(c,d)))
/** Find compatible peer wires within 12px and magnetically align one dragged
 * segment. Peers are prefiltered by line style, semantic kind and direction. */
export function snapSegmentToPeers(points:Point[],index:number,offset:number,peers:SharedPeer[],tolerance=12):{points:Point[];peerId?:string}{
 if(index<0||index>=points.length-1)return {points}
 const a=points[index],b=points[index+1],horizontal=a.y===b.y
 const coord=(horizontal?a.y:a.x)+offset
 let winner:{delta:number;id:string}|null=null
 for(const peer of peers)for(let i=1;i<peer.points.length;i++){
  const c=peer.points[i-1],d=peer.points[i]
  if(horizontal?c.y!==d.y:c.x!==d.x)continue
  const overlap=horizontal?overlapAmount(a.x,b.x,c.x,d.x):overlapAmount(a.y,b.y,c.y,d.y)
  if(overlap<14)continue
  const sharedCoordinate=horizontal?c.y:c.x,delta=sharedCoordinate-coord
  if(Math.abs(delta)>tolerance||winner&&Math.abs(delta)>=Math.abs(winner.delta))continue
  winner={delta,id:peer.id}
 }
 return {points:shiftSegment(points,index,offset+(winner?.delta||0)),peerId:winner?.id}
}
/** Keep the white crossing halo only on the private parts of an edge. Shared
 * compatible spans then render visually as one continuous cable. */
export function privateWireSpans(points:Point[],peers:SharedPeer[]):{a:Point;b:Point}[]{
 const result:{a:Point;b:Point}[]=[]
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],horizontal=a.y===b.y
  if(!sameAxis(a,b))continue
  const lower=horizontal?Math.min(a.x,b.x):Math.min(a.y,b.y)
  const upper=horizontal?Math.max(a.x,b.x):Math.max(a.y,b.y)
  const covered:[number,number][]=[]
  for(const peer of peers)for(let j=1;j<peer.points.length;j++){
   const c=peer.points[j-1],d=peer.points[j]
   if(horizontal?c.y!==d.y||c.y!==a.y:c.x!==d.x||c.x!==a.x)continue
   const start=Math.max(lower,horizontal?Math.min(c.x,d.x):Math.min(c.y,d.y))
   const end=Math.min(upper,horizontal?Math.max(c.x,d.x):Math.max(c.y,d.y))
   if(end-start>=1)covered.push([start,end])
  }
  covered.sort((u,v)=>u[0]-v[0]);let position=lower
  const emit=(start:number,end:number)=>{
   if(end-start<.1)return
   result.push(horizontal?{a:{x:start,y:a.y},b:{x:end,y:a.y}}:{a:{x:a.x,y:start},b:{x:a.x,y:end}})
  }
  for(const [start,end] of covered){if(start>position)emit(position,start);position=Math.max(position,end)}
  if(position<upper)emit(position,upper)
 }
 return result
}

/** Independent from edge route: label can be placed anywhere on the canvas. */
export type ManualLabelPosition={mode:'manual';x:number;y:number}

/** Same visual family only. A default dependency is dashed, not solid:
 * comparing raw lineStyle alone would incorrectly fuse the two. */
const DEFAULT_DASHED_RELATIONS=new Set(['include','extend','dependency','realization','import','merge','stereotype-application','manifestation','interaction-ref','required-interface'])
export type RouteStyle={relationKind?:string;lineStyle?:string;direction?:string}
export function compatibleSharedRoute(a:RouteStyle,b:RouteStyle):boolean{
 const effective=(v:RouteStyle)=>v.lineStyle|| (DEFAULT_DASHED_RELATIONS.has(v.relationKind||'')?'dashed':'solid')
 return (a.relationKind||'')===(b.relationKind||'')&&
  (a.direction||'forward')===(b.direction||'forward')&&
  effective(a)===effective(b)
}
