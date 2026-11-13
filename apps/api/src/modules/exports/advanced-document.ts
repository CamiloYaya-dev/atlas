import {deflateRawSync} from 'node:zlib'
import type {AdvancedExportRequest,Diagram,ProjectDocument} from '@atlas/contracts'
import {exportFieldsFor} from '@atlas/contracts'

const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]||char))

/** Diccionario HTML autónomo, sin recursos externos ni ejecución de scripts. Datos de la versión guardada. */
export function buildDiagramDictionary(doc:ProjectDocument,diagram:Diagram,selection:AdvancedExportRequest,exportId:string){
 const elements=diagram.nodes.map(node=>({node,element:doc.elements[node.elementId]})).filter(v=>!!v.element)
 const sheets=elements.map(({node,element},index)=>{
  const rows=exportFieldsFor(doc,diagram,element,node.id,selection,'dictionary')
  if(!rows.length)return ''
  return `<section><h2>${index+1}. ${escapeHtml(element.name)}</h2><p class="type">Tipo: ${escapeHtml(element.type)}</p><table><tbody>${rows.map(f=>`<tr><th>${escapeHtml(f.label)}</th><td>${escapeHtml(f.value)}</td></tr>`).join('')}</tbody></table></section>`
 }).filter(Boolean).join('\n')
 return `<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Diccionario del diagrama — ${escapeHtml(diagram.name)}</title><style>
  :root{font-family:system-ui,'Segoe UI',sans-serif;color:#172a47;background:#f4f7fc}*{box-sizing:border-box}
  body{max-width:980px;margin:0 auto;padding:32px 24px}header{background:#142541;color:white;padding:24px 28px;border-radius:12px}h1{font-size:24px;margin:8px 0}header p{color:#bdd3f4;margin:4px 0}section{background:white;margin:24px 0;padding:22px;border:1px solid #e2eaf4;border-radius:12px;break-inside:avoid}
  h2{font-size:19px;margin:0 0 8px}.type{font-size:12px;color:#536c8e}table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;padding:12px;border-bottom:1px solid #e6ecf4;white-space:pre-wrap;overflow-wrap:anywhere}th{width:26%;color:#415a78}footer{font-size:11px;color:#657a94;margin-top:20px}@media print{body{padding:0;background:white}section{box-shadow:none;border-color:#ccc}}
 </style></head><body><header><p>ATLAS · Documentación del modelo</p><h1>${escapeHtml(diagram.name)}</h1><p>${escapeHtml(diagram.description||'Diccionario de elementos y relaciones')}</p></header>${sheets||'<p>No se seleccionaron campos para el diccionario.</p>'}<footer>Documento complementario generado por ATLAS · Referencia de exportación ${escapeHtml(exportId)} · Los vínculos se describen, pero no son navegables dentro de una imagen.</footer></body></html>`
}

/** ZIP pequeño sin dependencias extra: PNG/JPG no necesita recomprimirse, HTML sí. */
export function zipFiles(entries:{name:string;bytes:Buffer}[]):Buffer{
 if(entries.length>20)throw Error('Número de archivos excesivo')
 const crcTable=new Uint32Array(256)
 for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;crcTable[i]=c>>>0}
 const crc32=(data:Buffer)=>{let c=0xffffffff;for(const byte of data)c=crcTable[(c^byte)&255]^(c>>>8);return(c^0xffffffff)>>>0}
 const locals:Buffer[]=[],central:Buffer[]=[]
 let offset=0
 for(const {name,bytes} of entries){
  if(!/^[A-Za-z0-9_. -]{1,180}$/.test(name)||name.startsWith('.'))throw Error('Nombre de archivo ZIP inválido')
  const filename=Buffer.from(name,'utf8'),compressed=name.endsWith('.html')?deflateRawSync(bytes):bytes
  const method=name.endsWith('.html')?8:0,crc=crc32(bytes)
  const header=Buffer.alloc(30)
  header.writeUInt32LE(0x04034b50,0);header.writeUInt16LE(20,4);header.writeUInt16LE(0x0800,6);header.writeUInt16LE(method,8)
  header.writeUInt32LE(crc,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(bytes.length,22);header.writeUInt16LE(filename.length,26)
  locals.push(header,filename,compressed)
  const center=Buffer.alloc(46)
  center.writeUInt32LE(0x02014b50,0);center.writeUInt16LE(20,4);center.writeUInt16LE(20,6);center.writeUInt16LE(0x0800,8);center.writeUInt16LE(method,10)
  center.writeUInt32LE(crc,16);center.writeUInt32LE(compressed.length,20);center.writeUInt32LE(bytes.length,24);center.writeUInt16LE(filename.length,28);center.writeUInt32LE(offset,42)
  central.push(center,filename)
  offset+=header.length+filename.length+compressed.length
 }
 const size=central.reduce((sum,b)=>sum+b.length,0),end=Buffer.alloc(22)
 end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(size,12);end.writeUInt32LE(offset,16)
 return Buffer.concat([...locals,...central,end])
}
