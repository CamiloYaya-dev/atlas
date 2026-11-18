/** Formal A4/Letter page renderer: one shared, validated layout for HTML, PDF and Word. */
import sharp from 'sharp'
import {deflateRawSync} from 'node:zlib'
import {defaultTemplateLayout} from './functional.policy'
import type {TemplateElement} from './functional.policy'

type Item={code:string;title:string;kind:string;payload:Record<string,unknown>;created_at:string;updated_at:string}
type Template={paper?:'A4'|'LETTER';orientation?:'portrait'|'landscape';page_count?:number;pageCount?:number;layout?:TemplateElement[];name?:string}
const MM_PX=3.7795275591,MM_PT=2.8346456693
const esc=(x:unknown)=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
const safeColor=(x:string|undefined)=>/^#[a-f\d]{6}$/i.test(x||'')?x!:'#203858'
export function fieldValue(item:Item,name:string):string{
 const p=item.payload;const value=name==='code'?item.code:name==='title'?item.title:name==='createdAt'?item.created_at:name==='updatedAt'?item.updated_at:name.startsWith('custom:')?(p.custom as Record<string,unknown>|undefined)?.[name.slice(7)]:p[name]
 if(Array.isArray(value))return value.map((v,i)=>`${i+1}. ${typeof v==='string'?v:JSON.stringify(v)}`).join('\n')
 if(typeof value==='boolean')return value?'Sí':'No'
 return value==null?'':String(value)
}
const dimensions=(t?:Template)=>{const w=t?.paper==='LETTER'?215.9:210,h=t?.paper==='LETTER'?279.4:297;return t?.orientation==='landscape'?{width:h,height:w}:{width:w,height:h}}
const pageCount=(t?:Template)=>Math.max(1,Math.min(20,Math.round(t?.page_count??t?.pageCount??1)))
const allElements=(t:Template|undefined,kind:string)=>t?.layout??defaultTemplateLayout(kind as 'finding'|'rf'|'rnf'|'story')
const elementsForPage=(t:Template|undefined,kind:string,page:number)=>allElements(t,kind).filter(x=>(x.page??0)===page)
const rows=(e:TemplateElement)=>Math.max(1,Math.min(20,e.rows??3)),cols=(e:TemplateElement)=>Math.max(1,Math.min(12,e.cols??3))
const rawValue=(item:Item,name:string):unknown=>name==='code'?item.code:name==='title'?item.title:name==='createdAt'?item.created_at:name==='updatedAt'?item.updated_at:name.startsWith('custom:')?(item.payload.custom as Record<string,unknown>|undefined)?.[name.slice(7)]:item.payload[name]
const imageValue=(e:TemplateElement,item:Item)=>{
 const value=e.field?rawValue(item,e.field):undefined
 return typeof value==='string'&&/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)?value:e.image||''
}
const tableValue=(e:TemplateElement,item:Item)=>{
 const value=e.field?rawValue(item,e.field):undefined
 if(!Array.isArray(value)||!value.every(row=>Array.isArray(row)))return e.cells||[]
 return value as string[][]
}
const textFor=(e:TemplateElement,item:Item)=>e.field?fieldValue(item,e.field):e.text||''
const checkedFor=(e:TemplateElement,item:Item)=>e.field?['Sí','true','1','on','Marcado'].includes(fieldValue(item,e.field)):!!e.checked
const listFor=(e:TemplateElement,item:Item)=>{const value=e.field?rawValue(item,e.field):undefined;const values=Array.isArray(value)&&value.every(x=>typeof x==='string')?value as string[]:(e.text||'').split(/\n/).filter(Boolean);return values.map((s,i)=>`${e.ordered?`${i+1}.`:'•'} ${s}`).join('\n')}
const wrap=(value:string,max:number)=>{const out:string[]=[];for(const part of value.split('\n')){let s='';for(const word of part.split(/\s+/)){if(!word)continue;if(!s){s=word;continue}if((s+' '+word).length>max){out.push(s);s=word}else s+=' '+word}out.push(s)}return out}
const geometry=(e:TemplateElement)=>({x:e.x*MM_PX,y:e.y*MM_PX,width:e.width*MM_PX,height:e.height*MM_PX,font:e.fontSize*4/3})
function svgText(e:TemplateElement,value:string,x:number,y:number,w:number,h:number){
 const font=e.fontSize*4/3,lines=wrap(value,Math.max(4,Math.floor(w/Math.max(4,font*.54)))).slice(0,Math.max(1,Math.floor(h/Math.max(font*1.27,8))))
 const pos=e.align==='center'?x+w/2:e.align==='right'?x+w:x,align=e.align==='center'?'middle':e.align==='right'?'end':'start'
 return `<text x="${pos}" y="${y+font*1.05}" font-family="${esc(e.fontFamily)}" font-size="${font}" font-weight="${e.bold?'bold':'normal'}" font-style="${e.italic?'italic':'normal'}" fill="${safeColor(e.color)}" text-anchor="${align}">${lines.map((line,i)=>`<tspan x="${pos}" dy="${i?font*1.3:0}">${esc(line)}</tspan>`).join('')}</text>`
}
function elementSVG(e:TemplateElement,item:Item){
 const {x,y,width:w,height:h}=geometry(e),color=safeColor(e.color)
 if(e.kind==='line')return `<rect x="${x}" y="${y}" width="${w}" height="${Math.max(1,h)}" fill="${color}"/>`
 if(e.kind==='image')return imageValue(e,item)?`<image href="${esc(imageValue(e,item))}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`:''
 if(e.kind==='checkbox')return `<rect x="${x+1}" y="${y+2}" width="${Math.min(15,h-4)}" height="${Math.min(15,h-4)}" fill="none" stroke="${color}" stroke-width="1.5"/>${checkedFor(e,item)?`<path d="M ${x+4} ${y+9} l 4 4 l 7 -8" fill="none" stroke="${color}" stroke-width="1.8"/>`:''}${svgText(e,e.text||'Casilla',x+21,y,w-21,h)}`
 if(e.kind==='table'){
  const rr=rows(e),cc=cols(e),cw=w/cc,ch=h/rr
  return Array.from({length:rr},(_,r)=>Array.from({length:cc},(_,c)=>{
   const xx=x+c*cw,yy=y+r*ch,text=tableValue(e,item)?.[r]?.[c]||''
   return `<rect x="${xx}" y="${yy}" width="${cw}" height="${ch}" fill="${r===0?'#f0f5fd':'white'}" stroke="#a9bfdc" stroke-width="1"/>${svgText(e,text,xx+4,yy+3,cw-8,ch-5)}`
  }).join('')).join('')
 }
 return svgText(e,e.kind==='list'?listFor(e,item):textFor(e,item),x,y,w,h)
}
export function layoutSVG(item:Item,t?:Template,index=0){const page=dimensions(t),w=page.width*MM_PX,h=page.height*MM_PX
 const shapes=elementsForPage(t,item.kind,index).map(e=>elementSVG(e,item)).join('')
 return {page,svg:`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${Math.ceil(w)}" height="${Math.ceil(h)}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#fff"/>${shapes}</svg>`}
}
function elementHTML(e:TemplateElement,item:Item){
 const style=`position:absolute;left:${e.x}mm;top:${e.y}mm;width:${e.width}mm;height:${e.height}mm;overflow:hidden;box-sizing:border-box;font-family:'${esc(e.fontFamily)}';font-size:${e.fontSize}pt;font-weight:${e.bold?'bold':'normal'};font-style:${e.italic?'italic':'normal'};color:${safeColor(e.color)};text-align:${e.align||'left'};white-space:pre-wrap;overflow-wrap:anywhere;`
 if(e.kind==='image')return imageValue(e,item)?`<img alt="Imagen del documento" src="${esc(imageValue(e,item))}" style="${style}object-fit:contain"/>`:''
 if(e.kind==='line')return `<div style="${style}background:${safeColor(e.color)}"></div>`
 if(e.kind==='checkbox')return `<div style="${style}display:flex;align-items:flex-start;gap:5px"><span style="border:1px solid currentColor;display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px">${checkedFor(e,item)?'✓':''}</span><span>${esc(e.text||'Casilla')}</span></div>`
 if(e.kind==='table'){
  const rr=rows(e),cc=cols(e)
  const content=Array.from({length:rr},(_,r)=>`<tr>${Array.from({length:cc},(_,c)=>`<td style="border:1px solid #a9bfdc;padding:2px 4px;${r===0?'background:#f0f5fd;font-weight:bold':''}">${esc(tableValue(e,item)?.[r]?.[c]||'')}</td>`).join('')}</tr>`).join('')
  return `<table style="${style}border-collapse:collapse;table-layout:fixed"><tbody>${content}</tbody></table>`
 }
 return `<div style="${style}">${esc(e.kind==='list'?listFor(e,item):textFor(e,item))}</div>`
}
export function layoutHTML(item:Item,t?:Template){const page=dimensions(t),count=pageCount(t)
 const pages=Array.from({length:count},(_,i)=>`<main class="page" aria-label="Página ${i+1} de ${count}">${elementsForPage(t,item.kind,i).map(e=>elementHTML(e,item)).join('')}</main>`).join('')
 return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(item.code+' · '+item.title)}</title><style>@page{size:${page.width}mm ${page.height}mm;margin:0}body{margin:0;background:#f0f3f8}.page{position:relative;width:${page.width}mm;height:${page.height}mm;margin:12px auto;background:#fff;box-shadow:0 8px 32px #0002;page-break-after:always;break-after:page}.page:last-child{page-break-after:auto;break-after:auto}@media print{body{background:white}.page{margin:0;box-shadow:none}}</style></head><body>${pages}</body></html>`
}
function pdfFromJPEGs(pages:{jpeg:Buffer;width:number;height:number}[],page:{width:number;height:number}){
 const parts:(Buffer|string)[]=[],pos:number[]=[0],W=(page.width*MM_PT).toFixed(3),H=(page.height*MM_PT).toFixed(3);let offset=0
 const add=(v:Buffer|string)=>{parts.push(v);offset+=Buffer.isBuffer(v)?v.length:Buffer.byteLength(v,'latin1')}
 const obj=(id:number,v:Buffer|string)=>{pos[id]=offset;add(`${id} 0 obj\n`);add(v);add('\nendobj\n')}
 add('%PDF-1.4\n');obj(1,'<< /Type /Catalog /Pages 2 0 R >>')
 const ids=pages.map((_,i)=>3+i*3),count=3+pages.length*3
 obj(2,`<< /Type /Pages /Kids [${ids.map(id=>`${id} 0 R`).join(' ')}] /Count ${pages.length} >>`)
 pages.forEach((p,i)=>{const id=ids[i],imageId=id+1,streamId=id+2
  obj(id,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${streamId} 0 R >>`)
  pos[imageId]=offset;add(`${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);add(p.jpeg);add('\nendstream\nendobj\n')
  const ops=`q\n${W} 0 0 ${H} 0 0 cm\n/Im0 Do\nQ\n`;obj(streamId,`<< /Length ${Buffer.byteLength(ops)} >>\nstream\n${ops}endstream`)
 })
 const start=offset;add(`xref\n0 ${count}\n0000000000 65535 f \n`);for(let id=1;id<count;id++)add(`${String(pos[id]).padStart(10,'0')} 00000 n \n`)
 add(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`)
 return Buffer.concat(parts.map(v=>Buffer.isBuffer(v)?v:Buffer.from(v,'latin1')))
}
// ZIP (OpenXML) with central-directory CRC, deflate method 8 and deterministic structure.
const CRC_TABLE=new Uint32Array(256).map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0})
const crc32=(buf:Buffer)=>{let c=0xffffffff;for(const b of buf)c=CRC_TABLE[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0}
function zip(parts:{name:string;data:Buffer|string}[]):Buffer{const bodies:Buffer[]=[],central:Buffer[]=[];let offset=0
 for(const part of parts){const name=Buffer.from(part.name),raw=Buffer.isBuffer(part.data)?part.data:Buffer.from(part.data),deflate=deflateRawSync(raw),crc=crc32(raw),local=Buffer.alloc(30),entry=Buffer.alloc(46)
  local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(deflate.length,18);local.writeUInt32LE(raw.length,22);local.writeUInt16LE(name.length,26)
  entry.writeUInt32LE(0x02014b50,0);entry.writeUInt16LE(20,4);entry.writeUInt16LE(20,6);entry.writeUInt16LE(8,10);entry.writeUInt32LE(crc,16);entry.writeUInt32LE(deflate.length,20);entry.writeUInt32LE(raw.length,24);entry.writeUInt16LE(name.length,28);entry.writeUInt32LE(offset,42)
  bodies.push(local,name,deflate);central.push(entry,name);offset+=local.length+name.length+deflate.length
 }
 const length=central.reduce((sum,b)=>sum+b.length,0),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(parts.length,8);end.writeUInt16LE(parts.length,10);end.writeUInt32LE(length,12);end.writeUInt32LE(offset,16)
 return Buffer.concat([...bodies,...central,end])
}
function wordParagraph(value:string,e:TemplateElement){const lines=wrap(value,Math.max(8,Math.floor(e.width*1.6))).slice(0,45)
 return lines.map(line=>`<w:p><w:pPr><w:jc w:val="${e.align||'left'}"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="${esc(e.fontFamily)}" w:hAnsi="${esc(e.fontFamily)}"/><w:sz w:val="${Math.round(e.fontSize*2)}"/>${e.bold?'<w:b/>':''}${e.italic?'<w:i/>':''}<w:color w:val="${safeColor(e.color).slice(1)}"/></w:rPr><w:t xml:space="preserve">${esc(line)}</w:t></w:r></w:p>`).join('')
}
function wordShape(e:TemplateElement,body:string,variant:'text'|'line'|'cell'='text',override?:{x:number;y:number;width:number;height:number},header=false){
 const g=override||e,style=`position:absolute;left:0;top:0;margin-left:${(g.x*MM_PT).toFixed(2)}pt;margin-top:${(g.y*MM_PT).toFixed(2)}pt;width:${(g.width*MM_PT).toFixed(2)}pt;height:${(g.height*MM_PT).toFixed(2)}pt;mso-position-horizontal-relative:page;mso-position-vertical-relative:page;z-index:1;`
 const id=esc(e.id+'-'+variant+'-'+g.x+'-'+g.y)
 if(variant==='line')return `<w:p><w:r><w:pict><v:rect id="${id}" style="${style}" stroked="f" filled="t" fillcolor="${safeColor(e.color)}"/></w:pict></w:r></w:p>`
 if(variant==='cell')return `<w:p><w:r><w:pict><v:rect id="${id}" style="${style}" stroked="t" strokecolor="#a9bfdc" strokeweight=".8pt" filled="t" fillcolor="${header?'#f0f5fd':'#ffffff'}">${body}</v:rect></w:pict></w:r></w:p>`
 return `<w:p><w:r><w:pict><v:shape id="${id}" style="${style}" stroked="f" filled="f" type="#_x0000_t202">${body}</v:shape></w:pict></w:r></w:p>`
}
async function docxFromLayout(item:Item,t?:Template){const page=dimensions(t),media:{name:string;data:Buffer;id:string}[]=[];let imageNo=0
 const wordElements=async(e:TemplateElement):Promise<string>=>{
  if(e.kind==='line')return wordShape(e,'','line')
  if(e.kind==='image'){
   const uri=imageValue(e,item);if(!uri)return ''
   const match=/^data:image\/(png|jpeg|webp);base64,(.*)$/.exec(uri)
   if(!match)return ''
   const data=await sharp(Buffer.from(match[2],'base64')).png().toBuffer();const id=`rId${++imageNo}`
   media.push({id,name:`image${imageNo}.png`,data})
   return wordShape(e,`<v:imagedata r:id="${id}"/>`)
  }
  const textbox=(text:string,x:TemplateElement=e)=>`<v:textbox inset="2pt,2pt,2pt,2pt"><w:txbxContent>${wordParagraph(text,x)}</w:txbxContent></v:textbox>`
  if(e.kind==='table')return Array.from({length:rows(e)},(_,r)=>Array.from({length:cols(e)},(_,c)=>{
   const pos={x:e.x+e.width*c/cols(e),y:e.y+e.height*r/rows(e),width:e.width/cols(e),height:e.height/rows(e)}
   return wordShape(e,textbox(tableValue(e,item)?.[r]?.[c]||''), 'cell',pos,r===0)
  }).join('')).join('')
  if(e.kind==='checkbox')return wordShape(e,textbox(`${checkedFor(e,item)?'☑':'☐'}  ${e.text||'Casilla'}`))
  return wordShape(e,textbox(e.kind==='list'?listFor(e,item):textFor(e,item)))
 }
 const pages:string[]=[];for(let i=0;i<pageCount(t);i++){const markup=(await Promise.all(elementsForPage(t,item.kind,i).map(wordElements))).join('');pages.push((i?'<w:p><w:r><w:br w:type="page"/></w:r></w:p>':'')+markup)}
 const document=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:v="urn:schemas-microsoft-com:vml"><w:body>${pages.join('')}<w:sectPr><w:pgSz w:w="${Math.round(page.width*56.6929)}" w:h="${Math.round(page.height*56.6929)}"/><w:pgMar w:top="0" w:bottom="0" w:left="0" w:right="0" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`
 const types=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
 const relationships=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
 const imageRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${media.map(m=>`<Relationship Id="${m.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${m.name}"/>`).join('')}</Relationships>`
 return zip([{name:'[Content_Types].xml',data:types},{name:'_rels/.rels',data:relationships},{name:'word/document.xml',data:document},{name:'word/_rels/document.xml.rels',data:imageRels},...media.map(m=>({name:`word/media/${m.name}`,data:m.data}))])
}
export async function renderFunctionalFile(item:Item,t:Template|undefined,format:'html'|'pdf'|'docx'){
 const name=`NOVZI_${item.code.replace(/[^\w-]/g,'_')}`
 if(format==='html')return {name:name+'.html',mime:'text/html; charset=utf-8',data:Buffer.from(layoutHTML(item,t))}
 if(format==='docx')return {name:name+'.docx',mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',data:await docxFromLayout(item,t)}
 const pages=[];for(let i=0;i<pageCount(t);i++){const svg=layoutSVG(item,t,i);const jpg=await sharp(Buffer.from(svg.svg)).resize({width:1400}).flatten({background:'#fff'}).jpeg({quality:88}).toBuffer({resolveWithObject:true});pages.push({jpeg:jpg.data,width:jpg.info.width,height:jpg.info.height})}
 return {name:name+'.pdf',mime:'application/pdf',data:pdfFromJPEGs(pages,dimensions(t))}
}
