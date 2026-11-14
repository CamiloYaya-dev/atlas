/** Calcula el punto y la tangente real a media longitud de una ruta SVG de ATLAS.
 * No usa el vector directo entre cajas: ese vector falla en enlaces ortogonales. */
export interface AssemblyAnchor {x:number;y:number;angle:number}
interface Point {x:number;y:number}
const interpolate=(a:number,b:number,t:number)=>a+(b-a)*t
export function assemblyAnchor(path:string):AssemblyAnchor{
 const tokens=(path.match(/[MLCQ]|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)||[])
 let at=0,previous:Point={x:0,y:0};const points:Point[]=[]
 const value=()=>{const n=Number(tokens[at++]);if(!Number.isFinite(n))throw new Error('Ruta SVG inválida');return n}
 const point=():Point=>({x:value(),y:value()})
 const sample=(fn:(t:number)=>Point)=>{for(let i=1;i<=24;i++)points.push(fn(i/24))}
 while(at<tokens.length){
  const command=tokens[at++]
  if(command==='M'){previous=point();points.push(previous)}
  else if(command==='L'){previous=point();points.push(previous)}
  else if(command==='Q'){
   const start=previous,control=point(),end=point()
   sample(t=>({x:(1-t)**2*start.x+2*(1-t)*t*control.x+t*t*end.x,y:(1-t)**2*start.y+2*(1-t)*t*control.y+t*t*end.y}));previous=end
  }else if(command==='C'){
   const start=previous,a=point(),b=point(),end=point()
   sample(t=>({x:(1-t)**3*start.x+3*(1-t)**2*t*a.x+3*(1-t)*t*t*b.x+t**3*end.x,
    y:(1-t)**3*start.y+3*(1-t)**2*t*a.y+3*(1-t)*t*t*b.y+t**3*end.y}));previous=end
  }else throw new Error('Comando SVG de ensamblaje no soportado: '+command)
 }
 if(points.length<2)return {x:previous.x,y:previous.y,angle:0}
 const lengths=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.y-points[i].y))
 const total=lengths.reduce((a,b)=>a+b,0);let traveled=0
 for(let i=0;i<lengths.length;i++){
  if(traveled+lengths[i]>=total/2||i===lengths.length-1){
   const left=points[i],right=points[i+1],t=lengths[i]?Math.max(0,Math.min(1,(total/2-traveled)/lengths[i])):0
   return {x:interpolate(left.x,right.x,t),y:interpolate(left.y,right.y,t),angle:Math.atan2(right.y-left.y,right.x-left.x)*180/Math.PI}
  }
  traveled+=lengths[i]
 }
 return {x:previous.x,y:previous.y,angle:0}
}
