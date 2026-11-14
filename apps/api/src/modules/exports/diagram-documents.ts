import type {AdvancedExportRequest,Diagram,ProjectDocument} from '@atlas/contracts'
import {exportFieldsFor} from '@atlas/contracts'
import {zipFiles} from './advanced-document'

type Sheet={name:string;type:string;rows:{label:string;value:string}[]}
export function exportDocumentSheets(doc:ProjectDocument,diagram:Diagram,request:AdvancedExportRequest):Sheet[]{
 return diagram.nodes.flatMap(node=>{
  const e=doc.elements[node.elementId];if(!e)return []
  const rows=exportFieldsFor(doc,diagram,e,node.id,request,'dictionary')
  return rows.length?[{name:e.name,type:e.type,rows:rows.map(field=>({label:field.label,value:field.value}))}]:[]
 })
}
const xmlEscape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]||c))
/** Microsoft Word DOCX genuino: documento editable OOXML, no HTML con extensión .doc. */
export function buildDiagramDocx(doc:ProjectDocument,diagram:Diagram,request:AdvancedExportRequest):Buffer{
 const sheets=exportDocumentSheets(doc,diagram,request)
 const para=(value:string,heading=false)=>`<w:p><w:pPr>${heading?'<w:pStyle w:val="Heading2"/>':''}</w:pPr><w:r><w:t xml:space="preserve">${xmlEscape(value)}</w:t></w:r></w:p>`
 const blocks=[para(diagram.name,true),para(diagram.description||'Fichas de elementos y relaciones')]
 for(const sheet of sheets){blocks.push(para(sheet.name+' · '+sheet.type,true));for(const row of sheet.rows){blocks.push(para(row.label+': '+row.value))}}
 if(!sheets.length)blocks.push(para('No se seleccionaron campos para las fichas.'))
 const document=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${blocks.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`
 const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="260" w:after="130"/></w:pPr><w:rPr><w:b/><w:color w:val="224C82"/><w:sz w:val="29"/></w:rPr></w:style></w:styles>`
 const contentTypes=`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`
 const rels=`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
 const docRels=`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
 return zipFiles([
 {name:'[Content_Types].xml',bytes:Buffer.from(contentTypes)},
 {name:'_rels/.rels',bytes:Buffer.from(rels)},
 {name:'word/document.xml',bytes:Buffer.from(document)},
 {name:'word/_rels/document.xml.rels',bytes:Buffer.from(docRels)},
 {name:'word/styles.xml',bytes:Buffer.from(styles)}
 ])
}

/** PDF multipágina con fuentes estándar y paginación: sin servicios externos. */
export function buildDiagramPdf(doc:ProjectDocument,diagram:Diagram,request:AdvancedExportRequest):Buffer{
 const sheets=exportDocumentSheets(doc,diagram,request),width=595,height=842,left=50,bottom=50
 type Page={ops:string[];y:number}
 const pages:Page[]=[{ops:[],y:height-65}]
 let current=pages[0]
 const encode=(str:string)=>str.replace(/[\r\n\t]+/g,' ').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[–—]/g,'-').replace(/[^\x20-\x7e\xA0-\xFF]/g,'?')
 const escape=(str:string)=>encode(str).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)')
 const newPage=()=>{current={ops:[],y:height-65};pages.push(current)}
 const paint=(text:string,fontSize=10,bold=false)=>{
  const lineHeight=fontSize*1.5,maxChars=Math.max(10,Math.floor((width-left*2)/(fontSize*.53)))
  const words=text.replace(/\s+/g,' ').trim().split(' ')
  let line=''
  const rows:string[]=[]
  for(const word of words){for(const w of word.length>maxChars?word.match(new RegExp(`.{1,${maxChars}}`,'g'))||[word]:[word]){if(line.length+w.length+1>maxChars&&line){rows.push(line);line=w}else line+=(line?' ':'')+w}}
  if(line)rows.push(line)
  for(const row of rows.length?rows:['']){
   if(current.y-lineHeight<bottom)newPage()
   current.ops.push(`BT /F${bold?2:1} ${fontSize} Tf 0.14 0.23 0.36 rg ${left} ${current.y} Td (${escape(row)}) Tj ET`)
   current.y-=lineHeight
  }
 }
 const space=(px:number)=>{current.y-=px;if(current.y<bottom)newPage()}
 paint('ATLAS  |  FICHAS DE ELEMENTOS',11,true);space(15)
 paint(diagram.name,18,true);space(5)
 paint(diagram.description||'Fichas de elementos, campos y relaciones',10);space(22)
 if(!sheets.length)paint('No se seleccionaron campos para las fichas.',10)
 for(const [index,sheet] of sheets.entries()){
  if(current.y<130)newPage()
  paint(`${index+1}. ${sheet.name} (${sheet.type})`,13,true);space(8)
  for(const row of sheet.rows){paint(row.label+':',10,true);paint(row.value,10);space(6)}
  space(14)
 }
 const objects:Buffer[]=[]
 const add=(body:string|Buffer)=>{objects.push(Buffer.isBuffer(body)?body:Buffer.from(body,'latin1'));return objects.length}
 const font1=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
 const font2=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
 const resources=add(`<< /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> >>`)
 const catalogId=objects.length+1,pagesId=catalogId+1
 add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`)
 add('PAGES_PLACEHOLDER')
 const pageIds:number[]=[]
 for(const page of pages){
  const bytes=Buffer.from(page.ops.join('\n'),'latin1')
  const contentId=add(Buffer.concat([Buffer.from(`<< /Length ${bytes.length} >>\nstream\n`),bytes,Buffer.from('\nendstream')]))
  pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${width} ${height}] /Resources ${resources} 0 R /Contents ${contentId} 0 R >>`))
 }
 objects[pagesId-1]=Buffer.from(`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id=>id+' 0 R').join(' ')}] >>`)
 const header=Buffer.from('%PDF-1.4\n%ATLAS\n')
 const chunks:Buffer[]=[header],offsets:number[]=[0];let cursor=header.length
 for(const [i,obj] of objects.entries()){
  offsets.push(cursor);const wrapper=Buffer.concat([Buffer.from(`${i+1} 0 obj\n`),obj,Buffer.from('\nendobj\n')]);chunks.push(wrapper);cursor+=wrapper.length
 }
 const xrefPos=cursor
 const xref=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefPos}\n%%EOF`
 chunks.push(Buffer.from(xref))
 return Buffer.concat(chunks)
}
