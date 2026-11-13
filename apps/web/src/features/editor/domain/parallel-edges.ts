/**
 * Geometría determinista para relaciones paralelas entre las mismas dos cajas.
 * Todas conservan sus puertos reales; las rutas se separan en el centro para que
 * cada etiqueta, flecha y zona de selección siga siendo independiente.
 */
import type {EdgePathStyle} from '@atlas/contracts'

export type ParallelRoute={path:string;labelX:number;labelY:number}
export type PortSide='top'|'bottom'|'left'|'right'
export type RouteEndpoints={sourceX:number;sourceY:number;targetX:number;targetY:number;offset:number;pathStyle:EdgePathStyle;sourcePosition?:PortSide;targetPosition?:PortSide}
const fmt=(n:number)=>Number(n.toFixed(2))
function roundedCorners(points:[number,number][],radius=10):string{
 const clean=points.filter((pt,i)=>i===0||Math.hypot(pt[0]-points[i-1][0],pt[1]-points[i-1][1])>.01)
 if(clean.length<2)return ''
 const path=[`M ${fmt(clean[0][0])},${fmt(clean[0][1])}`]
 for(let i=1;i<clean.length-1;i++){
  const [ax,ay]=clean[i-1],[x,y]=clean[i],[bx,by]=clean[i+1]
  const before=Math.hypot(x-ax,y-ay),after=Math.hypot(bx-x,by-y)
  if(!before||!after)continue
  const r=Math.min(radius,before/2,after/2)
  path.push(`L ${fmt(x-(x-ax)/before*r)},${fmt(y-(y-ay)/before*r)}`)
  path.push(`Q ${fmt(x)},${fmt(y)} ${fmt(x+(bx-x)/after*r)},${fmt(y+(by-y)/after*r)}`)
 }
 const [ex,ey]=clean[clean.length-1];path.push(`L ${fmt(ex)},${fmt(ey)}`)
 return path.join(' ')
}
function sideVector(position:PortSide){switch(position){case 'top':return [0,-1] as const;case 'bottom':return [0,1] as const;case 'left':return [-1,0] as const;case 'right':return [1,0] as const}}
export function parallelRoute({sourceX:sx,sourceY:sy,targetX:tx,targetY:ty,offset,pathStyle,sourcePosition,targetPosition}:RouteEndpoints):ParallelRoute{
 // Al entrar/salir por los lados el tramo terminal es horizontal. En puertos
 // superiores/inferiores es siempre vertical, incluso en rutas paralelas.
 if(sourcePosition&&targetPosition){
  const sv=sideVector(sourcePosition),tv=sideVector(targetPosition),lead=26
  const sx2=sx+sv[0]*lead,sy2=sy+sv[1]*lead,tx2=tx+tv[0]*lead,ty2=ty+tv[1]*lead
  const ddx=tx2-sx2,ddy=ty2-sy2,dist=Math.hypot(ddx,ddy)||1
  const nx=-ddy/dist,ny=ddx/dist
  const mx=(sx2+tx2)/2+nx*offset*1.1,my=(sy2+ty2)/2+ny*offset*1.1
  if(pathStyle==='bezier'){
   return {path:`M ${fmt(sx)},${fmt(sy)} C ${fmt(sx2)},${fmt(sy2)} ${fmt(mx-sv[0]*15)},${fmt(my-sv[1]*15)} ${fmt(mx)},${fmt(my)} C ${fmt(mx)},${fmt(my)} ${fmt(tx2)},${fmt(ty2)} ${fmt(tx)},${fmt(ty)}`,
    labelX:fmt(mx),labelY:fmt(my)}
  }
  // Trayecto central separado, conservando dos segmentos terminales normales a cada lado.
  const points:[number,number][]=[[sx,sy],[sx2,sy2]]
  if(pathStyle==='straight')points.push([mx,my])
  else if(Math.abs(ddx)>=Math.abs(ddy))points.push([mx,sy2],[mx,ty2])
  else points.push([sx2,my],[tx2,my])
  points.push([tx2,ty2],[tx,ty])
  return {path:pathStyle==='smoothstep'?roundedCorners(points):`M ${points.map(pt=>pt.map(fmt).join(',')).join(' L ')}`,
   labelX:fmt(mx),labelY:fmt(my)}
 }

 const dx=tx-sx,dy=ty-sy,dist=Math.hypot(dx,dy)||1
 const nx=-dy/dist,ny=dx/dist
 const midX=(sx+tx)/2,midY=(sy+ty)/2
 if(pathStyle==='bezier'){
  const bulge=offset*1.75
  const c1x=sx+dx*.32+nx*bulge,c1y=sy+dy*.32+ny*bulge
  const c2x=sx+dx*.68+nx*bulge,c2y=sy+dy*.68+ny*bulge
  return {path:`M ${fmt(sx)},${fmt(sy)} C ${fmt(c1x)},${fmt(c1y)} ${fmt(c2x)},${fmt(c2y)} ${fmt(tx)},${fmt(ty)}`,
   labelX:fmt(midX+nx*bulge*.75),labelY:fmt(midY+ny*bulge*.75)}
 }
 if(pathStyle==='straight'){
  const mx=midX+nx*offset,my=midY+ny*offset
  return {path:`M ${fmt(sx)},${fmt(sy)} L ${fmt(mx)},${fmt(my)} L ${fmt(tx)},${fmt(ty)}`,labelX:fmt(mx),labelY:fmt(my)}
 }
 // Para mantener ortogonalidad, las líneas horizontales se separan en Y y
 // las verticales en X. Los extremos regresan a su puerto original.
 const shift=offset*1.45
 if(Math.abs(dx)>=Math.abs(dy)){
  const ax=sx+dx*.27,bx=tx-dx*.27,y=midY+shift
  const points:[number,number][]=[[sx,sy],[ax,sy],[ax,y],[bx,y],[bx,ty],[tx,ty]]
  return {path:pathStyle==='smoothstep'?roundedCorners(points):`M ${points.map(point=>point.map(fmt).join(',')).join(' L ')}`,labelX:fmt(midX),labelY:fmt(y)}
 }
 const ay=sy+dy*.27,by=ty-dy*.27,x=midX+shift
 const points:[number,number][]=[[sx,sy],[sx,ay],[x,ay],[x,by],[tx,by],[tx,ty]]
 return {path:pathStyle==='smoothstep'?roundedCorners(points):`M ${points.map(point=>point.map(fmt).join(',')).join(' L ')}`,labelX:fmt(x),labelY:fmt(midY)}
}

/** El desplazamiento se calcula para el par sin orientación y es estable por ID. */
export function parallelOffsets<T extends {id:string;source:string;target:string}>(edges:T[],spacing=38):Map<string,number>{
 const groups=new Map<string,T[]>()
 for(const e of edges){const key=[e.source,e.target].sort().join('\u0000');groups.set(key,[...(groups.get(key)||[]),e])}
 const offsets=new Map<string,number>()
 for(const items of groups.values()){
  const sorted=[...items].sort((a,b)=>a.id.localeCompare(b.id))
  for(const [i,e] of sorted.entries())offsets.set(e.id,(i-(sorted.length-1)/2)*spacing*(e.source<=e.target?1:-1))
 }
 return offsets
}
