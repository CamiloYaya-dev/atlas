import {diagramLabels,elementLabels} from '@atlas/contracts'
import type {Diagram,DiagramEdge,DiagramNode,ModelElement,ProjectDocument} from '@atlas/contracts'
import {DomainError} from '../../domain/errors'

export const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
const escapeText=(v:unknown,max=150)=>esc(String(v??'').replace(/[\p{Cc}]/gu,' ').slice(0,max))
const NW=278,NH=116,MARGIN=75,HEADER=110
const PALETTE:Record<string,string>={actor:'#5e7894',system:'#7365d6',container:'#558fe1',component:'#4c89cb',service:'#669be2',endpoint:'#506ac7',database:'#e18f59',process:'#14a98d',activity:'#14a98d',requirement:'#b68f44',usecase:'#a481d4',event:'#db8b4f',document:'#7a92a8',external:'#75929f'}
function wrap(str:string,limit:number,lines=2){const words=str.replace(/[\p{Cc}]/gu,' ').split(/\s+/);const result:string[]=[];let line='';for(const word of words){if(!word)continue;if((line+' '+word).trim().length>limit){if(line)result.push(line);line=word.slice(0,limit)}else line=(line+' '+word).trim();if(result.length>=lines)break}if(line&&result.length<lines)result.push(line);return result.length?result:['']}
function coordinates(n:DiagramNode,handle:string|undefined,origin=false):[number,number]{
 const h=handle|| (origin?'right':'left')
 if(h==='left')return [n.x,n.y+NH/2]
 if(h==='right')return [n.x+NW,n.y+NH/2]
 if(h.startsWith('top-')||h.startsWith('bottom-')){
  const pos=Number(h.slice(h.indexOf('-')+1))
  const ratio=pos===1?.2:pos===2?.5:.8
  return [n.x+NW*ratio,n.y+(h.startsWith('bottom-')?NH:0)]
 }
 return origin?[n.x+NW,n.y+NH/2]:[n.x,n.y+NH/2]
}
export function renderDiagramSVG(doc:ProjectDocument,d:Diagram,watermarked:boolean):{svg:string;width:number;height:number}{
 if(d.nodes.length>260||d.edges.length>700)throw new DomainError('Exportación demasiado grande: máximo 260 cajas y 700 conexiones',413)
 const points=d.nodes.filter(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)&&Math.abs(n.x)<100000&&Math.abs(n.y)<100000)
 if(points.length!==d.nodes.length)throw new DomainError('Posición de caja no válida para exportación',422)
 const minX=Math.min(0,...points.map(n=>n.x)),minY=Math.min(0,...points.map(n=>n.y))
 const maxX=Math.max(NW,...points.map(n=>n.x+NW)),maxY=Math.max(NH,...points.map(n=>n.y+NH))
 const width=Math.round(maxX-minX+MARGIN*2),height=Math.round(maxY-minY+MARGIN*2+HEADER)
 if(width>5000||height>5000||width*height>20_000_000)throw new DomainError('El diagrama supera las dimensiones máximas de exportación',413)
 const offsetX=MARGIN-minX,offsetY=MARGIN+HEADER-minY
 const itemById=new Map(d.nodes.map(n=>[n.id,n]));const pathCounts=new Map<string,number>()
 const edges=d.edges.flatMap(edge=>{
  const a=itemById.get(edge.source),b=itemById.get(edge.target);if(!a||!b)return []
  const [sx,sy]=coordinates(a,edge.sourceHandle,true),[tx,ty]=coordinates(b,edge.targetHandle,false)
  const key=[edge.source,edge.target].sort().join('|'),nth=pathCounts.get(key)||0;pathCounts.set(key,nth+1)
  const shift=nth===0?0:((nth+1)>>1)*(nth%2===1?1:-1)*34
  const cx=(sx+tx)/2-(ty-sy)/(Math.hypot(tx-sx,ty-sy)||1)*shift
  const cy=(sy+ty)/2+(tx-sx)/(Math.hypot(tx-sx,ty-sy)||1)*shift
  const shape=edge.pathStyle==='straight'?`M ${sx} ${sy} L ${cx} ${cy} L ${tx} ${ty}`:edge.pathStyle==='bezier'?`M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`:`M ${sx} ${sy} L ${cx} ${cy} L ${tx} ${ty}`
  const dash=edge.lineStyle==='dashed'?'stroke-dasharray="11 7"':edge.lineStyle==='dotted'?'stroke-dasharray="2 7"':''
  const marker=edge.direction==='reverse'?'marker-start="url(#arrow)"':edge.direction==='both'?'marker-start="url(#arrow)" marker-end="url(#arrow)"':edge.direction==='none'?'':'marker-end="url(#arrow)"'
  const label=edge.label?`<rect x="${cx-5-Math.min(140,edge.label.length*3.25)}" y="${cy-18}" width="${Math.min(280,edge.label.length*6.5+10)}" height="24" rx="5" fill="#f8fafc" stroke="#dee7f1"/><text x="${cx}" y="${cy-2}" font-size="12" fill="#536986" text-anchor="middle">${escapeText(edge.label,45)}</text>`:''
  return [`<path d="${shape}" fill="none" stroke="#879bb7" stroke-width="2.4" ${dash} ${marker}/>${label}`]
 }).join('')
 const nodes=d.nodes.flatMap(node=>{
  const element=doc.elements[node.elementId];if(!element)return []
  const accent=PALETTE[element.type]||'#6892ba',kind=escapeText(elementLabels[element.type]||element.type,30)
  const title=wrap(element.name,33,2).map((text,i)=>`<text x="${node.x+20}" y="${node.y+57+i*20}" font-size="16" font-weight="700" fill="#182f4d">${escapeText(text,40)}</text>`).join('')
  const summary=element.summary?`<text x="${node.x+20}" y="${node.y+104}" fill="#71839c" font-size="11">${escapeText(element.summary,36)}</text>`:''
  const linked=element.childDiagramId?'<text x="251" y="29" font-size="11" text-anchor="end" fill="#3165c6">↗</text>':''
  return [`<g transform="translate(${offsetX} ${offsetY})"><rect x="${node.x}" y="${node.y}" width="${NW}" height="${NH}" rx="13" fill="#fff" stroke="#dce7f3" stroke-width="1.5"/><rect x="${node.x}" y="${node.y}" width="6" height="${NH}" rx="3" fill="${accent}"/><text x="${node.x+20}" y="${node.y+27}" fill="${accent}" font-size="12" font-weight="700">${kind}</text>${title}${summary}${element.childDiagramId?`<text x="${node.x+253}" y="${node.y+27}" text-anchor="end" font-size="11" fill="#3e69b8">↗</text>`:''}</g>`]
 }).join('')
 const watermark=watermarked?`<g opacity="0.19" fill="#314d77" font-size="29" font-weight="800" text-anchor="middle" transform="rotate(-23 ${width/2} ${height/2})">${Array.from({length:Math.ceil(height/180)+3},(_,r)=>Array.from({length:Math.ceil(width/460)+3},(_,c)=>`<text x="${c*460-280}" y="${r*180-160}">ATLAS · USO NO COMERCIAL</text>`).join('')).join('')}</g>`:''
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Arial, Helvetica, sans-serif"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#879bb7"/></marker></defs><rect width="100%" height="100%" fill="#f4f7fc"/><rect x="0" y="0" width="${width}" height="${HEADER}" fill="#15243b"/><text x="${MARGIN}" y="42" fill="#b4c6e5" font-size="14" font-weight="600">ATLAS · ${escapeText(diagramLabels[d.type])}</text><text x="${MARGIN}" y="81" fill="white" font-size="27" font-weight="700">${escapeText(d.name,70)}</text><g transform="translate(${offsetX} ${offsetY})">${edges}</g>${nodes}${watermark}</svg>`
 return {svg,width,height}
}
