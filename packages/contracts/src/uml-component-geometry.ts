/** Calcula el punto y la tangente real a media longitud de una ruta SVG de ATLAS.
 * No usa el vector directo entre cajas: ese vector falla en enlaces ortogonales. */
export interface AssemblyAnchor {x:number;y:number;angle:number}
interface Point {x:number;y:number}
const interpolate=(a:number,b:number,t:number)=>a+(b-a)*t
export function assemblyAnchor(path:string):AssemblyAnchor{
 const tokens=(path.match(/[MLCQ]|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)||[])
 let at=0,previous:Point={x:0,y:0};const points:Point[]=[];const straight:{a:Point;b:Point;length:number}[]=[]
 const value=()=>{const n=Number(tokens[at++]);if(!Number.isFinite(n))throw new Error('Ruta SVG inválida');return n}
 const point=():Point=>({x:value(),y:value()})
 const sample=(fn:(t:number)=>Point)=>{for(let i=1;i<=24;i++)points.push(fn(i/24))}
 while(at<tokens.length){
  const command=tokens[at++]
  if(command==='M'){previous=point();points.push(previous)}
  else if(command==='L'){const next=point();straight.push({a:previous,b:next,length:Math.hypot(next.x-previous.x,next.y-previous.y)});previous=next;points.push(previous)}
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
 // En rutas ortogonales, el símbolo debe estar sobre un TRAMO recto
 // suficientemente largo, nunca sobre una esquina o un codo.
 const suitable=straight.filter(segment=>segment.length>=56).sort((a,b)=>b.length-a.length)[0]
 if(suitable)return {x:(suitable.a.x+suitable.b.x)/2,y:(suitable.a.y+suitable.b.y)/2,
  angle:Math.atan2(suitable.b.y-suitable.a.y,suitable.b.x-suitable.a.x)*180/Math.PI}

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
import type {Diagram,DiagramEdge,ModelElement,ProjectDocument} from './index'
import {componentContract,componentInterfaceCompatible,componentRegistry,componentTitle} from './uml-component-policy'
import {atlasNodeSize} from './node-sizing'
import {umlAbsolutePosition,umlNodeDepth} from './uml-containers'
import {umlAttributeText,umlOperationTextResolved} from './uml-structure'
import {umlTypeIdentifier} from './uml-class-policy'
import {classFacingPort,classPort,classPortAngle,classRelationRoute} from './uml-class-geometry'
import {umlDisplayLabel,umlRelationNotation} from './uml-notation'
import {parallelOffsets} from './parallel-edges'
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
const ink='#506986'
export function componentGlyph(e:ModelElement,size:{width:number;height:number},names:Record<string,string>,children:boolean,contracts?:ReturnType<typeof componentContract>){
 const {width:w,height:h}=size,t=e.type,port=t==='uml-port',role=t==='uml-part'||t==='uml-reference-role',pkg=t==='uml-package',note=t==='uml-comment'||t==='uml-constraint',component=t==='component';const text=(x:number,y:number,v:string,attrs='')=>`<text x="${x}" y="${y}" ${attrs.includes('font-size=')?'':'font-size="12"'} fill="#344965" ${attrs}>${esc(v)}</text>`;const line=(y:number)=>`<path d="M 0 ${y} H ${w}" stroke="${ink}" stroke-width="1"/>`;const title=componentTitle(e,names)
 if(port)return `<rect x=".7" y=".7" width="${w-1.4}" height="${h-1.4}" stroke="${ink}" fill="white" stroke-width="1.5"/>${text(w+6,27,'Port','opacity=".62" font-size="10"')}${text(w+6,41,title)}`
 const limit=Math.max(8,Math.floor((w-20)/7)),clip=(v:string)=>v.length>limit?v.slice(0,limit-1)+'…':v
 const shape=pkg?`<path d="M 1 22 V 1 H ${Math.min(105,w*.4)} V 22 H ${w-1} V ${h-1} H 1 Z" fill="white" stroke="${ink}"/>`:note?`<path d="M 1 1 H ${w-19} L ${w-1} 19 V ${h-1} H 1 Z M ${w-19} 1 V 19 H ${w-1}" fill="white" stroke="${ink}"/>`:`<rect x=".7" y=".7" width="${w-1.4}" height="${h-1.4}" fill="white" stroke="${ink}" stroke-width="1.4" ${t==='uml-reference-role'?'stroke-dasharray="6 4"':''}/>`
 const tag=component?'«component»':t==='uml-interface'?'«interface»':t==='uml-artifact'?'«artifact»':role?t==='uml-part'?'Part':'Reference Role':pkg?'Package':umlTypeIdentifier(e)
 let markup=shape+text(w/2,pkg?36:17,tag,'text-anchor="middle" opacity=".68" font-size="10"')+text(w/2,pkg?52:36,clip(t==='uml-constraint'?`{${e.uml?.expression||e.name}}`:note?e.uml?.note||e.name:title),`text-anchor="middle" font-weight="600" ${e.uml?.abstract?'font-style="italic"':''}`)
 if(component)markup+=`<g transform="translate(${w-32} 7)" stroke="${ink}" fill="white"><rect x="6" y="0" width="19" height="24"/><rect x="0" y="5" width="12" height="5"/><rect x="0" y="14" width="12" height="5"/></g>`
 if((component||t==='uml-interface'||t==='uml-class'||t==='uml-datatype'||t==='uml-artifact')&&!children){let y=47;for(const group of [e.uml?.attributes?.map(a=>umlAttributeText(a,true,names))||[],e.uml?.operations?.map(o=>umlOperationTextResolved(o,names))||[],...(component&&contracts?[contracts.provided.length?['provided: '+contracts.provided.map(id=>names[id]).join(', ')]:[],contracts.required.length?['required: '+contracts.required.map(id=>names[id]).join(', ')]:[]]:[])]){if(!group.length||y+15>h)continue;markup+=line(y);y+=15;for(const v of group){if(y>h-4)break;markup+=text(9,y,clip(v));y+=17}}if(t==='uml-artifact'&&e.uml?.component?.kind==='artifact'&&e.uml.component.fileName&&y+15<h)markup+=text(9,y+13,clip(e.uml.component.fileName))}
 if(children&&component)markup+=line(45)+text(9,61,'internal structure','opacity=".75"');return markup
}
export function componentAssemblyDirection(doc:ProjectDocument,d:Diagram,e:DiagramEdge):'forward'|'reverse'|undefined{
 if(!['assembly','wiring'].includes(e.relationKind||'')||e.componentEnds&&e.componentEnds.length>2)return;const from=d.nodes.find(n=>n.id===e.source),to=d.nodes.find(n=>n.id===e.target);if(!from||!to)return;const r=e.componentRelationId?componentRegistry(doc)[e.componentRelationId]:undefined;if(r?.connector&&(doc.elements[from.elementId]?.type!=='uml-port'||doc.elements[to.elementId]?.type!=='uml-port'))return;const x=componentContract(doc,from.elementId),y=componentContract(doc,to.elementId);if(x.incomplete||y.incomplete||x.provided.length+x.required.length!==1||y.provided.length+y.required.length!==1)return;if(x.provided.some(p=>y.required.some(q=>componentInterfaceCompatible(doc,p,q))))return 'forward';if(y.provided.some(p=>x.required.some(q=>componentInterfaceCompatible(doc,p,q))))return 'reverse';return
}
export function componentAssemblyMarkup(){return `<path d="M -23,0 H -12 M 15,0 H 23"/><circle cx="-5" cy="0" r="7" fill="white"/><path d="M 3,-11 Q 25,0 3,11"/>`}
export function componentHandle(handle:string|undefined,port:boolean):string|undefined{return port&&handle?.startsWith('top-')?'top-2':port&&handle?.startsWith('bottom-')?'bottom-2':handle}
export function componentSvgScene(doc:ProjectDocument,d:Diagram){
 const names=Object.fromEntries(Object.values(doc.elements).map(e=>[e.id,e.name])),bounds=new Map(d.nodes.flatMap(n=>{const e=doc.elements[n.elementId];if(!e)return [];const children=d.nodes.some(x=>x.parentNodeId===n.id);return [[n.id,{...umlAbsolutePosition(d,n),...atlasNodeSize(d.type,e,n,umlNodeDepth(d,n),children),e,children,internal:d.nodes.some(x=>x.parentNodeId===n.id&&doc.elements[x.elementId]?.type!=='uml-port')}] as const]})),offsets=parallelOffsets(d.edges)
 const maskX=Math.min(0,...[...bounds.values()].map(b=>b.x))-200,maskY=Math.min(0,...[...bounds.values()].map(b=>b.y))-200,maskW=Math.max(100,...[...bounds.values()].map(b=>b.x+b.width))+200-maskX,maskH=Math.max(100,...[...bounds.values()].map(b=>b.y+b.height))+200-maskY
 const route=(e:DiagramEdge)=>{const a=bounds.get(e.source),b=bounds.get(e.target);if(!a||!b)return;const p=classPort(a,componentHandle(e.sourceHandle,a.e.type==='uml-port'),true),q=classPort(b,componentHandle(e.targetHandle,b.e.type==='uml-port'),false),r=classRelationRoute({sourceX:p.x,sourceY:p.y,targetX:q.x,targetY:q.y,sourcePosition:p.side,targetPosition:q.side,offset:offsets.get(e.id)||0,pathStyle:e.pathStyle||'smoothstep'},false);return {p,q,r}}
 const terminal=(kind:string,p:ReturnType<typeof classPort>)=>{const symbol=kind==='triangle'?'<path d="M 0 0 L 18 -10 L 18 10 Z" fill="white"/>':kind==='open-arrow'?'<path d="M 13 -7 L 0 0 L 13 7"/>':kind==='ball'?'<circle cx="7" cy="0" r="7" fill="white"/>':kind==='socket'?'<path d="M 3 -10 Q 24 0 3 10"/>':'';return symbol?`<g transform="translate(${p.x} ${p.y}) rotate(${classPortAngle(p.side)})" stroke="${ink}" fill="none" stroke-width="1.6">${symbol}</g>`:''}
 const edges=d.edges.map((e,i)=>{const g=route(e);if(!g)return '';const {p,q,r}=g,n=umlRelationNotation(e.relationKind||''),hub={x:r.labelX,y:r.labelY},extra=e.componentEnds?.slice(2)||[],direction=componentAssemblyDirection(doc,d,e),anchor=direction?assemblyAnchor(r.path):undefined,angle=(anchor?.angle||0)+(direction==='reverse'?180:0),target=e.annotationTargetEdgeId&&d.edges.find(x=>x.id===e.annotationTargetEdgeId),targetRoute=target?route(target):undefined,path=targetRoute?`M ${p.x} ${p.y} L ${targetRoute.r.labelX} ${targetRoute.r.labelY}`:extra.length?`M ${p.x} ${p.y} L ${hub.x} ${hub.y} L ${q.x} ${q.y}`:r.path,mask=anchor?`<defs><mask id="cmp-gap-${i}" maskUnits="userSpaceOnUse" x="${maskX}" y="${maskY}" width="${maskW}" height="${maskH}"><rect x="${maskX}" y="${maskY}" width="${maskW}" height="${maskH}" fill="white"/><rect x="-24" y="-15" width="48" height="30" transform="translate(${anchor.x} ${anchor.y}) rotate(${angle})" fill="black"/></mask></defs>`:'';return `${mask}<path d="${path}" stroke="${ink}" stroke-width="1.7" fill="none" ${n.stroke==='dashed'?'stroke-dasharray="7 5"':''} ${anchor?`mask="url(#cmp-gap-${i})"`:''}/>${terminal(n.start,p)}${terminal(n.end,q)}${anchor?`<g data-uml-terminal="assembly" transform="translate(${anchor.x} ${anchor.y}) rotate(${angle})" fill="none" stroke="${ink}" stroke-width="1.8">${componentAssemblyMarkup()}</g>`:''}${extra.length?`<circle cx="${hub.x}" cy="${hub.y}" r="4" fill="${ink}"/>`+extra.map(end=>{const box=bounds.get(end.nodeId);if(!box)return '';const m=end.handle?classPort(box,end.handle,false):classFacingPort(box,hub);return `<path d="M ${hub.x} ${hub.y} L ${m.x} ${m.y}" fill="none" stroke="${ink}"/>`}).join(''):''}<g font-size="11" text-anchor="middle"><text aria-hidden="true" x="${anchor?.x??hub.x}" y="${(anchor?.y??hub.y)-15}" fill="none" stroke="white" stroke-width="3">${esc(umlDisplayLabel(d.type,e,doc,d))}</text><text x="${anchor?.x??hub.x}" y="${(anchor?.y??hub.y)-15}" fill="${ink}">${esc(umlDisplayLabel(d.type,e,doc,d))}</text></g>`}).join('')
 const glyph=(b:typeof bounds extends Map<string,infer T>?T:never)=>`<g transform="translate(${b.x} ${b.y})">${componentGlyph(b.e,b,names,b.internal,b.e.type==='component'?componentContract(doc,b.e.id):undefined)}</g>`;const boxes=[...bounds.values()],minX=Math.min(0,...boxes.map(b=>b.x-30)),minY=Math.min(0,...boxes.map(b=>b.y-30)),maxX=Math.max(100,...boxes.map(b=>b.x+b.width+(b.e.type==='uml-port'?Math.max(50,componentTitle(b.e,names).length*7):30))),maxY=Math.max(100,...boxes.map(b=>b.y+b.height+30));return {minX,minY,width:maxX-minX,height:maxY-minY,markup:boxes.filter(b=>b.children).map(glyph).join('')+edges+boxes.filter(b=>!b.children).map(glyph).join('')}
}
