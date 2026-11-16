import type {Diagram,DiagramNode,ModelElement,ProjectDocument} from './index'
import type {ClassBounds} from './uml-class-geometry'
import {classPort,classPortAngle,classRelationRoute} from './uml-class-geometry'
import {activityEdgeLabel,activityNodeLabel} from './uml-activity-policy'
import {atlasNodeSize} from './node-sizing'
import {umlAbsolutePosition,umlNodeDepth} from './uml-containers'
import {activitySnapPin} from './uml-activity-layout'
import {parallelOffsets} from './parallel-edges'
import type {PortSide} from './parallel-edges'
export type ActivityPort={id:string;x:number;y:number;side:PortSide}
export function activityPorts(e:ModelElement):ActivityPort[]{
 if(['uml-partition','uml-activity-interruptible-region'].includes(e.type))return []
 const card:ActivityPort[]=[{id:'left',x:0,y:.5,side:'left'},{id:'top-2',x:.5,y:0,side:'top'},{id:'right',x:1,y:.5,side:'right'},{id:'bottom-2',x:.5,y:1,side:'bottom'}]
 if(['uml-start','uml-end','uml-flow-final','uml-decision'].includes(e.type)){const v=e.type==='uml-decision'?2/84:.06;return card.map(p=>({...p,x:p.x===0?v:p.x===1?1-v:p.x,y:p.y===0?v:p.y===1?1-v:p.y}))}
 if(e.type==='uml-fork'){
  const row:ActivityPort[]=[{id:'left',x:2/160,y:.5,side:'left'},...([.2,.5,.8].map((x,i)=>({id:`top-${i+1}`,x,y:.29,side:'top' as const}))),{id:'right',x:158/160,y:.5,side:'right'},...([.2,.5,.8].map((x,i)=>({id:`bottom-${i+1}`,x,y:.71,side:'bottom' as const})))]
  const sides:Record<PortSide,PortSide>={left:'top',right:'bottom',top:'right',bottom:'left'}
  return e.activityDetail?.orientation==='vertical'?row.map(p=>({...p,x:1-p.y,y:p.x,side:sides[p.side]})):row
 }
 if(e.type==='uml-activity-pin')return card
 return [card[0],...([.2,.5,.8].map((x,i)=>({id:`top-${i+1}`,x,y:0,side:'top' as const}))),card[2],...([.2,.5,.8].map((x,i)=>({id:`bottom-${i+1}`,x,y:1,side:'bottom' as const})))]
}
export function activityPort(r:ClassBounds,e:ModelElement,handle:string|undefined,source:boolean){const ports=activityPorts(e),id=handle||(source?'right':'left'),p=ports.find(p=>p.id===id)||ports.find(p=>p.id===id.replace(/-(1|3)$/,'-2'))||ports[0];return p?{x:r.x+p.x*r.width,y:r.y+p.y*r.height,side:p.side}:classPort(r,handle,source)}
export function activitySymbol(e:ModelElement){const k=e.activityDetail?.kind;return e.type==='uml-action'&&k==='sendSignal'?'M 1 1 H 80 L 99 50 L 80 99 H 1 Z':e.type==='uml-action'&&k==='acceptEvent'?'M 1 1 H 99 V 99 H 1 L 21 50 Z':e.type==='uml-action'&&k==='timeEvent'?'M 35 5 H 65 L 35 95 H 65 Z':undefined}
/** ExceptionHandler is a directed lightning connector, not an interrupting ActivityEdge.
 * Its final segment approaches the receiving pin perpendicular to the selected port. */
export function activityExceptionRoute(a:{x:number;y:number;side:string},b:{x:number;y:number;side:string}){
 const normal=(side:string)=>side==='left'?[-1,0]:side==='right'?[1,0]:side==='top'?[0,-1]:[0,1];const [ax,ay]=normal(a.side),[bx,by]=normal(b.side),p={x:a.x+ax*16,y:a.y+ay*16},q={x:b.x+bx*16,y:b.y+by*16};const dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy)||1,amp=Math.min(18,len/5),point=(t:number,offset:number)=>`${p.x+dx*t-dy/len*offset} ${p.y+dy*t+dx/len*offset}`;return {path:`M ${a.x} ${a.y} L ${p.x} ${p.y} L ${point(.40,0)} L ${point(.53,-amp)} L ${point(.47,amp)} L ${point(.60,0)} L ${q.x} ${q.y} L ${b.x} ${b.y}`,labelX:(p.x+q.x)/2,labelY:(p.y+q.y)/2}
}
export function activityInterruptPath(x:number,y:number){return `M ${x-13} ${y+9} L ${x-3} ${y-8} L ${x+4} ${y+5} L ${x+13} ${y-9}`}
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
const text=(x:number,y:number,value:unknown,size=12,extra='')=>`<text x="${x}" y="${y}" fill="#344965" font-size="${size}" text-anchor="middle" ${extra}>${esc(value)}</text>`
const isGroup=(e:ModelElement)=>['uml-partition','uml-activity-interruptible-region'].includes(e.type)
/** Shared representation: parameters are attached to an activity frame, not a parent box. */
export function activityFrameBounds(doc:ProjectDocument,d:Diagram):ClassBounds|undefined{
 if(!d.activity?.showFrame&&!d.nodes.some(n=>doc.elements[n.elementId]?.type==='uml-activity-parameter'))return undefined
 const core=d.nodes.filter(n=>doc.elements[n.elementId]&&!['uml-activity-parameter','uml-activity-pin'].includes(doc.elements[n.elementId].type)).map(n=>({...umlAbsolutePosition(d,n),...atlasNodeSize(d.type,doc.elements[n.elementId],n)}))
 const minX=Math.min(0,...core.map(n=>n.x-100)),minY=Math.min(0,...core.map(n=>n.y-75)),maxX=Math.max(350,...core.map(n=>n.x+n.width+100)),maxY=Math.max(220,...core.map(n=>n.y+n.height+75))
 return {x:minX,y:minY,width:maxX-minX,height:maxY-minY}
}
export function activityDisplayPosition(doc:ProjectDocument,d:Diagram,n:DiagramNode,frame=activityFrameBounds(doc,d)){
 const e=doc.elements[n.elementId],pos=umlAbsolutePosition(d,n);if(!e)return pos
 if(e.type==='uml-activity-parameter'&&frame){const size=atlasNodeSize(d.type,e,n);return {x:(e.activityDetail?.role==='output'?frame.x+frame.width:frame.x)-size.width/2,y:Math.max(frame.y+35,Math.min(frame.y+frame.height-size.height,n.y))}}
 if(e.type==='uml-activity-pin'&&n.parentNodeId){const parent=d.nodes.find(p=>p.id===n.parentNodeId),p=parent&&doc.elements[parent.elementId];if(parent&&p?.type==='uml-action'){const base=umlAbsolutePosition(d,parent),snap=activitySnapPin(atlasNodeSize(d.type,p,parent),atlasNodeSize(d.type,e,n),e.activityDetail?.role,n.y);return {x:base.x+snap.x,y:base.y+snap.y}}}return pos
}
export function activityParameterLabel(doc:ProjectDocument,d:Diagram,e:ModelElement){const p=d.activity?.parameters?.find(x=>x.id===e.activityDetail?.parameterId);if(!p)return e.name;const type=(p.typeId?doc.elements[p.typeId]?.name:p.externalType)||'';return `${p.name}${type?`: ${type}`:''} [${p.lower??1}..${p.upper??1}]`}
export function activityMembershipLabel(doc:ProjectDocument,e:ModelElement){return (e.activityDetail?.partitionIds||[]).map(id=>doc.elements[id]?.name).filter(Boolean).join(' :: ')}
export function activitySvgScene(doc:ProjectDocument,d:Diagram){
 const frameBounds=activityFrameBounds(doc,d);const records=d.nodes.flatMap(n=>{const e=doc.elements[n.elementId];return e?[{...activityDisplayPosition(doc,d,n,frameBounds),...atlasNodeSize(d.type,e,n,umlNodeDepth(d,n),d.nodes.some(c=>c.parentNodeId===n.id)),n,e}]:[]}),lookup=new Map(records.map(r=>[r.n.id,r])),offsets=parallelOffsets(d.edges),extents:{x:number;y:number}[]=[],routes=new Map<string,{a:ReturnType<typeof activityPort>;b:ReturnType<typeof activityPort>;route:ReturnType<typeof classRelationRoute>}>()
 for(const e of d.edges){const r=lookup.get(e.source),t=lookup.get(e.target);if(!r||!t)continue;const a=activityPort(r,r.e,e.sourceHandle,true),b=activityPort(t,t.e,e.targetHandle,false),route=e.relationKind==='exception-handler'?activityExceptionRoute(a,b):classRelationRoute({sourceX:a.x,sourceY:a.y,targetX:b.x,targetY:b.y,sourcePosition:a.side,targetPosition:b.side,offset:offsets.get(e.id)||0,pathStyle:e.pathStyle||'smoothstep'},e.source===e.target);routes.set(e.id,{a,b,route})}
 const paths=d.edges.map(e=>{const r=routes.get(e.id);if(!r)return '';const{a,b,route}=r,anchor=e.annotationTargetEdgeId?routes.get(e.annotationTargetEdgeId)?.route:undefined,annotation=e.relationKind==='annotation',exception=e.relationKind==='exception-handler',interrupted=!!e.activityEdge?.interruptingRegionId&&!exception,path=anchor?`M ${a.x} ${a.y} L ${anchor.labelX} ${anchor.labelY}`:route.path;const nums=path.match(/-?\d+(?:\.\d+)?/g)?.map(Number)||[];for(let i=0;i+1<nums.length;i+=2)extents.push({x:nums[i],y:nums[i+1]});extents.push({x:route.labelX-120,y:route.labelY-20},{x:route.labelX+120,y:route.labelY+18});return `<path ${exception?'data-activity-exception="true"':''} d="${path}" stroke="#506986" stroke-width="1.7" fill="none" ${annotation?'stroke-dasharray="7 5"':''}/>${annotation?'':`<g transform="translate(${b.x} ${b.y}) rotate(${classPortAngle(b.side)})"><path d="M14 -7 L0 0 L14 7" fill="none" stroke="#506986" stroke-width="1.7"/></g>`}${interrupted?`<path data-activity-interrupt="true" d="${activityInterruptPath(route.labelX,route.labelY)}" stroke="#506986" stroke-width="2" fill="none"/>`:''}${text(route.labelX,route.labelY-10,activityEdgeLabel(d,e,doc),11)}`}).join('')
 const shapes=(group:boolean)=>records.filter(r=>isGroup(r.e)===group).map(r=>{const{e,x,y,width:w,height:h}=r,a=e.activityDetail||{},type=e.type,cx=w/2,cy=h/2,rect=(rx=0,extra='')=>`<rect x="1" y="1" width="${w-2}" height="${h-2}" rx="${rx}" fill="white" stroke="#506986" stroke-width="1.5" ${extra}/>`,title=text(cx,cy+5,type==='uml-activity-parameter'?activityParameterLabel(doc,d,e):e.name),label=text(cx,-8,`«${activityNodeLabel(e)}»`,10,'opacity=".7"');let body='';if(type==='uml-start'||type==='uml-end'||type==='uml-flow-final'){body=`<circle cx="${cx}" cy="${cy}" r="${Math.min(w,h)*.45}" fill="${type==='uml-start'?'#344965':'white'}" stroke="#344965" stroke-width="2"/>${type==='uml-end'?`<circle cx="${cx}" cy="${cy}" r="${Math.min(w,h)*.316}" fill="#344965"/>`:type==='uml-flow-final'?`<path d="M${w*.3} ${h*.3} L${w*.7} ${h*.7} M${w*.7} ${h*.3} L${w*.3} ${h*.7}" stroke="#344965" stroke-width="2"/>`:''}`}
 else if(type==='uml-decision')body=`<polygon points="${cx},${h*2/84} ${w*82/84},${cy} ${cx},${h*82/84} ${w*2/84},${cy}" fill="white" stroke="#405a80" stroke-width="2"/>`
 else if(type==='uml-fork')body=a.orientation==='vertical'?`<rect x="${w*.29}" y="${h*2/160}" width="${w*.42}" height="${h*156/160}" fill="#1e2741"/>`:`<rect x="${w*2/160}" y="${h*.29}" width="${w*156/160}" height="${h*.42}" fill="#1e2741"/>`
 else if(group)body=rect(type==='uml-activity-interruptible-region'?12:0,`fill-opacity=".12" ${type==='uml-activity-interruptible-region'?'stroke-dasharray="7 5"':''}`)+text(cx,22,e.name)
 else if(type==='uml-activity-pin')body=rect()+text(cx,h+11,e.name,10)
 else if(type==='uml-comment'||type==='uml-constraint')body=`<path d="M1 1 H${w-19} L${w-1} 19 V${h-1} H1 Z M${w-19} 1 V19 H${w-1}" fill="white" stroke="#506986"/>`+text(cx,cy,type==='uml-constraint'?`{${e.uml?.expression||e.name}}`:e.uml?.note||e.name)
 else {const symbol=activitySymbol(e);body=(symbol?`<svg width="${w}" height="${h}" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${symbol}" stroke="#506986" stroke-width="1" fill="white"/></svg>`:rect(type==='uml-action'?12:0))+title;if(type==='uml-object-node'){const name=a.typeId?doc.elements[a.typeId]?.name:a.externalType;body+=text(cx,cy+22,[name,...(a.inState||[])].filter(Boolean).join(' · '),10)}if(a.kind==='callBehavior')body+=`<path d="M${w-20} ${h-14} v-8 m-6 8 h12 m-6 0 v5 m-6 -5 v5 m12 -5 v5" stroke="#506986" fill="none"/>`;if(a.kind==='timeEvent')body=body.replace(title,text(cx,h+13,e.name));if(type==='uml-activity-parameter'){const p=d.activity?.parameters?.find(p=>p.id===a.parameterId);if(p?.stream)body+=text(cx,h-8,'{stream}',10);if(p?.exception)body+=`<path d="M${w-18} 5 l10 16 h-20 Z" fill="white" stroke="#506986"/>`}}
 const membership=activityMembershipLabel(doc,e);if(membership)body+=text(cx,h+14,membership,10);if(type==='uml-action'){[a.precondition,a.postcondition].forEach((v,i)=>{if(!v)return;const yy=h+24+i*28;body+=`<path d="M${cx} ${h} V${yy}" stroke="#506986" stroke-dasharray="4 3"/><rect x="0" y="${yy}" width="${w}" height="24" fill="white" stroke="#506986"/>`+text(cx,yy+15,`«${i?'localPostcondition':'localPrecondition'}» ${v}`,10)})}
 return `<g transform="translate(${x} ${y})">${body}${label}</g>`}).join('')
 if(frameBounds)extents.push({x:frameBounds.x-10,y:frameBounds.y-10},{x:frameBounds.x+frameBounds.width+10,y:frameBounds.y+frameBounds.height+10});for(const r of records)extents.push({x:r.x-15,y:r.y-25},{x:r.x+r.width+15,y:r.y+r.height+(r.e.activityDetail?.postcondition?80:r.e.activityDetail?.precondition?50:24)});const minX=Math.min(0,...extents.map(p=>p.x)),minY=Math.min(0,...extents.map(p=>p.y)),maxX=Math.max(250,...extents.map(p=>p.x)),maxY=Math.max(150,...extents.map(p=>p.y));const frame=frameBounds?`<rect x="${frameBounds.x}" y="${frameBounds.y}" width="${frameBounds.width}" height="${frameBounds.height}" fill="none" stroke="#506986"/>${text(frameBounds.x+100,frameBounds.y+18,d.name,12)}`:'';return {markup:frame+shapes(true)+paths+shapes(false),minX,minY,width:maxX-minX,height:maxY-minY}
}
