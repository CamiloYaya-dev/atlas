/**
 * Deterministic traffic-aware orthogonal routing for dense non-UML diagrams.
 * Routes may be LONGER to avoid crossings or overlap. Paths are presentational:
 * they never change the graph, source/target IDs or the persisted edge geometry.
 */
import type {Point,Side} from './manual-edge-routing'
import {compactPolyline} from './manual-edge-routing'
export type RouteBox={id:string;x:number;y:number;width:number;height:number}
export type RouteInput={id:string;source:string;target:string;from:Point;to:Point;sourceSide:Side;targetSide:Side;sourceBundleKey?:string;targetBundleKey?:string}
export type RouteResult={points:Point[];crossings:number;overlaps:number;length:number;labelX:number;labelY:number;bundled:boolean}
const GAP=24
const between=(x:number,a:number,b:number)=>x>=Math.min(a,b)-.001&&x<=Math.max(a,b)+.001
const length=(a:Point,b:Point)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y)
const straight=(a:Point,b:Point)=>a.x===b.x||a.y===b.y
const padded=(r:RouteBox)=>({x0:r.x-10,x1:r.x+r.width+10,y0:r.y-10,y1:r.y+r.height+10})
const blocked=(a:Point,b:Point,r:RouteBox)=>{
 if(!straight(a,b))return true
 const o=padded(r)
 if(a.x===b.x)return a.x>o.x0&&a.x<o.x1&&Math.max(a.y,b.y)>o.y0&&Math.min(a.y,b.y)<o.y1
 return a.y>o.y0&&a.y<o.y1&&Math.max(a.x,b.x)>o.x0&&Math.min(a.x,b.x)<o.x1
}
export function wireInterference(a:Point,b:Point,c:Point,d:Point):{cross:boolean;overlap:number}{
 if(a.x===b.x&&c.y===d.y){return {cross:between(a.x,c.x,d.x)&&between(c.y,a.y,b.y),overlap:0}}
 if(a.y===b.y&&c.x===d.x){return {cross:between(c.x,a.x,b.x)&&between(a.y,c.y,d.y),overlap:0}}
 if(a.x===b.x&&c.x===d.x&&a.x===c.x){return {cross:false,overlap:Math.max(0,Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y))-Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y)))}}
 if(a.y===b.y&&c.y===d.y&&a.y===c.y){return {cross:false,overlap:Math.max(0,Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))-Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x)))}}
 return {cross:false,overlap:0}
}
const stub=(p:Point,side:Side,outward=true):Point=>{
 const offset=(outward?1:-1)*GAP
 if(side==='left')return {x:p.x-offset,y:p.y}
 if(side==='top')return {x:p.x,y:p.y-offset}
 if(side==='bottom')return {x:p.x,y:p.y+offset}
 return {x:p.x+offset,y:p.y}
}
function bestRoute(edge:RouteInput,boxes:RouteBox[],traffic:{edge:RouteInput;points:Point[]}[],preferredX?:number):RouteResult|null{
 const start=stub(edge.from,edge.sourceSide,true)
 const end=stub(edge.to,edge.targetSide,true)
 // Safe corridors outside all visible boxes. Unrelated long edges should
 // occupy their own channels rather than cross the same central node band.
 const sorted=(list:number[])=>[...new Set(list.map(x=>Math.round(x)))].sort((a,b)=>a-b)
 const xs=sorted([start.x,end.x,Math.round((start.x+end.x)/2),...boxes.flatMap(r=>[r.x-GAP,r.x+r.width+GAP])])
 const ys=sorted([start.y,end.y,Math.round((start.y+end.y)/2),...boxes.flatMap(r=>[r.y-GAP,r.y+r.height+GAP])])
 let best:RouteResult|null=null,bestScore=Infinity
 const check=(via:Point[])=>{
  const points=compactPolyline([edge.from,start,...via,end,edge.to])
  if(points.length>14)return
  const segments=points.slice(1).map((b,i)=>[points[i],b] as const)
  if(segments.some(([a,b])=>!straight(a,b)||boxes.some(r=>blocked(a,b,r))))return
  let distance=0,turns=0,crossings=0,overlaps=0
  for(let k=0;k<segments.length;k++){
   const [a,b]=segments[k]
   distance+=length(a,b)
   if(k>0&&((segments[k-1][0].x===segments[k-1][1].x)!==(a.x===b.x)))turns++
   for(const previous of traffic){
    const sameSource=!!edge.sourceBundleKey&&edge.sourceBundleKey===previous.edge.sourceBundleKey
    const sameTarget=!!edge.targetBundleKey&&edge.targetBundleKey===previous.edge.targetBundleKey
    for(let j=1;j<previous.points.length;j++){
     const prevA=previous.points[j-1],prevB=previous.points[j]
     const hit=wireInterference(a,b,prevA,prevB)
     // Overlapping wires from the SAME endpoint form a common visual trunk.
     // Unrelated origins never share this exemption.
     if(hit.overlap&&!sameSource&&!sameTarget)overlaps+=hit.overlap
     if(hit.cross){
      const nearOrigin=sameSource&&(length(a,edge.from)<90||length(b,edge.from)<90)
      const nearDestination=sameTarget&&(length(a,edge.to)<90||length(b,edge.to)<90)
      if(!nearOrigin&&!nearDestination)crossings++
     }
    }
   }
  }
  // Crossing is more expensive than even a 300px detour; shared segments
  // cause ambiguous lines and get a proportional penalty.
  const usesTrunk=preferredX!==undefined&&points.some(p=>p.x===preferredX)
  const direct=Math.max(1,length(edge.from,edge.to))
  const excess=Math.max(0,distance-direct*2.15)
  const score=distance+excess*2+turns*55+crossings*500+overlaps*2.5-(usesTrunk?230:0)
  if(score<bestScore){
   bestScore=score
   // For bundled fan-outs, labels belong on each branch, NOT the shared trunk.
   const branch=points.slice(1).map((p,i)=>({a:points[i],b:p,dist:length(points[i],p)}))
    .filter(part=>part.dist>45).sort((a,b)=>b.dist-a.dist)[0]
   const label=branch?{x:(branch.a.x+branch.b.x)/2,y:(branch.a.y+branch.b.y)/2}:edge.to
   best={points,crossings,overlaps,length:distance,labelX:label.x,labelY:label.y-13,bundled:usesTrunk}
  }
 }
 check([{x:end.x,y:start.y}]);check([{x:start.x,y:end.y}])
 if(preferredX!==undefined)check([{x:preferredX,y:start.y},{x:preferredX,y:end.y}])
 for(const x of xs)check([{x,y:start.y},{x,y:end.y}])
 for(const y of ys)check([{x:start.x,y},{x:end.x,y}])
 // Two corridor changes can reach a node behind a blocking middle layer.
 if(!best){const candidatesX=xs.filter(x=>Math.abs(x-start.x)<550||Math.abs(x-end.x)<550)
  const candidatesY=ys.filter(y=>Math.abs(y-start.y)<550||Math.abs(y-end.y)<550)
  for(const x of candidatesX.slice(0,16))for(const y of candidatesY.slice(0,16)){
   check([{x,y:start.y},{x,y},{x:end.x,y}])
   check([{x:start.x,y},{x,y},{x,y:end.y}])
  }
 }
 return best
}
export function routeDenseDiagram(edges:RouteInput[],boxes:RouteBox[]):Map<string,RouteResult>{
 const results=new Map<string,RouteResult>()
 const traffic:{edge:RouteInput;points:Point[]}[]=[]
 // The only eligible visual bus has ONE semantic origin (or destination)
 // and a compatible line family. No unrelated paths are implicitly merged.
 const sourceCounts=new Map<string,number>(),targetCounts=new Map<string,number>()
 for(const e of edges){if(e.sourceBundleKey)sourceCounts.set(e.sourceBundleKey,(sourceCounts.get(e.sourceBundleKey)||0)+1);if(e.targetBundleKey)targetCounts.set(e.targetBundleKey,(targetCounts.get(e.targetBundleKey)||0)+1)}
 for(const edge of [...edges].sort((a,b)=>(sourceCounts.get(b.sourceBundleKey||'')||0)-(sourceCounts.get(a.sourceBundleKey||'')||0)||a.id.localeCompare(b.id))){
  if(edge.source===edge.target)continue
  const obstacles=boxes.filter(b=>b.id!==edge.source&&b.id!==edge.target)
  const useSource=(sourceCounts.get(edge.sourceBundleKey||'')||0)>=4&&edge.sourceSide==='right'&&edge.to.x-edge.from.x>225
  const useTarget=(targetCounts.get(edge.targetBundleKey||'')||0)>=4&&edge.targetSide==='left'&&edge.to.x-edge.from.x>225
  const preferredX=useSource?Math.round(edge.from.x+75):useTarget?Math.round(edge.to.x-75):undefined
  const result=bestRoute(edge,obstacles,traffic,preferredX)
  if(result){results.set(edge.id,result);traffic.push({edge,points:result.points})}
 }
 // Labels are laid out AFTER routes: keep them out of boxes and out of each
 // other's way. Prioritize distinct outgoing/incoming branch segments.
 const assignedLabels:Point[]=[]
 for(const edge of edges){
  const route=results.get(edge.id)
  if(!route)continue
  let choice={x:route.labelX,y:route.labelY},cost=Infinity
  for(let i=1;i<route.points.length;i++){
   const a=route.points[i-1],b=route.points[i],seg=length(a,b)
   if(seg<65)continue
   for(const t of [.28,.5,.72]){
    const horizontal=a.y===b.y
    const p={x:a.x+(b.x-a.x)*t+(horizontal?0:18),y:a.y+(b.y-a.y)*t+(horizontal?-15:0)}
    const boxPenalty=boxes.some(r=>p.x>=r.x-25&&p.x<=r.x+r.width+25&&p.y>=r.y-20&&p.y<=r.y+r.height+20)?1e4:0
    const labelPenalty=assignedLabels.reduce((sum,q)=>sum+((Math.abs(p.x-q.x)<160&&Math.abs(p.y-q.y)<26)?600:0),0)
    const sharePenalty=route.bundled&&i<=2?280:0
    const preference=(i/route.points.length)*-40+(horizontal?-35:50)
    const score=boxPenalty+labelPenalty+sharePenalty+preference+Math.abs(seg-150)*.08
    if(score<cost){cost=score;choice=p}
   }
  }
  route.labelX=Math.round(choice.x);route.labelY=Math.round(choice.y)
  assignedLabels.push(choice)
 }
 return results
}
