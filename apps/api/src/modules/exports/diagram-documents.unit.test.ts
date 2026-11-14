import test from 'node:test'
import assert from 'node:assert/strict'
import {inflateRawSync} from 'node:zlib'
import {createElement,validateAdvancedExport} from '@atlas/contracts'
import type {ProjectDocument,Diagram} from '@atlas/contracts'
import {buildDiagramDocx,buildDiagramPdf,exportDocumentSheets} from './diagram-documents'
function fixture(){
 const a={...createElement('Usuario <QA> & "prueba"','actor'),summary:'Solicitud (QA) \\ pago',description:'No exportar',owner:'Responsable interno'}
 const b=createElement('Segundo','system')
 const diagram:Diagram={id:'d',name:'Fichas & QA',description:'',type:'c1',createdAt:'2026-11-14',nodes:[{id:'a',elementId:a.id,x:0,y:0},{id:'b',elementId:b.id,x:300,y:0}],edges:[{id:'r',source:'a',target:'b',label:'Consulta'}]}
 const doc:ProjectDocument={schema:1,elements:{[a.id]:a,[b.id]:b},diagrams:[diagram],fieldDefinitions:[]}
 const req=validateAdvancedExport(doc,diagram,{mode:'both',fields:{a:{summary:'dictionary',description:'omit',owner:'embed','@relations':'dictionary'}}})
 return {doc,diagram,req,a}
}
function unzip(zip:Buffer){
 const files=new Map<string,string>();let p=0
 while(p+30<=zip.length&&zip.readUInt32LE(p)===0x04034b50){const method=zip.readUInt16LE(p+8),n=zip.readUInt32LE(p+18),len=zip.readUInt16LE(p+26),extra=zip.readUInt16LE(p+28);const start=p+30+len+extra;const bytes=zip.subarray(start,start+n);assert.ok(method===0||method===8);files.set(zip.subarray(p+30,p+30+len).toString('utf8'),(method===8?inflateRawSync(bytes):bytes).toString('utf8'));p=start+n}
 assert.equal(zip.readUInt32LE(p),0x02014b50);return files
}
test('fichas separadas exportan exclusivamente campos elegidos, relaciones y datos del servidor',()=>{
 const {doc,diagram,req,a}=fixture();const sheets=exportDocumentSheets(doc,diagram,req);assert.equal(sheets.length,1);assert.equal(sheets[0].name,a.name);assert.deepEqual(sheets[0].rows.map(r=>r.label),['Resumen','Relaciones']);assert.match(sheets[0].rows[1].value,/Segundo \(Consulta\)/)
 const empty={...doc,elements:{}};assert.deepEqual(exportDocumentSheets(empty,diagram,req),[])
})
test('DOCX contiene OOXML válido, campos autorizados y texto escapado',()=>{
 const {doc,diagram,req}=fixture();const files=unzip(buildDiagramDocx(doc,diagram,req));assert.equal(files.size,5);assert.match(files.get('[Content_Types].xml')!,/wordprocessingml.document.main\+xml/);assert.match(files.get('_rels/.rels')!,/word\/document.xml/);assert.match(files.get('word/styles.xml')!,/Heading2/);const xml=files.get('word/document.xml')!;assert.match(xml,/Usuario &lt;QA&gt; &amp; &quot;prueba&quot;/);assert.match(xml,/Solicitud \(QA\)/);assert.doesNotMatch(xml,/No exportar|Responsable interno/);assert.match(unzip(buildDiagramDocx(doc,diagram,{mode:'dictionary',fields:{}})).get('word/document.xml')!,/No se seleccionaron campos/)
})
test('PDF preserva selección, escapa literales y crea referencias de objetos correctas',()=>{
 const {doc,diagram,req}=fixture();const pdf=buildDiagramPdf(doc,diagram,req);const text=pdf.toString('latin1');assert.ok(text.startsWith('%PDF-1.4'));assert.match(text,/Solicitud \\\(QA\\\) \\\\ pago/);assert.doesNotMatch(text,/No exportar|Responsable interno/);const xref=Number(/startxref\n(\d+)\n%%EOF/.exec(text)![1]);assert.equal(pdf.subarray(xref,xref+4).toString(),'xref');const rows=text.slice(xref).split('\n');const total=Number(rows[1].split(' ')[1]);for(let i=1;i<total;i++){const offset=Number(rows[i+2].slice(0,10));assert.ok(text.slice(offset).startsWith(`${i} 0 obj\n`))}
 assert.match(buildDiagramPdf(doc,diagram,{mode:'dictionary',fields:{}}).toString('latin1'),/No se seleccionaron campos/)
})
test('PDF multipágina conserva el final de un campo largo sin recortarlo',()=>{
 const {doc,diagram,req,a}=fixture();a.summary='A'.repeat(400)+' '+('Texto de ejemplo con detalle. '.repeat(500))+' MARCADOR_FINAL';diagram.description='Descripción con tildes y “comillas”';const text=buildDiagramPdf(doc,diagram,req).toString('latin1');assert.ok(Number(/\/Type \/Pages \/Count (\d+)/.exec(text)![1])>1);assert.match(text,/MARCADOR_FINAL/);assert.match(text,/Descripción con tildes y "comillas"/)
})
