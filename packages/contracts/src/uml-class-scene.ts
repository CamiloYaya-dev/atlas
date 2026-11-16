/** Standalone SVG scene for authorized class snapshots; no editor handles or HTML. */
import type {Diagram,ProjectDocument} from './index'
import {atlasNodeSize} from './node-sizing'
import {umlAbsolutePosition,umlNodeDepth} from './uml-containers'
import {umlTypeIdentifier,classEndProperties} from './uml-class-policy'
import {umlAttributeText,umlOperationTextResolved} from './uml-structure'
import {umlDisplayLabel,umlRelationNotation} from './uml-notation'
import {classPort,classFacingPort,classPortAngle,classRelationRoute,classEndTerminal,classEndLabel,classTemplateFormalText} from './uml-class-geometry'
import {parallelOffsets} from './parallel-edges'
import type {UmlTerminal} from './uml-notation'
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
type Point={x:number;y:number}
const text=(x:number,y:number,value:unknown,extra='')=>`<text x="${x}" y="${y}" font-size="12" fill="#34445a" ${extra}>${esc(value)}</text>`
const line=(a:Point,b:Point,extra='')=>`<path d="M ${a.x} ${a.y} L ${b.x} ${b.y}" fill="none" stroke="#506986" stroke-width="1.5" ${extra}/>`
function terminal(kind:UmlTerminal,p:ReturnType<typeof classPort>):string{
 const angle=classPortAngle(p.side)
 const symbol=kind==='triangle'?'<polygon points="0,0 18,-10 18,10" fill="white"/>':kind==='diamond-open'||kind==='diamond-filled'?`<polygon points="0,0 10,-7 20,0 10,7" fill="${kind==='diamond-filled'?'#506986':'white'}"/>`:kind==='open-arrow'?'<path d="M 14,-7 L 0,0 L 14,7" fill="none"/>':kind==='cross'?'<path d="M -6,-6 L 6,6 M -6,6 L 6,-6"/>':kind==='ownership'?'<circle cx="7" cy="0" r="7" fill="white"/><path d="M 2,0 H 12 M 7,-5 V 5"/>':''
 return symbol?`<g transform="translate(${p.x} ${p.y}) rotate(${angle})" stroke="#506986" stroke-width="1.6">${symbol}</g>`:''
}
export function classSvgScene(doc:ProjectDocument,d:Diagram){
 const records=d.nodes.flatMap(node=>{const e=doc.elements[node.elementId];if(!e)return [];const p=umlAbsolutePosition(d,node),size=atlasNodeSize(d.type,e,node,umlNodeDepth(d,node),d.nodes.some(x=>x.parentNodeId===node.id));return [{...p,...size,node,e}]})
 const byId=new Map(records.map(r=>[r.node.id,r])),names=Object.fromEntries(Object.values(doc.elements).map(e=>[e.id,e.name]))
 const edges:string[]=[],offsets=parallelOffsets(d.edges),routes=new Map<string,{a:ReturnType<typeof classPort>;b:ReturnType<typeof classPort>;route:ReturnType<typeof classRelationRoute>}>(),extents:Point[]=[]
 for(const e of d.edges){const from=byId.get(e.source),to=byId.get(e.target);if(!from||!to)continue;const a=classPort(from,classEndProperties(e,'source').handle,true),b=classPort(to,classEndProperties(e,'target').handle,false),route=classRelationRoute({sourceX:a.x,sourceY:a.y,targetX:b.x,targetY:b.y,sourcePosition:a.side,targetPosition:b.side,offset:offsets.get(e.id)||0,pathStyle:e.pathStyle||'smoothstep'},e.source===e.target);routes.set(e.id,{a,b,route})}
 for(const e of d.edges){const p=routes.get(e.id);if(!p)continue;const source=classEndProperties(e,'source'),target=classEndProperties(e,'target'),semantic={...e,sourceNavigability:source.navigability,targetNavigability:target.navigability};const {a,b,route}=p,hub={x:route.labelX,y:route.labelY},n=umlRelationNotation(e.relationKind||'association'),dash=n.stroke==='dashed'?'stroke-dasharray="7 5"':n.stroke==='dotted'?'stroke-dasharray="2 5"':''
  const anchored=e.annotationTargetEdgeId?routes.get(e.annotationTargetEdgeId)?.route:undefined,annotation=anchored?{x:anchored.labelX,y:anchored.labelY}:undefined,nary=!!e.associationEnds?.length
  const path=annotation?`M ${a.x} ${a.y} L ${annotation.x} ${annotation.y}`:nary?`M ${a.x} ${a.y} L ${hub.x} ${hub.y} L ${b.x} ${b.y}`:route.path
  edges.push(`<path d="${path}" stroke="#506986" stroke-width="1.7" fill="none" ${dash}/>`)
  if(!annotation)edges.push(terminal(classEndTerminal(semantic,'source'),a),terminal(classEndTerminal(semantic,'target'),b))
  extents.push(a,b,hub);const coords=path.match(/-?\d+(?:\.\d+)?/g)?.map(Number)||[];for(let i=0;i+1<coords.length;i+=2)extents.push({x:coords[i],y:coords[i+1]})
  if(nary){edges.push(`<polygon points="${hub.x},${hub.y-10} ${hub.x+14},${hub.y} ${hub.x},${hub.y+10} ${hub.x-14},${hub.y}" fill="white" stroke="#506986"/>`);for(const extra of e.associationEnds!.slice(2)){const record=byId.get(extra.nodeId);if(record){const q=extra.handle?classPort(record,extra.handle,false):classFacingPort(record,hub);edges.push(line(hub,q),terminal(extra.navigability==='navigable'?'open-arrow':extra.navigability==='non-navigable'?'cross':'none',q),text(q.x+8,q.y-8,[extra.role,extra.multiplicity].filter(Boolean).join(' ')))}}}
  const cls=records.find(r=>r.e.id===e.associationClassId);if(cls)edges.push(line(hub,classFacingPort(cls,hub),'stroke-dasharray="7 5"'))
  const label=umlDisplayLabel(d.type,e,doc,d);if(label)edges.push(text(hub.x,hub.y-12,label,'text-anchor="middle"'))
  for(const [q,label] of [[a,[source.role,source.multiplicity].filter(Boolean).join(' ')],[b,[target.role,target.multiplicity].filter(Boolean).join(' ')]] as const)if(label){const pos=classEndLabel(q,q.side);edges.push(text(pos.x,pos.y,label,'text-anchor="middle"'))}
 }
 const nodes=records.sort((a,b)=>umlNodeDepth(d,a.node)-umlNodeDepth(d,b.node)).map(r=>{
  const {e,x,y,width,height}=r,u=e.uml||{},mid=x+width/2
  const outline=`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="white" stroke="#506986" stroke-width="1.5"/>`
  if(['uml-package','uml-model'].includes(e.type)){return `<g>${outline}<path d="M ${x} ${y} v -22 h ${Math.min(150,width)} v 22" fill="white" stroke="#506986"/>${text(x+6,y-6,umlTypeIdentifier(e))}${text(mid,y+20,e.name,'text-anchor="middle" font-weight="bold"')}</g>`}
  if(['uml-comment','uml-constraint'].includes(e.type)){const fold=17,body=e.type==='uml-constraint'?`{${u.expression||e.name}}`:u.note||e.name;return `<g><path d="M ${x} ${y} H ${x+width-fold} L ${x+width} ${y+fold} V ${y+height} H ${x} Z M ${x+width-fold} ${y} V ${y+fold} H ${x+width}" fill="white" stroke="#506986"/>${text(mid,y+18,umlTypeIdentifier(e),'text-anchor="middle" opacity=".7"')}${text(mid,y+39,body,'text-anchor="middle"')}</g>`}
  let top=y+57;const items=[outline,text(mid,y+17,umlTypeIdentifier(e),'text-anchor="middle" opacity=".7"'),text(mid,y+36,e.name,`text-anchor="middle" font-weight="bold" ${u.abstract?'font-style="italic"':''}`)]
  if(u.leaf)items.push(text(mid,y+49,'{leaf}','text-anchor="middle"'))
  if(u.templateParameters?.length)items.push(`<rect x="${x+width-110}" y="${y-15}" width="120" height="22" fill="white" stroke="#506986" stroke-dasharray="5 3"/>`,text(x+width-105,y,u.templateParameters.map(p=>classTemplateFormalText(p,names)).join(', ')))
  const compartment=(rows:{value:string;static?:boolean;abstract?:boolean}[])=>{if(!rows.length)return;items.push(line({x,y:top-4},{x:x+width,y:top-4}));for(const row of rows){items.push(text(x+9,top+12,row.value,`${row.static?'text-decoration="underline"':''} ${row.abstract?'font-style="italic"':''}`));top+=21}top+=5}
  compartment((u.literals||[]).map(l=>({value:l.name})));compartment((u.attributes||[]).map(a=>({value:umlAttributeText(a,true,names),static:a.static})));compartment((u.operations||[]).map(o=>({value:umlOperationTextResolved(o,names),static:o.static,abstract:o.abstract})))
  return `<g>${items.join('')}</g>`
 })
 // containers paint behind edges and children; classifier interiors paint above edge lines.
 const containers=records.filter(r=>['uml-package','uml-model'].includes(r.e.type))
 const backgrounds=nodes.filter((_,i)=>containers.some(r=>r.node.id===records[i].node.id)),foregrounds=nodes.filter((_,i)=>!containers.some(r=>r.node.id===records[i].node.id))
 const minX=Math.min(0,...records.map(r=>r.x),...extents.map(p=>p.x))-25,minY=Math.min(0,...records.map(r=>r.y),...extents.map(p=>p.y))-35
 const maxX=Math.max(280,...records.map(r=>r.x+r.width),...extents.map(p=>p.x))+25,maxY=Math.max(150,...records.map(r=>r.y+r.height),...extents.map(p=>p.y))+25
 return {markup:[...backgrounds,...edges,...foregrounds].join(''),minX,minY,width:maxX-minX,height:maxY-minY}
}
