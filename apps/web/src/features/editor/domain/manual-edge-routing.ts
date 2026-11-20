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
